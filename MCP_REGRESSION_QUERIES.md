# MCP_REGRESSION_QUERIES

## Назначение

Фиксированный набор регрессионных поисковых запросов для быстрой проверки релевантности индекса и стабильности `search`.

## Где используется

- MCP tool: `run_regression_queries`
- CLI: `npm run regression`
- smoke: `npm run smoke` (включает regression шаг)

## Набор запросов v1

1. `http_error_contract`
   - query: `http json content-type`
   - topic: `http_api_rules`

2. `client_server_calls`
   - query: `серверный вызов`
   - topic: `client_server_rules`

3. `json_read_write`
   - query: `json`
   - topic: `json_patterns`

4. `skd_parameters`
   - query: `параметр`
   - topic: `skd_core`

5. `query_temp_tables`
   - query: `временные таблицы`
   - topic: `query_patterns`

6. `rights_visibility`
   - query: `интерфейс команды разделы`
   - topic: `interface_rules`

## Критерий прохождения

- каждый запрос возвращает минимум 1 результат (`ok=true`);
- итог `failed = 0`.

## Формат результата

```json
{
  "total_queries": 6,
  "passed": 6,
  "failed": 0,
  "items": [
    {
      "name": "http_error_contract",
      "query": "...",
      "topic": "http_api_rules",
      "top_k": 3,
      "total": 3,
      "top_ids": ["..."],
      "ok": true
    }
  ]
}
```
