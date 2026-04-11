Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "1) Проверка Node.js"
node --version

Write-Host "2) Сборка TypeScript"
npm run build

Write-Host "3) Проверка наличия индекса"
if (Test-Path "data/sqlite/docs.db") {
  Write-Host "Индекс найден: data/sqlite/docs.db"
} else {
  Write-Warning "Индекс не найден. Выполните: npm run index"
}
