Нужно создать локальный MCP-сервер документации 1С.

Первая версия:
- TypeScript + Node.js
- read-only
- transport: STDIO
- инструменты:
  - search
  - fetch
  - list_topics

Источник данных:
- data/normalized/*.json

Хранилище:
- SQLite + FTS5