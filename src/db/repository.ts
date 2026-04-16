import type { SqliteDb } from "./connection.js";
import type { FetchResult, NormalizedDoc, SearchResult, TopicResourceItemRow, TopicRow } from "../types/doc.js";

export class DocsRepository {
  public constructor(private readonly db: SqliteDb) {}

  public ensureSchema(schemaSql: string): void {
    this.db.exec(schemaSql);
  }

  public rebuildIndex(docs: NormalizedDoc[]): number {
    this.db.exec("BEGIN");
    try {
      this.db.exec("DELETE FROM docs_fts");
      this.db.exec("DELETE FROM docs");

      const insertDoc = this.db.prepare(`
        INSERT INTO docs (id, topic, title, content, source_path, updated_at, extra_json)
        VALUES (@id, @topic, @title, @content, @sourcePath, @updatedAt, @extraJson)
      `);
      const insertFts = this.db.prepare(`
        INSERT INTO docs_fts (id, topic, title, content)
        VALUES (@id, @topic, @title, @content)
      `);

      for (const doc of docs) {
        insertDoc.run(doc);
        insertFts.run(doc);
      }

      this.db.exec("COMMIT");
      return docs.length;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  public search(query: string, topic: string | undefined, topK: number): SearchResult[] {
    const safeLimit = Math.max(topK, 1);
    const normalizedQuery = normalizeQuery(query);
    if (!normalizedQuery) {
      throw new Error("Пустой поисковый запрос.");
    }
    const queryTokens = splitTokens(normalizedQuery);
    if (queryTokens.length === 0) {
      throw new Error("Пустой поисковый запрос.");
    }

    const ftsQuery = buildFtsQuery(queryTokens);
    const normalizedTopic = normalizeTopic(topic);

    const limitCandidates = Math.max(safeLimit * 20, 100);
    const hasTopicFilter = normalizedTopic.length > 0;
    const stmt = this.db.prepare(`
      SELECT
        d.id AS id,
        d.topic AS topic,
        d.title AS title,
        d.content AS content,
        d.extra_json AS extraJson,
        bm25(docs_fts, 8.0, 4.0, 1.0) AS ftsScore
      FROM docs_fts
      JOIN docs d ON d.id = docs_fts.id
      WHERE docs_fts MATCH ?
        AND (? = '' OR lower(d.topic) = ?)
      ORDER BY bm25(docs_fts, 8.0, 4.0, 1.0)
      LIMIT ?
    `);

    const rows = stmt.all(ftsQuery, normalizedTopic, normalizedTopic, limitCandidates) as Array<{
      id: string;
      topic: string;
      title: string;
      content: string;
      extraJson?: string;
      ftsScore: number;
    }>;

    const ranked = rows
      .map((row) => rankRow(row, queryTokens))
      .filter((row) => row.score > 0)
      .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
      .slice(0, safeLimit);

    return ranked.map((row) => ({
      id: row.id,
      topic: row.topic,
      title: row.title,
      snippet: createSnippet(row.content, queryTokens),
      extraJson: row.extraJson,
      content: row.content
    }));
  }

  public fetchById(id: string): FetchResult | null {
    const stmt = this.db.prepare(`
      SELECT
        id,
        topic,
        title,
        content,
        source_path AS sourcePath,
        updated_at AS updatedAt,
        extra_json AS extraJson
      FROM docs
      WHERE id = ?
      LIMIT 1
    `);
    return (stmt.get(id) as FetchResult | undefined) ?? null;
  }

  public listTopics(): TopicRow[] {
    const stmt = this.db.prepare(`
      SELECT
        topic,
        COUNT(1) AS docsCount
      FROM docs
      GROUP BY topic
      ORDER BY docsCount DESC, topic ASC
    `);
    return stmt.all() as TopicRow[];
  }

  public listTopicItems(topic: string): TopicResourceItemRow[] {
    const normalizedTopic = normalizeTopic(topic);
    const stmt = this.db.prepare(`
      SELECT
        id,
        title,
        extra_json AS extraJson
      FROM docs
      WHERE lower(topic) = ?
      ORDER BY id ASC
    `);
    const rows = stmt.all(normalizedTopic) as Array<{
      id: string;
      title: string;
      extraJson?: string;
    }>;
    return rows
      .map((row) => ({
        id: row.id,
        title: row.title,
        priority: parseMeta(row.extraJson).priority
      }))
      .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0) || left.title.localeCompare(right.title) || left.id.localeCompare(right.id));
  }

