# RELEASE_CHECKLIST

## Цель

Чек-лист перед релизом/передачей версии MCP-сервера `1c-docs-mcp` без изменения архитектуры.

## 1. Подготовка окружения

- [ ] Рабочая директория: `C:\1c-docs-mcp`
- [ ] Node.js 20+ доступен (`node -v`)
- [ ] npm доступен (`npm -v`)
- [ ] Зависимости установлены (`npm install`)

## 2. Сборка и индекс

- [ ] TypeScript сборка проходит:
```powershell
npm run build
```
- [ ] Индекс пересобирается:
```powershell
npm run build-index
```
- [ ] Сообщение о количестве документов и файлов без ошибок

## 3. Smoke MCP-сервера

- [ ] Сервер стартует:
```powershell
npm start
```
- [ ] Нет ошибок старта в stderr

## 4. Проверка tools (контракты не изменены)

- [ ] `list_topics` работает
- [ ] `search(query, topic?, top_k?)` работает
- [ ] `fetch(id)` возвращает `found=true/false` корректно
- [ ] Формат ответов tools соответствует текущему контракту

## 5. Проверка resources

- [ ] Доступен список resources
- [ ] Доступны URI:
  - `1c://docs/json`
  - `1c://docs/http_services`
  - `1c://docs/client_server`
  - `1c://docs/skd`
  - `1c://docs/queries`
  - `1c://docs/interface`
  - `1c://docs/team_rules`
  - `1c://docs/exchange`
- [ ] `readResource` возвращает `topic/title/summary/items[]`

## 6. Проверка prompts

- [ ] В `listPrompts` есть:
  - `review_1c_code_against_standards`
  - `design_http_service_1c`
  - `suggest_skd_approach`
  - `check_client_server_boundary`
  - `optimize_1c_query`
  - `integration_error_contract`
- [ ] `getPrompt` возвращает декларативный шаблон (без выполнения LLM на сервере)

## 7. Документация

- [ ] Актуальны:
  - `README.md`
  - `ARCHITECTURE.md`
  - `USAGE_EXAMPLES.md`
  - `TROUBLESHOOTING.md`
  - `RELEASE_CHECKLIST.md`

## 8. Проверка в Codex Desktop

- [ ] MCP подключение `1c-docs-mcp` активно
- [ ] После обновления кода сделан reconnect MCP (чтобы не остался старый процесс)
- [ ] Команда в чате с фразой `Покажи сырой результат` возвращает фактический MCP-output

## 9. Что не должно меняться в релизе

- [ ] Не менялись серверные contracts tools
- [ ] Не менялся transport (`STDIO`)
- [ ] Не менялся корпус `data/normalized` в рамках эксплуатационного релиза
- [ ] Не добавлялись побочные архитектурные изменения
