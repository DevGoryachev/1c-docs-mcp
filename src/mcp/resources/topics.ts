import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, ListResourcesRequestSchema, McpError, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { DocsRepository } from "../../db/repository.js";

type TopicResourceConfig = {
  topic: string;
  uri: string;
  title: string;
};

const TOPIC_RESOURCES: TopicResourceConfig[] = [
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

const TOPIC_BY_URI = new Map<string, TopicResourceConfig>(TOPIC_RESOURCES.map((item) => [item.uri, item]));

export function registerTopicResources(server: McpServer, repository: DocsRepository): void {
  server.server.registerCapabilities({
    resources: {
      listChanged: false
    }
  });

  server.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: getAvailableResources(repository).map((item) => ({
      name: `docs_${item.topic}`,
      title: item.title,
      uri: item.uri,
      description: `Подборка документов по теме ${item.topic}`,
      mimeType: "application/json"
    }))
  }));

  server.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const topicResource = TOPIC_BY_URI.get(uri);
    if (!topicResource) {
      throw new McpError(ErrorCode.InvalidParams, `Ресурс не найден: ${uri}`);
    }
    const availableTopics = new Set(getAvailableResources(repository).map((item) => item.topic));
    if (!availableTopics.has(topicResource.topic)) {
      throw new McpError(ErrorCode.InvalidParams, `Ресурс не найден: ${uri}`);
    }

    const items = repository.listTopicItems(topicResource.topic).map((row) => ({
      id: row.id,
      title: row.title
    }));

    const payload = {
      topic: topicResource.topic,
      title: topicResource.title,
      summary: buildSummary(topicResource.topic, items.length),
      items
    };

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(payload, null, 2)
        }
      ]
    };
  });
}

function getAvailableResources(repository: DocsRepository): TopicResourceConfig[] {
  const existingTopics = new Set(repository.listTopics().map((row) => row.topic.trim().toLowerCase()));
  return TOPIC_RESOURCES.filter((item) => existingTopics.has(item.topic.toLowerCase()));
}

function buildSummary(topic: string, docsCount: number): string {
  if (docsCount === 0) {
    return `Тема ${topic}: документы не найдены.`;
  }
  return `Тема ${topic}: документов ${docsCount}.`;
}