  public listDocsCount(): number {
    const stmt = this.db.prepare("SELECT COUNT(1) AS total FROM docs");
    const row = stmt.get() as { total: number } | undefined;
    return row?.total ?? 0;
  }
}

type RankableRow = {
  id: string;
  topic: string;
  title: string;
  content: string;
  extraJson?: string;
  ftsScore: number;
};

function rankRow(row: RankableRow, tokens: string[]): RankableRow & { score: number } {
  const topicNorm = normalizeTopic(row.topic);
  const titleNorm = normalizeQuery(row.title);
  const contentNorm = normalizeQuery(row.content);
  const meta = parseMeta(row.extraJson);
  const tagsNorm = meta.tags.map((tag) => normalizeQuery(tag)).filter((tag) => tag.length > 0);

  let titleMatches = 0;
  let tagsMatches = 0;
  let topicMatches = 0;
  let contentMatches = 0;

  for (const token of tokens) {
    if (titleNorm.includes(token)) {
      titleMatches += 1;
    }
    if (tagsNorm.some((tag) => tag.includes(token))) {
      tagsMatches += 1;
    }
    if (topicNorm.includes(token)) {
      topicMatches += 1;
    }
    if (contentNorm.includes(token)) {
      contentMatches += 1;
    }
  }

  const fieldScore = titleMatches * 10 + tagsMatches * 7 + topicMatches * 6 + contentMatches * 3;
  const priorityWeight = meta.priority > 0 ? meta.priority * 2 : 0;
  const ftsWeight = Number.isFinite(row.ftsScore) ? -row.ftsScore : 0;
  const score = fieldScore + priorityWeight + ftsWeight;

  return {
    ...row,
    score
  };
}

function parseMeta(extraJson?: string): { tags: string[]; priority: number } {
  if (!extraJson) {
    return { tags: [], priority: 0 };
  }

  try {
    const parsed = JSON.parse(extraJson) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { tags: [], priority: 0 };
    }

    const record = parsed as Record<string, unknown>;
    const rawTags = record.tags;
    const rawPriority = record.priority;

    const tags = Array.isArray(rawTags) ? rawTags.filter((tag): tag is string => typeof tag === "string") : [];
    const priority = typeof rawPriority === "number" && Number.isFinite(rawPriority) ? rawPriority : 0;

    return { tags, priority };
  } catch {
    return { tags: [], priority: 0 };
  }
}

function createSnippet(content: string, tokens: string[]): string {
  const normalizedContent = content.replace(/\s+/g, " ").trim();
  if (!normalizedContent) {
    return "";
  }

  const lower = normalizedContent.toLowerCase();
  let bestIndex = -1;
  let bestToken = "";

  for (const token of tokens) {
    const idx = lower.indexOf(token);
    if (idx >= 0 && (bestIndex < 0 || idx < bestIndex)) {
      bestIndex = idx;
      bestToken = token;
    }
  }

  if (bestIndex < 0) {
    return trimWithEllipsis(normalizedContent, 200);
  }

  const contextLeft = 80;
  const contextRight = 120;
  const start = Math.max(0, bestIndex - contextLeft);
  const end = Math.min(normalizedContent.length, bestIndex + bestToken.length + contextRight);
  const prefix = start > 0 ? "… " : "";
  const suffix = end < normalizedContent.length ? " …" : "";

  let snippet = `${prefix}${normalizedContent.slice(start, end).trim()}${suffix}`;
  for (const token of tokens) {
    if (!token) {
      continue;
    }
    const escaped = escapeRegExp(token);
    const re = new RegExp(`(${escaped})`, "ig");
    snippet = snippet.replace(re, "[$1]");
  }

  return trimWithEllipsis(snippet, 240);
}

function trimWithEllipsis(input: string, maxLen: number): string {
  if (input.length <= maxLen) {
    return input;
  }
  return `${input.slice(0, Math.max(maxLen - 2, 0)).trim()} …`;
}

function buildFtsQuery(tokens: string[]): string {
  const escaped = tokens.map((token) => token.replaceAll("\"", "\"\""));
  const columns = ["title", "topic", "content"] as const;
  const perToken = escaped.map((token) => columns.map((column) => `${column}:"${token}"*`).join(" OR "));
  return perToken.map((part) => `(${part})`).join(" AND ");
}

function normalizeTopic(input: string | undefined): string {
  if (!input) {
    return "";
  }
  return input.trim().toLowerCase();
}

function splitTokens(input: string): string[] {
  const parts = input.split(" ").map((part) => part.trim()).filter((part) => part.length > 0);
  return [...new Set(parts)];
}

function normalizeQuery(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[-‐‑‒–—―]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
