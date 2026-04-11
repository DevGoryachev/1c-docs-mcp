# Smoke test v1

## list_topics
- [ ] возвращает total_topics
- [ ] возвращает items
- [ ] возвращает topic и docs_count

## search
- [ ] search("JSON") возвращает корректный JSON
- [ ] search("HTTP") возвращает корректный JSON
- [ ] search("СКД") возвращает корректный JSON
- [ ] search с topic-фильтром не ломает формат ответа

## fetch
- [ ] fetch("not_existing_id") возвращает found=false
- [ ] fetch(real_id) возвращает found=true и полный объект