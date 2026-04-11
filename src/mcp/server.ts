import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "../config.js";
import { openReadonlyDb } from "../db/connection.js";
import { DocsRepository } from "../db/repository.js";
import { fetchToolSchema, handleFetch } from "./tools/fetch.js";
import { listTopicsToolSchema, handleListTopics } from "./tools/list-topics.js";
import { handleSearch, searchToolSchema } from "./tools/search.js";

export async function startMcpServer(): Promise<void> {
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
    async (args) => runSafe(() => handleSearch(repository, args))
  );

  server.tool(
    "fetch",
    "Получить документ по id.",
    fetchToolSchema,
    async (args) => runSafe(() => handleFetch(repository, args))
  );

  server.tool(
    "list_topics",
    "Получить список тем документации с количеством документов.",
    listTopicsToolSchema,
    async (args) => runSafe(() => handleListTopics(repository, args))
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = () => {
    db.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function runSafe<T>(fn: () => Promise<T>): Promise<T | { isError: true; content: Array<{ type: "text"; text: string }> }> {
  try {
    return await fn();
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: error instanceof Error ? error.message : String(error)
            },
            null,
            2
          )
        }
      ]
    };
  }
}
