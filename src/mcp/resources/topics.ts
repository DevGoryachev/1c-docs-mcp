import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { config } from "../../config.js";
import type { DocsRepository } from "../../db/repository.js";
import fs from "node:fs";
import { TOPIC_RESOURCES, type TopicResourceConfig } from "./topic-registry.js";
import { asMcpInvalidParams } from "../errors.js";
import { getMetricsSnapshot, incrementCounter, logOperation, nextRequestId, recordDuration } from "../observability.js";

type ResourceTemplate = {
  name: string;
  title: string;
  uriTemplate: string;
  description: string;
};


const META_RESOURCES = [
  { name: "meta_server", title: "1С: Server Meta", uri: "1c://meta/server", description: "Метаданные MCP-сервера" },
  { name: "meta_corpus", title: "1С: Corpus Meta", uri: "1c://meta/corpus", description: "Сводка по корпусу документации" },
  { name: "meta_topics", title: "1С: Topics Meta", uri: "1c://meta/topics", description: "Список topic и их покрытие" },
  { name: "meta_metrics", title: "1С: Metrics Meta", uri: "1c://meta/metrics", description: "Текущее состояние in-memory metrics" }
] as const;

const RESOURCE_TEMPLATES: ResourceTemplate[] = [
  {
    name: "docs_topic",
    title: "Docs by Topic",
    uriTemplate: "1c://docs/topic/{topic}",
    description: "Динамический resource по topic-коду"
  },
  {
    name: "chunk_by_id",
    title: "Chunk by ID",
    uriTemplate: "1c://chunks/{id}",
    description: "Динамический resource конкретного чанка"
  },
  {
    name: "playbook_by_name",
    title: "Playbook by Name",
    uriTemplate: "1c://playbooks/{name}",
    description: "Динамический resource плейбука"
  },
  {
    name: "standards_by_area",
    title: "Standards by Area",
    uriTemplate: "1c://standards/{area}",
    description: "Динамический resource стандартов по области"
  }
];

const PLAYBOOKS: Record<string, { title: string; description: string; topics: string[] }> = {
  review: {
    title: "Код-ревью 1С",
    description: "Проверка кода на риски клиент-серверной границы, запросы в цикле, права и побочные эффекты.",
    topics: ["dev_rules", "client_server_rules", "query_patterns", "query_antipatterns", "interface_rules"]
  },
  integration: {
    title: "Интеграционный контракт",
    description: "Проектирование и ревью HTTP/JSON интеграции, модели ошибок и валидации.",
    topics: ["http_api_rules", "http_api_antipatterns", "integration_patterns", "integration_antipatterns", "json_patterns", "exchange"]
  },
  skd: {
    title: "Отчеты СКД",
    description: "Проектирование и ревью отчетов СКД, параметров, ресурсов и пользовательских настроек.",
    topics: ["skd_core", "skd_antipatterns", "query_patterns"]
  }
};

const STANDARDS_AREAS: Record<string, { title: string; topics: string[] }> = {
  forms: {
    title: "Стандарты форм и клиент-серверной границы",
    topics: ["form_patterns", "client_server_rules", "client_server_antipatterns", "interface_rules"]
  },
  api: {
    title: "Стандарты HTTP API и интеграций",
    topics: ["http_api_rules", "http_api_antipatterns", "integration_patterns", "integration_antipatterns", "json_patterns", "exchange"]
  },
  queries: {
    title: "Стандарты запросов 1С",
    topics: ["query_patterns", "query_antipatterns", "infostart_practices"]
  },
  skd: {
    title: "Стандарты СКД",
    topics: ["skd_core", "skd_antipatterns"]
  },
  general: {
    title: "Общие стандарты разработки",
    topics: ["dev_rules", "interface_rules", "team_rules"]
  }
};

const TOPIC_BY_URI = new Map<string, TopicResourceConfig>(TOPIC_RESOURCES.map((item) => [item.uri, item]));
const STATIC_TOOLS = ["search", "fetch", "list_topics", "run_regression_queries", "validate_chunk_schema", "rebuild_corpus_index"] as const;

