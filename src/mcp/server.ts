import { randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type OutgoingHttpHeader, type OutgoingHttpHeaders, type ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { config } from "../config.js";
import { openReadonlyDb } from "../db/connection.js";
import { DocsRepository } from "../db/repository.js";
import { normalizeError } from "./errors.js";
import { incrementCounter, logOperation, nextRequestId, recordDuration, recordSearchQuery, recordSearchTopic } from "./observability.js";
import { registerKnowledgePrompts } from "./prompts/knowledge-prompts.js";
import { registerTopicResources } from "./resources/topics.js";
import { fetchToolSchema, handleFetch } from "./tools/fetch.js";
import { listTopicsToolSchema, handleListTopics } from "./tools/list-topics.js";
import { handleRebuildCorpusIndex, rebuildCorpusIndexToolSchema } from "./tools/rebuild-corpus-index.js";
import { handleRunRegressionQueries, runRegressionQueriesToolSchema } from "./tools/run-regression-queries.js";
import { handleSearch, searchToolSchema } from "./tools/search.js";
import { handleValidateChunkSchema, validateChunkSchemaToolSchema } from "./tools/validate-chunk-schema.js";

const processStartedAtMs = Date.now();

type McpRuntime = {
  server: McpServer;
  repository: DocsRepository;
  close: () => void;
};

type HttpSession = {
  transport: StreamableHTTPServerTransport;
  runtime: McpRuntime;
};

class HttpRequestError extends Error {
  public readonly statusCode: number;
  public readonly payload: Record<string, unknown>;

  public constructor(statusCode: number, payload: Record<string, unknown>) {
    super(typeof payload.error === "object" ? String((payload.error as { message?: string }).message ?? "HTTP request error") : "HTTP request error");
    this.statusCode = statusCode;
    this.payload = payload;
    this.name = "HttpRequestError";
  }
}

export async function startMcpServer(): Promise<void> {
  await startMcpServerStdio();
}

export async function startMcpServerStdio(): Promise<void> {
  const runtime = createMcpRuntime();
  const transport = new StdioServerTransport();
  await runtime.server.connect(transport);

  let closed = false;
  const shutdown = () => {
    if (closed) {
      return;
    }
    closed = true;
    runtime.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

export async function startMcpServerHttp(): Promise<void> {
  const endpoint = normalizeHttpEndpoint(config.httpEndpoint);
  const sessions = new Map<string, HttpSession>();
  let isReady = false;
  let isShuttingDown = false;
  let shutdownStartedAt = 0;
  let shutdownPromise: Promise<void> | null = null;

  const server = createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (requestUrl.pathname === "/health" && req.method === "GET") {
      writeJson(res, 200, {
        ok: true,
        name: config.serverName,
        version: config.serverVersion,
        transport: "http_streamable",
        auth_http_enabled: config.httpAuthEnabled,
        uptime_sec: Number(((Date.now() - processStartedAtMs) / 1000).toFixed(3))
      });
      return;
    }

    if (requestUrl.pathname === "/ready" && req.method === "GET") {
      const payload = {
        ready: isReady && !isShuttingDown,
        name: config.serverName,
        version: config.serverVersion,
        transport: "http_streamable"
      };
      writeJson(res, payload.ready ? 200 : 503, payload);
      return;
    }

    if (isShuttingDown) {
      writeJson(res, 503, {
        error: {
          type: "unavailable",
          message: "Server is shutting down"
        }
      });
      return;
    }

    if (requestUrl.pathname !== endpoint) {
      writeJson(res, 404, {
        jsonrpc: "2.0",
        error: {
          code: -32601,
          message: "Endpoint not found"
        },
        id: null
      });
      return;
    }

    if (!isOriginAllowed(req.headers.origin, config.httpHost)) {
      writeJson(res, 403, {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Origin is not allowed"
        },
        id: null
      });
      return;
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Methods": "POST,GET,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Authorization,Content-Type,Accept,MCP-Session-Id,Last-Event-ID",
        "Access-Control-Allow-Origin": req.headers.origin ?? "null"
      });
      res.end();
      return;
    }

    if (!isHttpRequestAuthorized(req)) {
      writeUnauthorized(res);
      const requestId = nextRequestId();
      incrementCounter("auth_fail_total");
      recordDuration("http", "auth_bearer", 0);
      logOperation({
        request_id: requestId,
        kind: "http",
        name: "auth_bearer",
        uri: requestUrl.pathname,
        status: "error",
        duration_ms: 0
      });
      return;
    }

    if (req.method === "POST") {
      const contentLengthError = getContentLengthLimitError(req, config.httpMaxBodyBytes);
      if (contentLengthError) {
        writeJson(res, contentLengthError.statusCode, contentLengthError.payload);
        return;
      }
      await handleHttpPost(req, res, sessions);
      return;
    }

    if (req.method === "GET" || req.method === "DELETE") {
      await handleHttpStreamRequest(req, res, sessions);
      return;
    }

    writeJson(res, 405, {
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed"
      },
      id: null
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.httpPort, config.httpHost, () => {
      server.off("error", reject);
      isReady = true;
      process.stderr.write(
        `MCP HTTP transport listening on http://${config.httpHost}:${config.httpPort}${endpoint}\n`
      );
      resolve();
    });
  });

  const shutdown = async (signal: "SIGINT" | "SIGTERM") => {
    if (shutdownPromise) {
      await shutdownPromise;
      return;
    }

    const requestId = nextRequestId();
    shutdownStartedAt = Date.now();
    isShuttingDown = true;
    isReady = false;
    logOperation({
      request_id: requestId,
      kind: "http",
      name: "shutdown_start",
      status: "ok",
      duration_ms: 0,
      uri: signal
    });

    shutdownPromise = (async () => {
      try {
        await new Promise<void>((resolve) => {
          server.close(() => resolve());
        });
        const closeOps = Array.from(sessions.values()).map((session) => closeHttpSession(session));
        await Promise.allSettled(closeOps);
        logOperation({
          request_id: requestId,
          kind: "http",
          name: "shutdown_complete",
          status: "ok",
          duration_ms: Date.now() - shutdownStartedAt,
          uri: signal
        });
        process.exit(0);
      } catch {
        logOperation({
          request_id: requestId,
          kind: "http",
          name: "shutdown_complete",
          status: "error",
          duration_ms: Date.now() - shutdownStartedAt,
          uri: signal
        });
        process.exit(1);
      }
    })();

    await shutdownPromise;
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

function createMcpRuntime(): McpRuntime {
  const db = openReadonlyDb();
  const repository = new DocsRepository(db);
  const server = new McpServer({
    name: config.serverName,
    version: config.serverVersion
  });

  server.tool(
    "search",
    "Полнотекстовый поиск по документации 1С (SQLite FTS5).",
    searchToolSchema,
    async (args) => runToolWithObservability("search", args, () => handleSearch(repository, args))
  );

  server.tool(
    "fetch",
    "Получить документ по id.",
    fetchToolSchema,
    async (args) => runToolWithObservability("fetch", args, () => handleFetch(repository, args))
  );

  server.tool(
    "list_topics",
    "Получить список тем документации с количеством документов.",
    listTopicsToolSchema,
    async (args) => runToolWithObservability("list_topics", args, () => handleListTopics(repository, args))
  );

  server.tool(
    "run_regression_queries",
    "Прогнать регрессионные поисковые запросы и вернуть сводку.",
    runRegressionQueriesToolSchema,
    async (args) => runToolWithObservability("run_regression_queries", args, () => handleRunRegressionQueries(repository, args))
  );

  server.tool(
    "validate_chunk_schema",
    "Проверка схемы и качества normalized corpus (без изменений данных).",
    validateChunkSchemaToolSchema,
    async (args) => runToolWithObservability("validate_chunk_schema", args, () => handleValidateChunkSchema(args))
  );

  server.tool(
    "rebuild_corpus_index",
    "Пересборка индекса корпуса с опциональной валидацией и регрессией.",
    rebuildCorpusIndexToolSchema,
    async (args) => runToolWithObservability("rebuild_corpus_index", args, () => handleRebuildCorpusIndex(args))
  );

  registerTopicResources(server, repository);
  registerKnowledgePrompts(server);

  return {
    server,
    repository,
    close: () => {
      db.close();
    }
  };
}

async function handleHttpPost(
  req: IncomingMessage,
  res: ServerResponse,
  sessions: Map<string, HttpSession>
): Promise<void> {
  let createdSessionId: string | undefined;
  try {
    const parsedBody = await readJsonBody(req, config.httpMaxBodyBytes);
    const sessionId = getMcpSessionId(req);
    const existing = sessionId ? sessions.get(sessionId) : undefined;
    if (existing) {
      ensureSseUtf8Charset(res);
      await withRequestTimeout(existing.transport.handleRequest(req, res, parsedBody), config.httpRequestTimeoutMs);
      return;
    }

    if (sessionId && !existing) {
      writeJson(res, 404, {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Session not found"
        },
        id: null
      });
      return;
    }

    if (!isInitializeRequest(parsedBody)) {
      writeJson(res, 400, {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Expected initialize request for new session"
        },
        id: null
      });
      return;
    }

    const runtime = createMcpRuntime();
    const newSessionId = randomUUID();
    createdSessionId = newSessionId;
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId
    });
    sessions.set(newSessionId, { transport, runtime });
    await runtime.server.connect(transport);
    ensureSseUtf8Charset(res);
    await withRequestTimeout(transport.handleRequest(req, res, parsedBody), config.httpRequestTimeoutMs);
    return;
  } catch (error) {
    if (createdSessionId) {
      const created = sessions.get(createdSessionId);
      if (created) {
        sessions.delete(createdSessionId);
        await closeHttpSession(created);
      }
    }
    if (error instanceof HttpRequestError) {
      writeJson(res, error.statusCode, error.payload);
      return;
    }
    writeInternalError(res, error);
  }
}

