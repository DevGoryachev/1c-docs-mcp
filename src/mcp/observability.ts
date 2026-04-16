export type OperationKind = "tool" | "resource" | "template" | "prompt";
export type OperationStatus = "ok" | "error";

type CounterKey =
  | "search_total"
  | "search_empty_total"
  | "fetch_total"
  | "fetch_not_found_total"
  | "resource_read_total"
  | "template_read_total"
  | "prompt_get_total"
  | "tool_calls_total";

type DurationBucket = {
  total_ms: number;
  count: number;
};

type MetricsStateInternal = {
  counters: Record<CounterKey, number>;
  durations: Record<string, DurationBucket>;
  search_topics: Record<string, number>;
  search_queries: Record<string, number>;
  updated_at: string;
};

const metricsState: MetricsStateInternal = {
  counters: {
    search_total: 0,
    search_empty_total: 0,
    fetch_total: 0,
    fetch_not_found_total: 0,
    resource_read_total: 0,
    template_read_total: 0,
    prompt_get_total: 0,
    tool_calls_total: 0
  },
  durations: {},
  search_topics: {},
  search_queries: {},
  updated_at: new Date().toISOString()
};

let requestSequence = 0;

export function nextRequestId(): string {
  requestSequence += 1;
  return `req-${Date.now()}-${requestSequence}`;
}

export function incrementCounter(counter: CounterKey): void {
  metricsState.counters[counter] += 1;
  touchUpdatedAt();
}

export function recordDuration(kind: OperationKind, name: string, durationMs: number): void {
  const key = `${kind}:${name}`;
  const bucket = metricsState.durations[key] ?? { total_ms: 0, count: 0 };
  bucket.total_ms += durationMs;
  bucket.count += 1;
  metricsState.durations[key] = bucket;
  touchUpdatedAt();
}

export function recordSearchTopic(topic: string | null): void {
  const key = topic && topic.trim().length > 0 ? topic.trim().toLowerCase() : "_all";
  metricsState.search_topics[key] = (metricsState.search_topics[key] ?? 0) + 1;
  touchUpdatedAt();
}

export function recordSearchQuery(query: string): void {
  const normalized = query.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    return;
  }
  metricsState.search_queries[normalized] = (metricsState.search_queries[normalized] ?? 0) + 1;
  touchUpdatedAt();
}

export function getMetricsSnapshot() {
  const avg_by_operation: Record<string, number> = {};
  const kindDuration: Record<OperationKind, { total: number; count: number }> = {
    tool: { total: 0, count: 0 },
    resource: { total: 0, count: 0 },
    template: { total: 0, count: 0 },
    prompt: { total: 0, count: 0 }
  };

  for (const [key, bucket] of Object.entries(metricsState.durations)) {
    const avg = bucket.count > 0 ? Number((bucket.total_ms / bucket.count).toFixed(3)) : 0;
    avg_by_operation[key] = avg;
    const kind = key.split(":")[0] as OperationKind;
    if (kindDuration[kind]) {
      kindDuration[kind].total += bucket.total_ms;
      kindDuration[kind].count += bucket.count;
    }
  }

  const avg_by_kind: Record<OperationKind, number> = {
    tool: kindDuration.tool.count > 0 ? Number((kindDuration.tool.total / kindDuration.tool.count).toFixed(3)) : 0,
    resource: kindDuration.resource.count > 0 ? Number((kindDuration.resource.total / kindDuration.resource.count).toFixed(3)) : 0,
    template: kindDuration.template.count > 0 ? Number((kindDuration.template.total / kindDuration.template.count).toFixed(3)) : 0,
    prompt: kindDuration.prompt.count > 0 ? Number((kindDuration.prompt.total / kindDuration.prompt.count).toFixed(3)) : 0
  };

  const top_topics = Object.entries(metricsState.search_topics)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([topic, count]) => ({ topic, count }));

  const top_queries = Object.entries(metricsState.search_queries)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 10)
    .map(([query, count]) => ({ query, count }));

  return {
    counters: { ...metricsState.counters },
    durations: {
      avg_by_kind,
      avg_by_operation
    },
    top_topics,
    top_queries,
    updated_at: metricsState.updated_at
  };
}

type LogEntry = {
  timestamp: string;
  request_id: string;
  kind: OperationKind;
  status: OperationStatus;
  duration_ms: number;
  name?: string;
  uri?: string;
  query?: string;
  topic?: string | null;
  results_count?: number;
  id?: string;
  found?: boolean;
  prompt_name?: string;
  metrics_state: ReturnType<typeof getMetricsSnapshot>;
};

export function logOperation(entry: Omit<LogEntry, "timestamp" | "metrics_state">): void {
  const fullEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
    metrics_state: getMetricsSnapshot()
  };
  process.stderr.write(`${JSON.stringify(fullEntry)}\n`);
}

function touchUpdatedAt(): void {
  metricsState.updated_at = new Date().toISOString();
}
