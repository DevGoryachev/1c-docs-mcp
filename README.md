# 1c-docs-mcp

Локальный MCP-сервер документации 1С для Codex Desktop.

## Назначение

Сервер предоставляет доступ к внутренней базе знаний по 1С через MCP tools.

Первая версия сервера предназначена для локальной работы в Codex Desktop и поддерживает read-only сценарий.

## Что входит в v1

- transport: STDIO + Streamable HTTP
- инструменты:
  - `search(query, topic?, top_k?)`
  - `fetch(id)`
  - `list_topics()`
- источник: `data/normalized/*.json`
- индекс: SQLite + FTS5

Сервер поддерживает 4 инструмента:

- `list_topics` — вернуть список тем и количество документов по каждой теме
- `search` — выполнить поиск по базе знаний
- `fetch` — вернуть полный документ по `id`
- `run_regression_queries` — прогнать фиксированный набор регрессионных запросов

Meta-resources:
- `1c://meta/server`
- `1c://meta/corpus`
- `1c://meta/topics`

Resource templates:
- `1c://docs/topic/{topic}`
- `1c://chunks/{id}`
- `1c://playbooks/{name}`
- `1c://standards/{area}`

Также сервер публикует стабильные resources по темам (показываются только если topic присутствует в корпусе):
- `1c://docs/json`
- `1c://docs/http_services`
- `1c://docs/client_server`
- `1c://docs/skd`
- `1c://docs/queries`
- `1c://docs/interface`
- `1c://docs/team_rules`
- `1c://docs/exchange`
- `1c://docs/dev_rules`
- `1c://docs/interface_rules`
- `1c://docs/client_server_rules`
- `1c://docs/client_server_antipatterns`
- `1c://docs/form_patterns`
- `1c://docs/http_api_rules`
- `1c://docs/http_api_antipatterns`
- `1c://docs/integration_patterns`
- `1c://docs/integration_antipatterns`
- `1c://docs/exchange_antipatterns`
- `1c://docs/query_patterns`
- `1c://docs/query_antipatterns`
- `1c://docs/skd_core`
- `1c://docs/skd_antipatterns`
- `1c://docs/json_patterns`
- `1c://docs/infostart_practices`

И поддерживает prompts:
- `review_1c_code_against_standards` — ревью кода 1С по стандартам.
- `design_http_service_1c` — проектирование HTTP-сервиса 1С.
- `suggest_skd_approach` — подход к отчету через СКД.
- `check_client_server_boundary` — проверка границы клиент/сервер.
- `optimize_1c_query` — ревью и оптимизация запроса 1С.
- `integration_error_contract` — единый контракт ошибок интеграции.
- `review_1c_form_code` — ревью кода формы 1С.
- `review_http_api_contract_1c` — ревью HTTP API контракта.
- `review_skd_design` — ревью архитектуры СКД.
- `review_query_1c` — ревью запроса 1С с anti-pattern проверками.
- `explain_1c_antipattern` — объяснение anti-pattern и альтернатива.
- `design_integration_contract_1c` — проектирование контракта интеграции.

Поиск `search` в текущей версии:
- нормализует запрос (`trim`, lowercase, схлопывание пробелов, замена тире/дефисов на пробел, удаление лишней пунктуации);
- ищет по `title`, `tags`, `topic`, `text`;
- ранжирует выше совпадения в `title/tags/topic`, чем в основном тексте;
- учитывает `priority` как дополнительный вес;
- формирует snippet вокруг релевантного совпадения.

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

Запуск по transport:

```bash
npm run start:stdio
npm run start:http
```

## Конфигурация окружения

См. `.env.example`:

- `MCP_DB_PATH` — путь к SQLite-файлу индекса.
- `MCP_DATA_DIR` — директория с JSON-документами.
- `MCP_DEFAULT_SEARCH_LIMIT` — лимит `search` по умолчанию.
- `MCP_MAX_SEARCH_LIMIT` — максимальный лимит `search`.
- `MCP_HTTP_HOST` — host для HTTP transport (по умолчанию `127.0.0.1`).
- `MCP_HTTP_PORT` — port для HTTP transport (по умолчанию `3000`).
- `MCP_HTTP_ENDPOINT` — MCP endpoint для HTTP transport (по умолчанию `/mcp`).
- `MCP_HTTP_AUTH_ENABLED` — включить bearer auth для HTTP transport (`true|false`, по умолчанию `false`).
- `MCP_HTTP_BEARER_TOKEN` — bearer token для HTTP transport (обязателен, если `MCP_HTTP_AUTH_ENABLED=true`).
- `MCP_PUBLIC_BASE_URL` — публичный base URL для shared/internal подключения (например `http://192.168.1.10:3000`).
- `MCP_HTTP_ALLOWED_ORIGINS` — CSV-список разрешенных `Origin` (например `http://localhost,http://127.0.0.1`).
- `MCP_HTTP_MAX_BODY_BYTES` — лимит тела HTTP-запроса для `/mcp` в байтах.
- `MCP_HTTP_REQUEST_TIMEOUT_MS` — базовый timeout HTTP-запроса для `/mcp` (POST/DELETE).

## Host Strategy

- `MCP_HTTP_HOST=127.0.0.1` (default): только локальный доступ (localhost-only).
- `MCP_HTTP_HOST=0.0.0.0` или внутренний IP/hostname: shared internal endpoint для команды.

