import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { openWritableDb } from "../db/connection.js";
import { DocsRepository } from "../db/repository.js";
import { normalizeJsonFile } from "./normalize-input.js";

const SCHEMA_SQL_PATH = path.resolve(process.cwd(), "src/db/schema.sql");

export interface RebuildIndexResult {
  chunksProcessed: number;
  filesProcessed: number;
  topicsProcessed: number;
  indexPath: string;
}

export function rebuildCorpusIndex(): RebuildIndexResult {
  const db = openWritableDb();
  const repository = new DocsRepository(db);

  try {
    const schemaSql = fs.readFileSync(SCHEMA_SQL_PATH, "utf8");
    repository.ensureSchema(schemaSql);

    const files = listJsonFiles(config.dataDir);
    const docs = files.flatMap((filePath) => loadDocs(filePath));
    const indexed = repository.rebuildIndex(docs);
    const topicsProcessed = repository.listTopics().length;

    return {
      chunksProcessed: indexed,
      filesProcessed: files.length,
      topicsProcessed,
      indexPath: config.dbPath
    };
  } finally {
    db.close();
  }
}

function loadDocs(filePath: string) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return normalizeJsonFile(filePath, parsed);
}

function listJsonFiles(rootDir: string): string[] {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const queue = [rootDir];
  const results: string[] = [];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) {
      continue;
    }
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
        results.push(fullPath);
      }
    }
  }

  return results.sort((left, right) => left.localeCompare(right));
}
