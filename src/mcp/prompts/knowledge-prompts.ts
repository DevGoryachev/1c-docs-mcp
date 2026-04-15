import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerKnowledgePrompts(server: McpServer): void {
  server.registerPrompt(
    "review_1c_code_against_standards",
    {
      title: "Ревью кода 1С по стандартам",
      description: "Проверка кода 1С по базе знаний и внутренним правилам.",
      argsSchema: {
        code: z.string().min(1).describe("Фрагмент кода 1С для ревью"),
        context: z.string().optional().describe("Дополнительный контекст: объект, модуль, сценарий")
      }
    },
    ({ code, context }) => ({
      description: "Ревью кода 1С по стандартам и базе знаний MCP",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Выполни ревью кода 1С по базе знаний MCP и внутренним стандартам.",
              "Используй источники MCP: tools `list_topics`, `search`, `fetch` и resources `1c://docs/*`.",
              "Сначала проверь риски: клиент-серверная граница, запросы в цикле, права, побочные эффекты, интеграционные ошибки.",
              "Потом дай рекомендации в порядке: критично, желательно, стилистически.",
              context ? `Контекст: ${context}` : "",
              "Код:",
              code
            ]
              .filter((line) => line.length > 0)
              .join("\n")
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "design_http_service_1c",
    {
      title: "Проектирование HTTP-сервиса 1С",
      description: "Проектирование HTTP-сервиса 1С с JSON-контрактом и обработкой ошибок.",
      argsSchema: {
        goal: z.string().min(1).describe("Цель сервиса"),
        endpoint: z.string().min(1).describe("Маршрут/endpoint"),
        method: z.string().min(1).describe("HTTP-метод"),
        notes: z.string().optional().describe("Дополнительные ограничения или примеры")
      }
    },
    ({ goal, endpoint, method, notes }) => ({
      description: "Декларативный шаблон проектирования HTTP-сервиса 1С",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Спроектируй HTTP-сервис 1С с учетом JSON, кодов ответа, структуры ошибок и серверной логики.",
              "Опирайся на базу знаний MCP: `search/fetch/list_topics` и resources `1c://docs/http_services`, `1c://docs/json`, `1c://docs/team_rules`.",
              "Нужен результат: контракт запроса/ответа, таблица HTTP-кодов, единый JSON-контракт ошибок, валидация входа, журналирование, разделение транспортного и прикладного уровней.",
              `Цель: ${goal}`,
              `Endpoint: ${endpoint}`,
              `Метод: ${method}`,
              notes ? `Примечания: ${notes}` : ""
            ]
              .filter((line) => line.length > 0)
              .join("\n")
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "suggest_skd_approach",
    {
      title: "Подход к отчету через СКД",
      description: "Предложение архитектуры отчета СКД: данные, параметры, ресурсы, структура, настройки.",
      argsSchema: {
        report_goal: z.string().min(1).describe("Цель отчета"),
        data_sources: z.string().min(1).describe("Ожидаемые источники данных"),
        constraints: z.string().optional().describe("Ограничения и требования")
      }
    },
    ({ report_goal, data_sources, constraints }) => ({
      description: "Декларативный шаблон проектирования отчета на СКД",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Предложи подход к отчету через СКД.",
              "Используй базу знаний MCP: tools `search/fetch/list_topics` и resources `1c://docs/skd`, `1c://docs/queries`.",
              "Обязательно опиши: наборы данных, связи, параметры, ресурсы, структуру отчета, пользовательские и быстрые настройки.",
              "Отдельно укажи, что делается в конфигураторе, а что кодом.",
              `Цель отчета: ${report_goal}`,
              `Источники данных: ${data_sources}`,
              constraints ? `Ограничения: ${constraints}` : ""
            ]
              .filter((line) => line.length > 0)
              .join("\n")
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "check_client_server_boundary",
    {
      title: "Проверка клиент-серверной границы",
      description: "Проверка формы 1С на смешение клиентской и серверной логики.",
      argsSchema: {
        form_context: z.string().min(1).describe("Описание формы/сценария"),
        code: z.string().optional().describe("Фрагмент кода формы")
      }
    },
    ({ form_context, code }) => ({
      description: "Декларативный шаблон проверки клиент-серверной границы в форме",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Проверь, не смешана ли клиентская и серверная логика в форме 1С.",
              "Используй MCP-базу знаний: `search/fetch/list_topics` и resource `1c://docs/client_server`.",
              "Найди лишние серверные вызовы, повторные обращения, UI-логику на сервере и риск для веб-клиента.",
              "Дай рекомендации по минимизации переходов клиент↔сервер.",
              `Контекст формы: ${form_context}`,
              code ? `Код:\n${code}` : ""
            ]
              .filter((line) => line.length > 0)
              .join("\n")
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "optimize_1c_query",
    {
      title: "Оптимизация запроса 1С",
      description: "Проверка запроса 1С на производительность и читаемость.",
      argsSchema: {
        query_text: z.string().min(1).describe("Текст запроса 1С"),
        usage_context: z.string().optional().describe("Где и как выполняется запрос")
      }
    },
    ({ query_text, usage_context }) => ({
      description: "Декларативный шаблон оптимизации запроса 1С",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Проверь запрос 1С на временные таблицы, повторное получение данных, избыточные соединения и читаемость.",
              "Используй базу знаний MCP: tools `search/fetch/list_topics` и resources `1c://docs/queries`, `1c://docs/team_rules`.",
              "Предложи безопасные улучшения без радикального рефакторинга.",
              usage_context ? `Контекст выполнения: ${usage_context}` : "",
              "Запрос 1С:",
              query_text
            ]
              .filter((line) => line.length > 0)
              .join("\n")
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "integration_error_contract",
    {
      title: "Контракт ошибок интеграции",
      description: "Единый подход к ошибкам интеграции: HTTP-коды, JSON-контракт, прикладные и технические ошибки.",
      argsSchema: {
        integration_scope: z.string().min(1).describe("Сценарий интеграции"),
        current_format: z.string().optional().describe("Текущий формат ошибок (если есть)")
      }
    },
    ({ integration_scope, current_format }) => ({
      description: "Декларативный шаблон контракта ошибок интеграции",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Сформируй единый подход к ошибкам интеграции: HTTP-коды, JSON-контракт, прикладные и технические ошибки.",
              "Используй MCP-базу знаний: `search/fetch/list_topics` и resources `1c://docs/http_services`, `1c://docs/json`, `1c://docs/exchange`, `1c://docs/team_rules`.",
              "Нужен результат: таблица кодов, структура error JSON, правила логирования, правила ретраев и разграничение технических/бизнес-ошибок.",
              `Сценарий интеграции: ${integration_scope}`,
              current_format ? `Текущий формат: ${current_format}` : ""
            ]
              .filter((line) => line.length > 0)
              .join("\n")
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "review_1c_form_code",
    {
      title: "Ревью кода формы 1С",
      description: "Проверка формы 1С на клиент-серверные проблемы и лишние серверные вызовы.",
      argsSchema: {
        form_context: z.string().min(1).describe("Контекст формы и сценария"),
        code: z.string().min(1).describe("Код формы 1С")
      }
    },
    ({ form_context, code }) => ({
      description: "Декларативный шаблон ревью кода формы 1С",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Сделай ревью кода формы 1С.",
              "Используй sources MCP: resources `1c://docs/form_patterns`, `1c://docs/client_server_rules`, `1c://docs/client_server_antipatterns`, tools `search`, `fetch`, `list_topics`.",
              "Проверь клиент-серверную границу, лишние серверные вызовы, повторные обращения и риск для веб-клиента.",
              "Выдай замечания блоками: критично, желательно, стилистически.",
              `Контекст формы: ${form_context}`,
              "Код:",
              code
            ].join("\n")
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "review_http_api_contract_1c",
    {
      title: "Ревью контракта HTTP API 1С",
      description: "Проверка HTTP API 1С по кодам, JSON-ошибкам, Content-Type и валидации.",
      argsSchema: {
        endpoint_context: z.string().min(1).describe("Контекст endpoint и сценария"),
        code: z.string().optional().describe("Код HTTP-сервиса"),
        current_contract: z.string().optional().describe("Текущий контракт запроса/ответа")
      }
    },
    ({ endpoint_context, code, current_contract }) => ({
      description: "Декларативный шаблон ревью HTTP API контракта 1С",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Сделай ревью HTTP API на 1С.",
              "Используй resources `1c://docs/http_api_rules`, `1c://docs/http_api_antipatterns`, `1c://docs/integration_patterns` и tools `search`, `fetch`, `list_topics`.",
              "Проверь status codes, JSON-контракт ошибок, Content-Type, валидацию входа и разделение транспортной/бизнес-логики.",
              `Контекст endpoint: ${endpoint_context}`,
              current_contract ? `Текущий контракт: ${current_contract}` : "",
              code ? `Код:\n${code}` : ""
            ]
              .filter((line) => line.length > 0)
              .join("\n")
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "review_skd_design",
    {
      title: "Ревью архитектуры отчета СКД",
      description: "Проверка отчета СКД на архитектурные ошибки и anti-patterns.",
      argsSchema: {
        report_context: z.string().min(1).describe("Контекст отчета"),
        skd_description: z.string().optional().describe("Описание текущей схемы СКД"),
        query_text: z.string().optional().describe("Текст запроса, если есть")
      }
    },
    ({ report_context, skd_description, query_text }) => ({
      description: "Декларативный шаблон ревью архитектуры СКД",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Сделай ревью архитектуры отчета на СКД.",
              "Используй resources `1c://docs/skd_core`, `1c://docs/skd_antipatterns` и tools `search`, `fetch`, `list_topics`.",
              "Проверь параметры, ресурсы, варианты отчета, пользовательские настройки, читаемость и риски anti-patterns.",
              `Контекст отчета: ${report_context}`,
              skd_description ? `Описание СКД: ${skd_description}` : "",
              query_text ? `Текст запроса:\n${query_text}` : ""
            ]
              .filter((line) => line.length > 0)
              .join("\n")
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "review_query_1c",
    {
      title: "Ревью запроса 1С",
      description: "Проверка запроса 1С на избыточность и оптимальность.",
      argsSchema: {
        query_text: z.string().min(1).describe("Текст запроса 1С"),
        usage_context: z.string().optional().describe("Контекст выполнения запроса")
      }
    },
    ({ query_text, usage_context }) => ({
      description: "Декларативный шаблон ревью запроса 1С",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Сделай ревью запроса 1С.",
              "Используй resources `1c://docs/query_patterns`, `1c://docs/query_antipatterns` и tools `search`, `fetch`, `list_topics`.",
              "Проверь лишние поля, запросы в цикле, уместность временных таблиц, избыточные соединения и читаемость.",
              usage_context ? `Контекст: ${usage_context}` : "",
              "Запрос:",
              query_text
            ]
              .filter((line) => line.length > 0)
              .join("\n")
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "explain_1c_antipattern",
    {
      title: "Объяснение anti-pattern 1С",
      description: "Разбор анти-паттерна 1С и предложение корректной альтернативы.",
      argsSchema: {
        problem_description: z.string().min(1).describe("Описание проблемы или анти-паттерна"),
        code: z.string().optional().describe("Фрагмент кода")
      }
    },
    ({ problem_description, code }) => ({
      description: "Декларативный шаблон объяснения anti-pattern 1С",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Объясни анти-паттерн 1С и предложи правильную альтернативу.",
              "Используй anti-pattern resources: `1c://docs/client_server_antipatterns`, `1c://docs/http_api_antipatterns`, `1c://docs/integration_antipatterns`, `1c://docs/exchange_antipatterns`, `1c://docs/query_antipatterns`, `1c://docs/skd_antipatterns`.",
              "Дополнительно используй tools `search`, `fetch`, `list_topics` для точных ссылок на найденные элементы.",
              `Описание проблемы: ${problem_description}`,
              code ? `Код:\n${code}` : ""
            ]
              .filter((line) => line.length > 0)
              .join("\n")
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "design_integration_contract_1c",
    {
      title: "Проектирование интеграционного контракта 1С",
      description: "Проектирование request/response, ошибок, статус-кодов и нормализации форматов.",
      argsSchema: {
        integration_goal: z.string().min(1).describe("Цель интеграции"),
        transport_type: z.string().min(1).describe("Тип транспорта (HTTP, MQ, file, etc.)"),
        notes: z.string().optional().describe("Дополнительные требования")
      }
    },
    ({ integration_goal, transport_type, notes }) => ({
      description: "Декларативный шаблон проектирования интеграционного контракта 1С",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Спроектируй контракт интеграции между 1С и внешней системой.",
              "Используй resources `1c://docs/integration_patterns`, `1c://docs/http_api_rules`, `1c://docs/json_patterns`, `1c://docs/exchange` и tools `search`, `fetch`, `list_topics`.",
              "Определи request/response, модель ошибок, HTTP/транспортные статусы, границу нормализации внешнего формата и правила валидации.",
              `Цель: ${integration_goal}`,
              `Транспорт: ${transport_type}`,
              notes ? `Примечания: ${notes}` : ""
            ]
              .filter((line) => line.length > 0)
              .join("\n")
          }
        }
      ]
    })
  );
}
