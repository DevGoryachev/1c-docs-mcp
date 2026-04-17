# Статус v1

## Что уже работает
- Локальный MCP-сервер поднимается через STDIO
- Сервер собирается командой `npm.cmd run build`
- Сервер запускается командой `npm.cmd run start`
- Codex Desktop подключается к серверу
- Tool `list_topics` работает
- Tool `search` работает
- Tool `fetch` работает

## Ограничения v1
- Корпус пока маленький
- Поиск пока буквальный
- Нет resources
- Нет prompts
- Нет remote HTTP
- Нет расширенной нормализации русского текста

## Tools v1
- search
- fetch
- list_topics

## Рабочая конфигурация подключения
- command: `C:\Program Files\nodejs\node.exe`
- args: `dist/main.js`
- cwd: `C:\1c-docs-mcp`

## Следующий этап
- smoke test
- стабилизация контрактов ответов
- README