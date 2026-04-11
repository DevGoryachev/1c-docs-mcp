import { z } from "zod";
import type { DocsRepository } from "../../db/repository.js";
import type { FetchItem } from "../../types/doc.js";

export const fetchToolSchema = {
  id: z.string().min(1).describe("Идентификатор документа")
};

type FetchToolArgs = {
  id: string;
};

export async function handleFetch(repository: DocsRepository, args: FetchToolArgs) {
  const doc = repository.fetchById(args.id);
  const item = doc ? mapDocForResponse(doc) : null;

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            id: args.id,
            found: item !== null,
            item
          },
          null,
          2
        )
      }
    ]
  };
}

function mapDocForResponse(doc: {
  id: string;
  topic: string;
  title: string;
  content: string;
  extraJson?: string;
  sourcePath?: string;
  updatedAt?: string;
}): FetchItem {
  const extra = parseExtra(doc.extraJson);
  return {
    ...extra,
    id: doc.id,
    topic: doc.topic,
    title: doc.title,
    text: doc.content,
    source_path: doc.sourcePath ?? null,
    updated_at: doc.updatedAt ?? null
  };
}

function parseExtra(raw?: string): Record<string, unknown> {
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
