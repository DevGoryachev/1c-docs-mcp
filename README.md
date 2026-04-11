# 1c-docs-mcp

Локальный MCP-сервер документации 1С для Codex Desktop.

## Назначение

Сервер предоставляет доступ к внутренней базе знаний по 1С через MCP tools.

Первая версия сервера предназначена для локальной работы в Codex Desktop и поддерживает только read-only сценарий.

## Что входит в v1

- transport: STDIO
- инструменты:
  - `search(query, topic?, top_k?)`
  - `fetch(id)`
  - `list_topics()`
- источник: `data/normalized/*.json`
- индекс: SQLite + FTS5

Сервер поддерживает 3 инструмента:

- `list_topics` — вернуть список тем и количество документов по каждой теме
- `search` — выполнить поиск по базе знаний
- `fetch` — вернуть полный документ по `id`

## Требования

- Node.js 20+
- SQLite c поддержкой FTS5 (в составе `better-sqlite3`)

## Быстрый старт

1. Установить зависимости:

```bash
npm install
```

2. Положить JSON-документы в `data/normalized/`.

3. Построить индекс:

```bash
npm run build-index
```

4. Собрать и запустить MCP-сервер:

```bash
npm run build
npm start
```

## Конфигурация окружения

См. `.env.example`:

- `MCP_DB_PATH` — путь к SQLite-файлу индекса.
- `MCP_DATA_DIR` — директория с JSON-документами.
- `MCP_DEFAULT_SEARCH_LIMIT` — лимит `search` по умолчанию.
- `MCP_MAX_SEARCH_LIMIT` — максимальный лимит `search`.

## Контракты инструментов v1

### `search(query, topic?, top_k?)`

Вход:
- `query: string` — обязательный полнотекстовый запрос.
- `topic?: string` — необязательный фильтр по topic-коду.
- `top_k?: number` — необязательный лимит результатов.

Выход:

```json
{
  "query": "как читать json",
  "topic": "json",
  "top_k": 10,
  "total": 2,
  "items": [
    {
      "id": "json.readwrite.001",
      "title": "Работа с JSON в 1С: чтение и запись",
      "source": "Хрусталева. Технологии интеграции 1С",
      "topic": "json",
      "snippet": " ... "
    }
  ]
}
```

### `fetch(id)`

Вход:
- `id: string` — идентификатор документа.

Выход при успехе:

```json
{
  "id": "json.readwrite.001",
  "found": true,
  "item": {
    "id": "json.readwrite.001",
    "title": "Работа с JSON в 1С: чтение и запись",
    "topic": "json",
    "text": " ... ",
    "source": "Хрусталева. Технологии интеграции 1С",
    "tags": ["json", "чтение", "запись", "http"],
    "priority": 0.95,
    "source_path": "data/normalized/chunk-001.json",
    "updated_at": null
  }
}
```

Выход, если не найдено:

```json
{
  "id": "unknown.id",
  "found": false,
  "item": null
}
```

### `list_topics()`

Вход:
- без параметров.

Выход:

```json
{
  "total_topics": 12,
  "items": [
    { "topic": "json", "docs_count": 2 },
    { "topic": "http_services", "docs_count": 2 }
  ]
}
```

## Важно

- Сервер работает только на чтение (`query_only` + `readonly` соединение к БД).
- Запись в SQLite выполняется только индексатором (`npm run build-index`).

## Ограничения v1

- только локальный запуск
- только STDIO transport
- только read-only
- без remote HTTP
- без OAuth
- без embeddings
- без resources
- без prompts

## Структура проекта

```text
1c-docs-mcp/
  data/
    normalized/        # нормализованные документы в JSON
    sqlite/            # локальная SQLite база / индекс
  scripts/
    smoke.ps1          # smoke test
  src/
    config.ts          # конфигурация проекта
    main.ts            # точка входа
    db/                # работа с SQLite
    indexer/           # построение индекса
    mcp/               # MCP server и tools
    types/             # типы TypeScript
  MCP_SETUP.md         # параметры подключения в Codex
  TOOLS_V1.md          # список tools v1
  TOOLS_CONTRACTS.md   # контракт ответов tools
  V1_STATUS.md         # статус рабочей версии
  SMOKE_TEST_V1.md     # smoke test


