# RESOURCES_V1

## Назначение

`resources` в `1c-docs-mcp` дают доступ к:
- стабильным тематическим подборкам chunks по URI `1c://docs/<topic>`;
- meta ресурсам `1c://meta/*`;
- динамическим ресурсам через templates.

Ресурс публикуется в `resources/list` только если в корпусе есть хотя бы один документ с таким `topic`.

## Контракт тематического ресурса

Каждый `resources/read` возвращает JSON:

- `topic`
- `title`
- `summary`
- `items[]`

Где элемент `items`:
- `id`
- `title`

`summary` строится детерминированно: `Тема <topic>: документов <N>.`

## Сортировка items

Сортировка стабильная:
1. по `priority` (по убыванию);
2. затем по `title` (по возрастанию);
3. затем по `id` (по возрастанию).

## Ошибки

Единый стиль ошибки:

```json
{
  "error": {
    "type": "invalid input | not found | internal error",
    "message": "..."
  }
}
```

## Meta resources

- `1c://meta/server` — метаданные сервера, список tools/resources/templates.
- `1c://meta/corpus` — сводка по корпусу (total docs/topics).
- `1c://meta/topics` — список доступных topics и их URI.

## Resource templates

- `1c://docs/topic/{topic}` — динамический тематический ресурс.
- `1c://chunks/{id}` — динамический ресурс документа по `id`.
- `1c://playbooks/{name}` — ресурс плейбука (review/integration/skd).
- `1c://standards/{area}` — ресурс стандартов по области (forms/api/queries/skd/general).

## Список поддерживаемых URI

Базовые:
- `1c://docs/json`
- `1c://docs/http_services`
- `1c://docs/client_server`
- `1c://docs/skd`
- `1c://docs/queries`
- `1c://docs/interface`
- `1c://docs/team_rules`
- `1c://docs/exchange`

Расширенные:
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
