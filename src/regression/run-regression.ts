import type { DocsRepository } from "../db/repository.js";
import { REGISTERED_PROMPT_NAMES } from "../mcp/prompts/knowledge-prompts.js";

type RegressionStatus = "passed" | "failed";

export interface RegressionResultItem {
  name: string;
  kind: "search" | "fetch" | "resource" | "template" | "prompt";
  status: RegressionStatus;
  details: Record<string, unknown>;
}

export interface RegressionRunResult {
  total: number;
  passed: number;
  failed: number;
  results: RegressionResultItem[];
}

type RunRegressionOptions = {
  verbose?: boolean;
};

const SEARCH_CHECKS = [
  "HTTP сервис",
  "СКД параметры",
  "200 OK при ошибке API",
  "временные таблицы когда использовать",
  "аналитический отчет СКД без ресурсов"
] as const;

const FETCH_CHECKS = [
  { id: "http_api_antipatterns.always_200.100", expectedFound: true },
  { id: "skd_antipatterns.no_resources_in_analytic_report.108", expectedFound: true },
  { id: "not_existing_id", expectedFound: false }
] as const;

const RESOURCE_CHECKS = [
  { uri: "1c://docs/http_api_rules", topic: "http_api_rules" },
  { uri: "1c://docs/query_antipatterns", topic: "query_antipatterns" },
  { uri: "1c://docs/skd_core", topic: "skd_core" }
] as const;

const TEMPLATE_CHECKS = [
  { uri: "1c://docs/topic/http_api_rules", kind: "topic" as const, topic: "http_api_rules" },
  { uri: "1c://chunks/http_api_antipatterns.always_200.100", kind: "chunk" as const, id: "http_api_antipatterns.always_200.100" }
] as const;

const PROMPT_CHECKS = [
  "review_http_api_contract_1c",
  "review_query_1c",
  "review_skd_design"
] as const;

export function runRegression(repository: DocsRepository, options?: RunRegressionOptions): RegressionRunResult {
  const verbose = options?.verbose === true;
  const topicStats = repository.listTopics();
  const topicToCount = new Map(topicStats.map((row) => [row.topic.trim().toLowerCase(), row.docsCount]));
  const results: RegressionResultItem[] = [];

  for (const query of SEARCH_CHECKS) {
    const rows = repository.search(query, undefined, 5);
    const passed = rows.length > 0;
    results.push({
      name: `search:${query}`,
      kind: "search",
      status: passed ? "passed" : "failed",
      details: verbose
        ? {
            query,
            total: rows.length,
            top_ids: rows.slice(0, 3).map((row) => row.id)
          }
        : {
            query,
            total: rows.length
          }
    });
  }

  for (const check of FETCH_CHECKS) {
    const doc = repository.fetchById(check.id);
    const found = doc !== null;
    const passed = found === check.expectedFound;
    results.push({
      name: `fetch:${check.id}`,
      kind: "fetch",
      status: passed ? "passed" : "failed",
      details: verbose
        ? {
            id: check.id,
            expected_found: check.expectedFound,
            found,
            topic: doc?.topic ?? null,
            title: doc?.title ?? null
          }
        : {
            id: check.id,
            expected_found: check.expectedFound,
            found
          }
    });
  }

  for (const check of RESOURCE_CHECKS) {
    const docsCount = topicToCount.get(check.topic) ?? 0;
    const passed = docsCount > 0;
    results.push({
      name: `resource:${check.uri}`,
      kind: "resource",
      status: passed ? "passed" : "failed",
      details: {
        uri: check.uri,
        topic: check.topic,
        docs_count: docsCount
      }
    });
  }

  for (const check of TEMPLATE_CHECKS) {
    if (check.kind === "topic") {
      const docsCount = topicToCount.get(check.topic) ?? 0;
      const passed = docsCount > 0;
      results.push({
        name: `template:${check.uri}`,
        kind: "template",
        status: passed ? "passed" : "failed",
        details: {
          uri: check.uri,
          topic: check.topic,
          docs_count: docsCount
        }
      });
      continue;
    }

    const found = repository.fetchById(check.id) !== null;
    results.push({
      name: `template:${check.uri}`,
      kind: "template",
      status: found ? "passed" : "failed",
      details: {
        uri: check.uri,
        id: check.id,
        found
      }
    });
  }

  for (const promptName of PROMPT_CHECKS) {
    const exists = REGISTERED_PROMPT_NAMES.includes(promptName);
    results.push({
      name: `prompt:${promptName}`,
      kind: "prompt",
      status: exists ? "passed" : "failed",
      details: {
        prompt: promptName,
        exists
      }
    });
  }

  const passed = results.filter((item) => item.status === "passed").length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    results
  };
}
