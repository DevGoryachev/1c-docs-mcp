import path from "node:path";

const projectRoot = process.cwd();

function intFromEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) {
    return defaultValue;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function boolFromEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return defaultValue;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
    return false;
  }
  return defaultValue;
}

function listFromEnv(name: string): string[] {
  const raw = process.env[name];
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export const config = {
  dbPath: path.resolve(projectRoot, process.env.MCP_DB_PATH ?? "data/sqlite/docs.db"),
  dataDir: path.resolve(projectRoot, process.env.MCP_DATA_DIR ?? "data/normalized"),
  defaultSearchLimit: intFromEnv("MCP_DEFAULT_SEARCH_LIMIT", 10),
  maxSearchLimit: intFromEnv("MCP_MAX_SEARCH_LIMIT", 50),
  serverName: process.env.MCP_SERVER_NAME ?? "1c-docs-mcp",
  serverVersion: process.env.MCP_SERVER_VERSION ?? "0.1.0",
  supportedTransports: ["stdio", "http_streamable"] as const,
  httpHost: process.env.MCP_HTTP_HOST ?? "127.0.0.1",
  httpPort: intFromEnv("MCP_HTTP_PORT", 3000),
  httpEndpoint: process.env.MCP_HTTP_ENDPOINT ?? "/mcp",
  httpAuthEnabled: boolFromEnv("MCP_HTTP_AUTH_ENABLED", false),
  httpBearerToken: process.env.MCP_HTTP_BEARER_TOKEN ?? "",
  httpAllowedOrigins: listFromEnv("MCP_HTTP_ALLOWED_ORIGINS"),
  publicBaseUrl: process.env.MCP_PUBLIC_BASE_URL?.trim() || null,
  httpMaxBodyBytes: intFromEnv("MCP_HTTP_MAX_BODY_BYTES", 1024 * 1024),
  httpRequestTimeoutMs: intFromEnv("MCP_HTTP_REQUEST_TIMEOUT_MS", 15000)
};
