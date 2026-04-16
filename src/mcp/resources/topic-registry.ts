export interface TopicResourceConfig {
  topic: string;
  uri: string;
  title: string;
}

export const TOPIC_RESOURCES: TopicResourceConfig[] = [
  { topic: "json", uri: "1c://docs/json", title: "1С: JSON" },
  { topic: "http_services", uri: "1c://docs/http_services", title: "1С: HTTP-сервисы" },
  { topic: "client_server", uri: "1c://docs/client_server", title: "1С: Клиент-сервер" },
  { topic: "skd", uri: "1c://docs/skd", title: "1С: СКД" },
  { topic: "queries", uri: "1c://docs/queries", title: "1С: Запросы" },
  { topic: "interface", uri: "1c://docs/interface", title: "1С: Интерфейс" },
  { topic: "team_rules", uri: "1c://docs/team_rules", title: "1С: Командные правила" },
  { topic: "exchange", uri: "1c://docs/exchange", title: "1С: Обмен данными" },
  { topic: "dev_rules", uri: "1c://docs/dev_rules", title: "1С: Правила разработки" },
  { topic: "interface_rules", uri: "1c://docs/interface_rules", title: "1С: Правила интерфейса" },
  { topic: "client_server_rules", uri: "1c://docs/client_server_rules", title: "1С: Клиент-серверные правила" },
  { topic: "client_server_antipatterns", uri: "1c://docs/client_server_antipatterns", title: "1С: Клиент-серверные анти-паттерны" },
  { topic: "form_patterns", uri: "1c://docs/form_patterns", title: "1С: Паттерны форм" },
  { topic: "http_api_rules", uri: "1c://docs/http_api_rules", title: "1С: Правила HTTP API" },
  { topic: "http_api_antipatterns", uri: "1c://docs/http_api_antipatterns", title: "1С: Анти-паттерны HTTP API" },
  { topic: "integration_patterns", uri: "1c://docs/integration_patterns", title: "1С: Паттерны интеграции" },
  { topic: "integration_antipatterns", uri: "1c://docs/integration_antipatterns", title: "1С: Анти-паттерны интеграции" },
  { topic: "exchange_antipatterns", uri: "1c://docs/exchange_antipatterns", title: "1С: Анти-паттерны обмена" },
  { topic: "query_patterns", uri: "1c://docs/query_patterns", title: "1С: Паттерны запросов" },
  { topic: "query_antipatterns", uri: "1c://docs/query_antipatterns", title: "1С: Анти-паттерны запросов" },
  { topic: "skd_core", uri: "1c://docs/skd_core", title: "1С: СКД (ядро)" },
  { topic: "skd_antipatterns", uri: "1c://docs/skd_antipatterns", title: "1С: Анти-паттерны СКД" },
  { topic: "json_patterns", uri: "1c://docs/json_patterns", title: "1С: JSON-паттерны" },
  { topic: "infostart_practices", uri: "1c://docs/infostart_practices", title: "1С: Практики Infostart" }
];

export const KNOWN_TOPICS = new Set(TOPIC_RESOURCES.map((item) => item.topic));
