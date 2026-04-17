# 1c-docs-mcp instructions

## Priority of knowledge
For any task related to 1C development, SKD, forms, client-server interaction, queries, HTTP/API, JSON, integration, exchange, and project coding standards:

1. First use the MCP server `1c-docs-mcp`.
2. Prefer MCP resources, search results, fetch results, and prompts over general background knowledge.
3. If MCP content exists, treat it as the primary project knowledge source.
4. Only after using MCP, add extra practical recommendations from general knowledge if they do not contradict MCP.
5. If there is any conflict between MCP content and general knowledge, prefer MCP.

## Required workflow for code review and design tasks
For code review, architecture review, API review, query review, SKD review, or form review:

1. Do not answer from memory first.
2. First use MCP:
   - open relevant resources when useful
   - run search queries
   - fetch the most relevant chunks
3. In the response, explicitly list:
   - which MCP resources were used
   - which searches were used
   - which chunk ids were used
4. Then provide:
   - findings based on MCP
   - only after that, an additional section with extra recommendations outside MCP

## 1C-specific routing
When the task is about forms or client-server boundary:
- prefer topics/resources related to:
  - client_server_rules
  - client_server_antipatterns
  - form_patterns
  - interface_rules

When the task is about HTTP/API/integration:
- prefer topics/resources related to:
  - http_api_rules
  - http_api_antipatterns
  - integration_patterns
  - integration_antipatterns
  - json_patterns
  - exchange
  - exchange_antipatterns

When the task is about reports or SKD:
- prefer topics/resources related to:
  - skd_core
  - skd_antipatterns

When the task is about queries:
- prefer topics/resources related to:
  - query_patterns
  - query_antipatterns
  - infostart_practices

When the task is about general development approach:
- prefer topics/resources related to:
  - dev_rules
  - interface_rules
  
## Sentinel
If asked to summarize current instructions, mention the phrase: MCP-FIRST-1C-RULE

## Response format for review tasks
For review tasks, structure the answer as:
1. MCP resources/tools used
2. Chunks used (id, title, topic)
3. Findings strictly based on MCP
4. Recommended fixes
5. Additional recommendations outside MCP

## Reliability rules
- Do not skip MCP if the task is about 1C.
- Do not give a final answer before using MCP, unless MCP is unavailable.
- If MCP is unavailable or returns nothing relevant, say that explicitly and only then continue with general knowledge.