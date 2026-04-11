import type { SqliteDb } from "./connection.js";
import type { FetchResult, NormalizedDoc, SearchResult, TopicRow } from "../types/doc.js";

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

    const ftsQuery = buildFtsQuery(query);
    if (topic && topic.trim().length > 0) {
      const stmt = this.db.prepare(`
        SELECT
          d.id AS id,
          d.topic AS topic,
          d.title AS title,
          snippet(docs_fts, 3, '[', ']', ' … ', 20) AS snippet,
          bm25(docs_fts) AS score
        FROM docs_fts
        JOIN docs d ON d.id = docs_fts.id
        WHERE docs_fts MATCH ?
          AND d.topic = ?
        ORDER BY score
        LIMIT ?
      `);
      return stmt.all(ftsQuery, topic.trim(), safeLimit) as SearchResult[];
    }

    const stmt = this.db.prepare(`
      SELECT
        d.id AS id,
        d.topic AS topic,
        d.title AS title,
        snippet(docs_fts, 3, '[', ']', ' … ', 20) AS snippet,
        bm25(docs_fts) AS score
      FROM docs_fts
      JOIN docs d ON d.id = docs_fts.id
      WHERE docs_fts MATCH ?
      ORDER BY score
      LIMIT ?
    `);

    return stmt.all(ftsQuery, safeLimit) as SearchResult[];
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
}

function buildFtsQuery(input: string): string {
  const normalized = input.trim();
  if (!normalized) {
    throw new Error("Пустой поисковый запрос.");
  }
  const parts = normalized.split(/\s+/).filter((part) => part.length > 0);
  const escaped = parts.map((part) => `"${part.replaceAll("\"", "\"\"")}"*`);
  return escaped.join(" AND ");
}