export function registerTopicResources(server: McpServer, repository: DocsRepository): void {
  server.server.registerCapabilities({
    resources: {
      listChanged: false
    }
  });

  server.server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const topicResources = getAvailableResources(repository).map((item) => ({
      name: `docs_${item.topic}`,
      title: item.title,
      uri: item.uri,
      description: `Подборка документов по теме ${item.topic}`,
      mimeType: "application/json"
    }));

    return {
      resources: [
        ...META_RESOURCES.map((item) => ({
          name: item.name,
          title: item.title,
          uri: item.uri,
          description: item.description,
          mimeType: "application/json"
        })),
        ...topicResources
      ]
    };
  });

  server.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: RESOURCE_TEMPLATES.map((template) => ({
      name: template.name,
      title: template.title,
      uriTemplate: template.uriTemplate,
      description: template.description,
      mimeType: "application/json"
    }))
  }));

  server.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const requestId = nextRequestId();
    const startedAt = Date.now();
    const kind = detectReadKind(uri);
    const name = uri;

    let status: "ok" | "error" = "ok";
    try {
      if (kind === "resource") {
        incrementCounter("resource_read_total");
      } else {
        incrementCounter("template_read_total");
      }

      if (uri === "1c://meta/server") {
        const availableResources = getAvailableResources(repository);
        return jsonResource(uri, {
          name: config.serverName,
          version: config.serverVersion,
          transports: [...config.supportedTransports],
          supported_transports: [...config.supportedTransports],
          auth_http_enabled: config.httpAuthEnabled,
          public_base_url: config.publicBaseUrl,
          capabilities: {
            tools: true,
            resources: true,
            prompts: true,
            resource_templates: true
          },
          prompts_count: 12,
          resources_count: META_RESOURCES.length + availableResources.length,
          tools_count: STATIC_TOOLS.length
        });
      }

      if (uri === "1c://meta/corpus") {
        const topicRows = repository.listTopics();
        const chunksCount = repository.listDocsCount();
        return jsonResource(uri, {
          chunks_count: chunksCount,
          topics_count: topicRows.length,
          topics: topicRows.map((row) => row.topic),
          last_index_build: readLastIndexBuild(),
          corpus_version: null
        });
      }

      if (uri === "1c://meta/topics") {
        const topicRows = repository.listTopics();
        return jsonResource(uri, {
          total_topics: topicRows.length,
          items: topicRows.map((row) => ({
            topic: row.topic,
            docs_count: row.docsCount
          }))
        });
      }

      if (uri === "1c://meta/metrics") {
        return jsonResource(uri, getMetricsSnapshot());
      }

      const topicResource = TOPIC_BY_URI.get(uri);
      if (topicResource) {
        return topicPayload(uri, topicResource.topic, topicResource.title, repository);
      }

      const dynamicTopic = matchTemplate(uri, "1c://docs/topic/");
      if (dynamicTopic) {
        return topicPayload(uri, decodeURIComponent(dynamicTopic), `1С: Тема ${decodeURIComponent(dynamicTopic)}`, repository);
      }

      const chunkId = matchTemplate(uri, "1c://chunks/");
      if (chunkId) {
        const decodedId = decodeURIComponent(chunkId);
        const doc = repository.fetchById(decodedId);
        const item = doc ? mapChunkItem(doc) : null;
        return jsonResource(uri, {
          id: decodedId,
          found: item !== null,
          item
        });
      }

      const playbookName = matchTemplate(uri, "1c://playbooks/");
      if (playbookName) {
        const decodedName = decodeURIComponent(playbookName).toLowerCase();
        const playbook = PLAYBOOKS[decodedName];
        if (!playbook) {
          throw asMcpInvalidParams("not_found", `Playbook not found: ${decodedName}`);
        }
        return jsonResource(uri, {
          name: decodedName,
          title: playbook.title,
          description: playbook.description,
          topics: playbook.topics
        });
      }

      const areaName = matchTemplate(uri, "1c://standards/");
      if (areaName) {
        const decodedArea = decodeURIComponent(areaName).toLowerCase();
        const area = STANDARDS_AREAS[decodedArea];
        if (!area) {
          throw asMcpInvalidParams("not_found", `Standards area not found: ${decodedArea}`);
        }
        return jsonResource(uri, {
          area: decodedArea,
          title: area.title,
          topics: area.topics
        });
      }

      throw asMcpInvalidParams("not_found", `Resource not found: ${uri}`);
    } catch (error) {
      status = "error";
      throw error;
    } finally {
      const durationMs = Date.now() - startedAt;
      if (durationMs >= 0) {
        recordDuration(kind, name, durationMs);
      }
      logOperation({
        request_id: requestId,
        kind,
        uri,
        status,
        duration_ms: durationMs
      });
    }
  });
}

function detectReadKind(uri: string): "resource" | "template" {
  if (
    uri.startsWith("1c://docs/topic/")
    || uri.startsWith("1c://chunks/")
    || uri.startsWith("1c://playbooks/")
    || uri.startsWith("1c://standards/")
  ) {
    return "template";
  }
  return "resource";
}

function topicPayload(uri: string, topic: string, title: string, repository: DocsRepository): { contents: Array<{ uri: string; mimeType: string; text: string }> } {
  const normalizedTopic = topic.trim().toLowerCase();
  if (!normalizedTopic) {
    throw asMcpInvalidParams("invalid_input", "Topic must be non-empty.");
  }

  const availableTopics = new Set(repository.listTopics().map((row) => row.topic.trim().toLowerCase()));
  if (!availableTopics.has(normalizedTopic)) {
    throw asMcpInvalidParams("not_found", `Topic not found: ${topic}`);
  }

  const items = repository.listTopicItems(normalizedTopic).map((row) => ({
    id: row.id,
    title: row.title
  }));

  return jsonResource(uri, {
    topic: normalizedTopic,
    title,
    summary: buildSummary(normalizedTopic, items.length),
    items
  });
}

function jsonResource(uri: string, payload: unknown): { contents: Array<{ uri: string; mimeType: string; text: string }> } {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

function matchTemplate(uri: string, prefix: string): string | null {
  if (!uri.startsWith(prefix)) {
    return null;
  }
  const rest = uri.slice(prefix.length);
  return rest.length > 0 ? rest : null;
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

function readLastIndexBuild(): string | null {
  try {
    const stat = fs.statSync(config.dbPath);
    return stat.mtime.toISOString();
  } catch {
    return null;
  }
}

function mapChunkItem(doc: {
  id: string;
  topic: string;
  title: string;
  content: string;
  extraJson?: string;
}): {
  id: string;
  title: string;
  source: string;
  topic: string;
  tags: string[];
  text: string;
  priority: number | null;
} {
  const extra = parseExtraJson(doc.extraJson);
  const tags = Array.isArray(extra.tags) ? extra.tags.filter((item): item is string => typeof item === "string") : [];
  const source = typeof extra.source === "string" ? extra.source : "";
  const priority = typeof extra.priority === "number" && Number.isFinite(extra.priority) ? extra.priority : null;

  return {
    id: doc.id,
    title: doc.title,
    source,
    topic: doc.topic,
    tags,
    text: doc.content,
    priority
  };
}

function parseExtraJson(raw?: string): Record<string, unknown> {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
