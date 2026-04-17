import { z } from "zod";
import type { DocsRepository } from "../../db/repository.js";
import { config } from "../../config.js";
import type { SearchItem } from "../../types/doc.js";
import { invalidInput } from "../errors.js";

export const searchToolSchema = {
  query: z.string().min(1).describe("Поисковый запрос"),
  topic: z.string().min(1).optional().describe("Код темы (topic)"),
  top_k: z.number().int().min(1).max(config.maxSearchLimit).optional().describe("Количество результатов")
};

type SearchToolArgs = {
  query: string;
  topic?: string;
  top_k?: number;
};

export async function handleSearch(repository: DocsRepository, args: SearchToolArgs) {
  if (!args.query || args.query.trim().length === 0) {
    throw invalidInput("Query must be non-empty.");
  }
  const safeTopK = Math.min(Math.max(args.top_k ?? config.defaultSearchLimit, 1), config.maxSearchLimit);
  let rows;
  try {
    rows = repository.search(args.query, args.topic, safeTopK);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("пустой")) {
      throw invalidInput("Query must contain letters or digits.");
    }
    throw error;
  }
  const items: SearchItem[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    source: parseSource(row.extraJson),
    topic: row.topic,
    snippet: row.snippet
  }));

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            query: args.query,
            topic: args.topic ?? null,
            top_k: safeTopK,
            total: items.length,
            items
          },
          null,
          2
        )
      }
    ]
  };
}

function parseSource(extraJson?: string): string {
  if (!extraJson) {
    return "";
  }
  try {
    const parsed = JSON.parse(extraJson) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return "";
    }
    const source = (parsed as Record<string, unknown>).source;
    return typeof source === "string" ? source : "";
  } catch {
    return "";
  }
}