async function handleHttpStreamRequest(
  req: IncomingMessage,
  res: ServerResponse,
  sessions: Map<string, HttpSession>
): Promise<void> {
  try {
    const sessionId = getMcpSessionId(req);
    if (!sessionId) {
      writeJson(res, 400, {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "MCP-Session-Id header is required"
        },
        id: null
      });
      return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      writeJson(res, 404, {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Session not found"
        },
        id: null
      });
      return;
    }

    if (req.method === "GET") {
      ensureSseUtf8Charset(res);
      await session.transport.handleRequest(req, res);
    } else {
      ensureSseUtf8Charset(res);
      await withRequestTimeout(session.transport.handleRequest(req, res), config.httpRequestTimeoutMs);
    }
    if (req.method === "DELETE") {
      sessions.delete(sessionId);
      await closeHttpSession(session);
    }
  } catch (error) {
    if (error instanceof HttpRequestError) {
      writeJson(res, error.statusCode, error.payload);
      return;
    }
    writeInternalError(res, error);
  }
}

function ensureSseUtf8Charset(res: ServerResponse): void {
  const patchedFlag = "__mcpSseCharsetPatched";
  const patched = res as ServerResponse & { [patchedFlag]?: boolean };
  if (patched[patchedFlag]) {
    return;
  }
  patched[patchedFlag] = true;

  const originalSetHeader = res.setHeader.bind(res);
  const originalWriteHead = res.writeHead.bind(res);

  const normalizeHeaderValue = <T>(name: string, value: T): T => {
    if (name.toLowerCase() !== "content-type" || typeof value !== "string") {
      return value;
    }
    const lower = value.toLowerCase();
    if (lower.startsWith("text/event-stream") && !lower.includes("charset=")) {
      return `${value}; charset=utf-8` as T;
    }
    return value;
  };

  const patchedSetHeader: typeof res.setHeader = (name, value) => {
    return originalSetHeader(name, normalizeHeaderValue(name, value));
  };
  res.setHeader = patchedSetHeader;

  const normalizeHeadersObject = (headers: OutgoingHttpHeaders): OutgoingHttpHeaders => {
    const normalized: OutgoingHttpHeaders = { ...headers };
    for (const [key, value] of Object.entries(normalized)) {
      if (value !== undefined) {
        normalized[key] = normalizeHeaderValue(key, value);
      }
    }
    return normalized;
  };

  const patchedWriteHead = (
    statusCode: number,
    statusMessageOrHeaders?: string | OutgoingHttpHeaders | OutgoingHttpHeader[],
    headers?: OutgoingHttpHeaders | OutgoingHttpHeader[]
  ): ServerResponse => {
    if (typeof statusMessageOrHeaders === "string") {
      if (headers && !Array.isArray(headers)) {
        return originalWriteHead(statusCode, statusMessageOrHeaders, normalizeHeadersObject(headers));
      }
      return originalWriteHead(statusCode, statusMessageOrHeaders, headers);
    }
    if (statusMessageOrHeaders && !Array.isArray(statusMessageOrHeaders)) {
      return originalWriteHead(statusCode, normalizeHeadersObject(statusMessageOrHeaders));
    }
    return originalWriteHead(statusCode, statusMessageOrHeaders);
  };
  res.writeHead = patchedWriteHead as typeof res.writeHead;
}

