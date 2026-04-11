import { z } from "zod";
import type { DocsRepository } from "../../db/repository.js";

export const fetchToolSchema = {
  id: z.string().min(1).describe("Идентификатор документа")
};

type FetchToolArgs = {
  id: string;
};

export async function handleFetch(repository: DocsRepository, args: FetchToolArgs) {
  const doc = repository.fetchById(args.id);
  if (!doc) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              id: args.id,
              found: false
            },
            null,
            2
          )
        }
      ]
    };
  }

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            found: true,
            doc: mapDocForResponse(doc)
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
}) {
  const extra = parseExtra(doc.extraJson);
  return {
    id: doc.id,
    title: doc.title,
    topic: doc.topic,
    text: doc.content,
    source: stringOrNull(extra.source),
    tags: arrayOfStringOrNull(extra.tags),
    priority: numberOrNull(extra.priority),
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

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function arrayOfStringOrNull(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return items.length > 0 ? items : null;
}
