# TROUBLESHOOTING

## 1) npm в PowerShell

### Симптомы
- `npm` не запускается
- скрипты `npm run ...` не выполняются
- ошибки ExecutionPolicy/скриптов

### Проверка
```powershell
node -v
npm -v
Get-ExecutionPolicy
```

### Решение
1. Убедиться, что установлен Node.js 20+.
2. Запускать команды в PowerShell из корня проекта (`C:\1c-docs-mcp`).
3. Если блокируются скрипты PowerShell:
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```
или запускать конкретный скрипт через:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/smoke.ps1
```

## 2) git init / проблемы Git в рабочей папке

### Симптомы
- репозиторий не инициализирован
- ошибки ownership/safe.directory

### Проверка
```powershell
git status
```

### Решение
- если репозиторий не инициализирован:
```powershell
git init
```
- если ошибка `detected dubious ownership`:
```powershell
git config --global --add safe.directory C:/1c-docs-mcp
```

## 3) Старый MCP-процесс без resources/prompts

### Симптомы
- `resources/list` возвращает `Method not found (-32601)`
- `prompts/list` не показывает новые prompts
- tools есть, а resources/prompts как будто отсутствуют

### Причина
Codex держит старый процесс MCP-сервера после обновления кода.

### Решение
1. `npm run build`
2. Переподключить MCP в Codex:
   - отключить `1c-docs-mcp`
   - подключить снова
   - при необходимости перезапустить Codex Desktop
3. Повторно проверить:
   - список resources
   - список prompts

## 4) Пустой search (`total: 0`)

### Симптомы
- `search` отдает пустой `items`

### Что проверить
1. Индекс актуален:
```powershell
npm run build-index
```
2. Есть JSON-файлы в `data/normalized`.
3. Запрос не пустой после нормализации.
4. Topic-фильтр задан корректно (правильный код темы).

### Примечание
Даже при непустой базе узкий запрос + topic-фильтр может давать `total: 0`.

## 5) fetch(found=false)

### Симптомы
- `fetch` возвращает:
```json
{ "found": false, "item": null }
```

### Причины
- неверный `id`
- документ отсутствует в текущем индексе

### Решение
1. Найти корректный id через `search`.
2. Проверить тему через `list_topics`.
3. Пересобрать индекс:
```powershell
npm run build-index
```
4. Повторить `fetch` с найденным `id`.

## 6) Ошибка EPERM spawn при локальных тестах

### Симптомы
- `spawn EPERM` при запуске дочернего процесса (`tsx/esbuild` или MCP client smoke)

### Причина
Ограничения sandbox/прав доступа в среде запуска.

### Решение
- запускать команды в обычном локальном терминале вне sandbox;
- в агентной среде запрашивать повышенные права на команду.