async function readJsonBody(req: IncomingMessage, maxBodyBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBodyBytes) {
      throw new HttpRequestError(413, {
        error: {
          type: "invalid_input",
          message: `Request body too large. Max ${maxBodyBytes} bytes.`
        }
      });
    }
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (raw.length === 0) {
    return {};
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new HttpRequestError(400, {
      error: {
        type: "invalid_input",
        message: "Invalid JSON body."
      }
    });
  }
}

function normalizeHttpEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (trimmed.length === 0) {
    return "/mcp";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function getMcpSessionId(req: IncomingMessage): string | undefined {
  const raw = req.headers["mcp-session-id"];
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }
  if (Array.isArray(raw)) {
    const first = raw[0]?.trim();
    return first && first.length > 0 ? first : undefined;
  }
  return undefined;
}

function isOriginAllowed(originHeader: string | undefined, allowedHost: string): boolean {
  if (!originHeader) {
    return true;
  }

  const allowlist = config.httpAllowedOrigins.map((item) => item.toLowerCase());
  if (allowlist.length > 0) {
    return allowlist.includes(originHeader.trim().toLowerCase());
  }

  try {
    const parsed = new URL(originHeader);
    const host = parsed.hostname.toLowerCase();
    const normalizedAllowed = allowedHost.toLowerCase();
    return host === "localhost"
      || host === "127.0.0.1"
      || host === "::1"
      || host === normalizedAllowed;
  } catch {
    return false;
  }
}

