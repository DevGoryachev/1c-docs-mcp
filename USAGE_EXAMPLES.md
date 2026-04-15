# USAGE_EXAMPLES

## Базовые команды проекта

```powershell
npm install
npm run build
npm run build-index
npm start
```

## Примеры вызова tools в Codex

### search

Запрос к ассистенту:
```text
Вызови tool search из MCP-сервера 1c-docs-mcp.
Параметры:
- query: "JSON"
- top_k: 5
Покажи сырой результат инструмента.
```

### fetch

```text
Вызови tool fetch из MCP-сервера 1c-docs-mcp.
Параметры:
- id: "skd.schema.013"
Покажи сырой результат.
```

### list_topics

```text
Вызови tool list_topics из MCP-сервера 1c-docs-mcp.
Покажи сырой результат.
```

## Примеры resources

### Список доступных resources

```text
Покажи доступные resources из MCP-сервера 1c-docs-mcp.
```

### Чтение конкретного resource

```text
Открой resource 1c://docs/skd и покажи сырой результат.
```

## Примеры prompts

### Список prompts

```text
Покажи доступные prompts из MCP-сервера 1c-docs-mcp.
```

### Структура prompt

```text
Покажи структуру prompt review_1c_code_against_standards.
```

## Как принудительно заставить Codex показать использование MCP

Если ассистент отвечает обзором вместо реального tool call, используйте прямой запрос:

```text
Вызови tool <имя_tool> из MCP-сервера 1c-docs-mcp.
Параметры: ...
Покажи сырой результат инструмента.
```

Для resources:
```text
Открой resource <uri> и покажи сырой результат.
```

Для prompts:
```text
Покажи список prompts/структуру prompt <name> в сыром виде.
```

Ключевая фраза: `Покажи сырой результат` — она исключает пересказ и заставляет вернуть фактический ответ MCP.

## Проверка, что MCP действительно используется

Признаки реального использования MCP:
- ответ содержит структуру вызванного инструмента/ресурса/промпта;
- при ошибке приходит MCP-ошибка (`Method not found`, `Invalid params`, и т.д.);
- данные соответствуют текущей базе (`total`, `items`, `found`).
