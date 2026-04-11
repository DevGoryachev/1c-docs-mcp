# Contracts v1

## search

### input
- query: string
- topic?: string | null
- top_k?: number

### output
- query: string
- topic: string | null
- top_k: number
- total: number
- items: SearchItem[]

### SearchItem
- id: string
- title: string
- source: string
- topic: string
- snippet: string

---

## fetch

### input
- id: string

### output
- id: string
- found: boolean
- item: FetchItem | null

### FetchItem
- полный объект документа (все поля документа из индекса)
- включает базовые поля:
  - id: string
  - title: string
  - topic: string
  - text: string
  - source_path: string | null
  - updated_at: string | null
- дополнительные поля из исходного JSON (например `source`, `tags`, `priority`) сохраняются в `item`

---

## list_topics

### output
- total_topics: number
- items: TopicItem[]

### TopicItem
- topic: string
- docs_count: number
