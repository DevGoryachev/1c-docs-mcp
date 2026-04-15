# ARCHITECTURE

## Назначение

`1c-docs-mcp` — локальный MCP-сервер базы знаний 1С для Codex Desktop.
Сервер работает в режиме `read-only` и отдает:
- tools (`search`, `fetch`, `list_topics`)
- resources (по фиксированным topic URI)
- prompts (декларативные шаблоны задач)

## Текущая структура проекта

```text
1c-docs-mcp/
  data/
    normalized/        # JSON-чанки корпуса
    sqlite/            # SQLite индекс (docs.db)
  src/
    config.ts          # конфигурация путей/лимитов
    main.ts            # вход в MCP-сервер
    db/
      connection.ts    # соединение с SQLite
      repository.ts    # поиск/выборки по БД
      schema.sql       # схема docs + docs_fts
    indexer/
      normalize-input.ts
      build-index.ts   # rebuild индекса из data/normalized
    mcp/
      server.ts        # регистрация tools/resources/prompts
      tools/
        search.ts
        fetch.ts
        list-topics.ts
      resources/
        topics.ts      # fixed resources по темам
      prompts/
        knowledge-prompts.ts
  dist/                # сборка TypeScript
```

## Поток данных

1. Документы лежат в `data/normalized/*.json`.
2. `npm run build-index` читает JSON и пересобирает SQLite индекс.
3. MCP-сервер открывает SQLite в readonly-режиме.
4. Клиент (Codex) вызывает tools/resources/prompts.

## Реальные инструменты (tools)

- `search(query, topic?, top_k?)`
- `fetch(id)`
- `list_topics()`

Контракт tools не должен меняться без отдельного согласования.

## Реальные resources

- `1c://docs/json`
- `1c://docs/http_services`
- `1c://docs/client_server`
- `1c://docs/skd`
- `1c://docs/queries`
- `1c://docs/interface`
- `1c://docs/team_rules`
- `1c://docs/exchange`

Формат payload ресурса:
- `topic`
- `title`
- `summary`
- `items[]` (`id`, `title`)

## Реальные prompts

- `review_1c_code_against_standards`
- `design_http_service_1c`
- `suggest_skd_approach`
- `check_client_server_boundary`
- `optimize_1c_query`
- `integration_error_contract`

Промпты декларативные: сервер отдает шаблон сообщений и не запускает LLM внутри себя.

## Транспорт и режимы

- Транспорт: `STDIO`
- Сервер: локальный процесс Node.js
- База: SQLite (FTS5), readonly на стороне MCP runtime
- Изменение данных: только через indexer (`build-index`)

## Ограничения

- Нет embeddings
- Нет remote HTTP API
- Нет OAuth
- Нет write-операций через MCP tools
