import { startMcpServerHttp } from "./mcp/server.js";

startMcpServerHttp().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Ошибка запуска MCP-сервера (http): ${message}\n`);
  process.exit(1);
});
