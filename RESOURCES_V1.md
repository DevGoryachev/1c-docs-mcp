# RESOURCES_V1

## Назначение

`resources` в `1c-docs-mcp` дают стабильный доступ к тематическим подборкам chunks по URI вида `1c://docs/<topic>`.

Ресурс публикуется в `resources/list` только если в корпусе есть хотя бы один документ с таким `topic`.

## Контракт ресурса

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

Если URI ресурса неизвестен или topic отсутствует в корпусе, сервер возвращает ошибку в текущем стиле:

`Ресурс не найден: <uri>`

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
