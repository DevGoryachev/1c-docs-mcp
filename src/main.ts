import { startMcpServer } from "./mcp/server.js";

startMcpServer().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Ошибка запуска MCP-сервера: ${message}\n`);
  process.exit(1);
});
