import { z } from "zod";
import type { DocsRepository } from "../../db/repository.js";
import { config } from "../../config.js";

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
  const safeTopK = Math.min(Math.max(args.top_k ?? config.defaultSearchLimit, 1), config.maxSearchLimit);
  const rows = repository.search(args.query, args.topic, safeTopK);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            query: args.query,
            topic: args.topic ?? null,
            top_k: safeTopK,
            total: rows.length,
            items: rows
          },
          null,
          2
        )
      }
    ]
  };
}