function getContentLengthLimitError(req: IncomingMessage, maxBodyBytes: number): HttpRequestError | null {
  const rawContentLength = req.headers["content-length"];
  const value = Array.isArray(rawContentLength) ? rawContentLength[0] : rawContentLength;
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed > maxBodyBytes) {
    return new HttpRequestError(413, {
      error: {
        type: "invalid_input",
        message: `Request body too large. Max ${maxBodyBytes} bytes.`
      }
    });
  }
  return null;
}

async function withRequestTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) {
    return promise;
  }

  let timer: NodeJS.Timeout | null = null;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new HttpRequestError(408, {
          error: {
            type: "internal_error",
            message: "Request timeout."
          }
        }));
      }, timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function isHttpRequestAuthorized(req: IncomingMessage): boolean {
  if (!config.httpAuthEnabled) {
    return true;
  }

  const expectedToken = config.httpBearerToken;
  if (expectedToken.trim().length === 0) {
    return false;
  }

  const rawAuth = req.headers.authorization;
  if (!rawAuth) {
    return false;
  }
  const authHeader = Array.isArray(rawAuth) ? (rawAuth[0] ?? "") : rawAuth;
  const [scheme, token, ...rest] = authHeader.trim().split(/\s+/);
  if (rest.length > 0) {
    return false;
  }
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return false;
  }

  const expectedBytes = Buffer.from(expectedToken, "utf-8");
  const actualBytes = Buffer.from(token, "utf-8");
  if (expectedBytes.length !== actualBytes.length) {
    return false;
  }

  return timingSafeEqual(expectedBytes, actualBytes);
}

