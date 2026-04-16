# Tools v1

## 1. list_topics
Возвращает список тем и количество документов по каждой теме.

## 2. search
Параметры:
- query
- topic (опционально)
- top_k

Возвращает:
- query
- topic
- top_k
- total
- items

## 3. fetch
Параметры:
- id

Возвращает:
- id
- found
- item (`null`, если документ не найден; полный объект документа, если найден)

## 4. run_regression_queries
Параметры:
- top_k (опционально)

Возвращает:
- total_queries
- passed
- failed
- items (детали по каждой регрессионной проверке)
