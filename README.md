# 1c-docs-mcp

Локальный read-only MCP-сервер документации 1С на TypeScript/Node.js.

## Что входит в v1

- transport: STDIO
- инструменты:
  - `search(query, topic?, top_k?)`
  - `fetch(id)`
  - `list_topics()`
- источник: `data/normalized/*.json`
- индекс: SQLite + FTS5

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
      "topic": "json",
      "title": "Работа с JSON в 1С: чтение и запись",
      "snippet": " ... ",
      "score": -3.21
    }
  ]
}
```

Примечание:
- `score` — результат `bm25` из SQLite FTS5 (меньше = релевантнее).

### `fetch(id)`

Вход:
- `id: string` — идентификатор документа.

Выход при успехе:

```json
{
  "found": true,
  "doc": {
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
  "found": false
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