function writeUnauthorized(res: ServerResponse): void {
  if (res.headersSent) {
    return;
  }
  res.writeHead(401, {
    "Content-Type": "application/json; charset=utf-8",
    "WWW-Authenticate": "Bearer"
  });
  res.end(JSON.stringify({
    error: {
      type: "unauthorized",
      message: "Unauthorized"
    }
  }));
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  if (res.headersSent) {
    return;
  }
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(payload));
}

function writeInternalError(res: ServerResponse, error: unknown): void {
  const message = error instanceof Error ? error.message : "Internal server error";
  writeJson(res, 500, {
    jsonrpc: "2.0",
    error: {
      code: -32603,
      message: "Internal server error"
    },
    id: null
  });
  process.stderr.write(`MCP HTTP error: ${message}\n`);
}

async function closeHttpSession(session: HttpSession): Promise<void> {
  await Promise.allSettled([session.transport.close(), session.runtime.server.close()]);
  session.runtime.close();
}

async function runSafe<T>(fn: () => Promise<T>): Promise<T | { isError: true; content: Array<{ type: "text"; text: string }> }> {
  try {
    return await fn();
  } catch (error) {
    const normalized = normalizeError(error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: {
                type: normalized.type,
                message: normalized.message
              }
            },
            null,
            2
          )
        }
      ]
    };
  }
}

async function runToolWithObservability(
  toolName: string,
  args: Record<string, unknown>,
  fn: () => Promise<any>
): Promise<any> {
  const requestId = nextRequestId();
  const startedAt = Date.now();
  incrementCounter("tool_calls_total");

  const result = await runSafe(fn);
  const durationMs = Date.now() - startedAt;
  const isError = typeof result === "object" && result !== null && "isError" in result && (result as { isError?: boolean }).isError === true;
  recordDuration("tool", toolName, durationMs);

  const payload = extractJsonPayload(result);
  const baseLog: Record<string, unknown> = {
    request_id: requestId,
    kind: "tool",
    name: toolName,
    status: isError ? "error" : "ok",
    duration_ms: durationMs
  };

  if (toolName === "search") {
    incrementCounter("search_total");
    const topic = typeof args.topic === "string" ? args.topic : null;
    recordSearchTopic(topic);
    if (typeof args.query === "string") {
      recordSearchQuery(args.query);
    }
    const resultsCount = typeof payload?.total === "number" ? payload.total : 0;
    if (resultsCount === 0) {
      incrementCounter("search_empty_total");
    }
    logOperation({
      ...baseLog,
      query: typeof args.query === "string" ? args.query : "",
      topic,
      results_count: resultsCount
    } as Parameters<typeof logOperation>[0]);
    return result;
  }

  if (toolName === "fetch") {
    incrementCounter("fetch_total");
    const found = payload?.found === true;
    if (!found) {
      incrementCounter("fetch_not_found_total");
    }
    logOperation({
      ...baseLog,
      id: typeof args.id === "string" ? args.id : "",
      found
    } as Parameters<typeof logOperation>[0]);
    return result;
  }

  logOperation(baseLog as Parameters<typeof logOperation>[0]);
  return result;
}

function extractJsonPayload(result: unknown): Record<string, unknown> | null {
  if (typeof result !== "object" || result === null || !("content" in result)) {
    return null;
  }
  const content = (result as { content?: Array<{ type?: string; text?: string }> }).content;
  const text = content?.find((item) => item.type === "text")?.text;
  if (!text) {
    return null;
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