Для shared режима рекомендуется:
- включить bearer auth;
- явно настроить `MCP_HTTP_ALLOWED_ORIGINS`;
- задать `MCP_PUBLIC_BASE_URL`.

## HTTP Bearer Auth

Auth применяется только к HTTP transport. `stdio` режим работает как раньше, без auth.

Пример env:

```bash
MCP_HTTP_AUTH_ENABLED=true
MCP_HTTP_BEARER_TOKEN=dev-secret-token
```

Пример HTTP запроса:

```bash
curl -X POST "http://127.0.0.1:3000/mcp" \
  -H "Authorization: Bearer dev-secret-token" \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"example","version":"1.0.0"}}}'
```

## Origin Policy

- Если `MCP_HTTP_ALLOWED_ORIGINS` задан, разрешаются только значения из allowlist.
- Если allowlist не задан, действует безопасный fallback для localhost-сценария.
- Запросы без `Origin` (типично для non-browser MCP clients) разрешаются.

## Health Endpoint

Для HTTP режима доступен healthcheck:

- `GET /health`
- `GET /ready`

`/health` показывает, что процесс жив.

`/ready` показывает готовность принимать рабочие запросы:
- `200`, если сервер готов и не находится в shutdown;
- `503`, если сервер не готов или уже начал graceful shutdown.

Пример `/health`:

```json
{
  "ok": true,
  "name": "1c-docs-mcp",
  "version": "0.1.0",
  "transport": "http_streamable",
  "auth_http_enabled": true,
  "uptime_sec": 12.345
}
```

Пример `/ready`:

```json
{
  "ready": true,
  "name": "1c-docs-mcp",
  "version": "0.1.0",
  "transport": "http_streamable"
}
```

`/health` и `/ready` не требуют MCP session id.

## HTTP Request Hardening

- `/mcp` POST ограничен по размеру тела (`MCP_HTTP_MAX_BODY_BYTES`).
- При превышении лимита сервер возвращает `413` с structured error.
- Для `/mcp` POST/DELETE применяется timeout (`MCP_HTTP_REQUEST_TIMEOUT_MS`), при превышении возвращается `408`.

## Graceful Shutdown

В HTTP режиме обрабатываются сигналы `SIGTERM` и `SIGINT`:
- сервер прекращает принимать новые HTTP запросы;
- закрывает HTTP listener и активные MCP сессии;
- пишет structured logs о старте и завершении shutdown;
- завершает процесс корректно.

## Docker

Сборка образа:

```bash
docker build -t 1c-docs-mcp:latest .
```

Запуск контейнера (HTTP режим):

```bash
docker run --rm -p 3000:3000 \
  -e MCP_HTTP_HOST=0.0.0.0 \
  -e MCP_HTTP_PORT=3000 \
  -e MCP_HTTP_ENDPOINT=/mcp \
  -e MCP_HTTP_AUTH_ENABLED=true \
  -e MCP_HTTP_BEARER_TOKEN=dev-secret-token \
  1c-docs-mcp:latest
```

В Docker образ добавлен `HEALTHCHECK`, который проверяет `GET /ready`.

## Team Shared HTTP Mode

Пример env для внутреннего shared режима:

```bash
MCP_HTTP_HOST=0.0.0.0
MCP_HTTP_PORT=3000
MCP_HTTP_ENDPOINT=/mcp
MCP_PUBLIC_BASE_URL=http://192.168.1.10:3000
MCP_HTTP_AUTH_ENABLED=true
MCP_HTTP_BEARER_TOKEN=team-internal-token
MCP_HTTP_ALLOWED_ORIGINS=http://localhost,http://127.0.0.1,http://mcp-client.local
MCP_HTTP_MAX_BODY_BYTES=1048576
MCP_HTTP_REQUEST_TIMEOUT_MS=15000
```

Пример remote MCP endpoint для другого разработчика:

```text
URL: http://192.168.1.10:3000/mcp
Authorization: Bearer team-internal-token
Accept: application/json, text/event-stream
Content-Type: application/json
```

Базовая последовательность проверки:

1. `initialize` (POST `/mcp` с Bearer token).
2. взять `mcp-session-id` из ответа.
3. `tools/list` (POST `/mcp` с Bearer token и `mcp-session-id`).

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

### `run_regression_queries(top_k?)`

Вход:
- `top_k?: number` — лимит результатов на каждый регрессионный запрос.

Выход:

```json
{
  "total_queries": 6,
  "passed": 6,
  "failed": 0,
  "items": [
    {
      "name": "http_error_contract",
      "query": "как правильно отдавать ошибку из HTTP-сервиса 1С",
      "topic": "http_api_rules",
      "top_k": 3,
      "total": 3,
      "top_ids": ["..."],
      "ok": true
    }
  ]
}
```

## Единый стиль ошибок

Во всех новых/обновленных местах используется единый формат:

```json
{
  "error": {
    "type": "invalid input | not found | internal error",
    "message": "..."
  }
}
```

## Важно

- Сервер работает только на чтение (`query_only` + `readonly` соединение к БД).
- Запись в SQLite выполняется только индексатором (`npm run build-index`).

## Ограничения v1

- локальный запуск
- dual transport: STDIO и Streamable HTTP
- только read-only
- без OAuth
- без embeddings
- без автоматического выполнения LLM внутри MCP-сервера

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
