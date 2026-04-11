import path from "node:path";
import type { NormalizedDoc } from "../types/doc.js";

type JsonValue = null | string | number | boolean | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

const ID_FIELDS = ["id", "uid", "code", "slug"] as const;
const TOPIC_FIELDS = ["topic", "section", "category", "subsystem"] as const;
const TITLE_FIELDS = ["title", "name", "caption", "header"] as const;
const TEXT_FIELDS = ["content", "text", "body", "description", "markdown", "html"] as const;
const UPDATED_FIELDS = ["updatedAt", "updated_at", "date", "modifiedAt"] as const;

export function normalizeJsonFile(filePath: string, data: unknown): NormalizedDoc[] {
  const items = extractItems(data);
  const relSource = path.relative(process.cwd(), filePath).replaceAll("\\", "/");

  const docs: NormalizedDoc[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) {
        continue;
               }
  const normalized = normalizeItem(item, relSource, i);
    if (normalized) {
      docs.push(normalized);
    }
  }
  return docs;
}

function extractItems(data: unknown): JsonObject[] {
  if (Array.isArray(data)) {
    return data.filter(isObject);
  }
  if (isObject(data)) {
    const docsCandidate = data.docs;
    if (Array.isArray(docsCandidate)) {
      return docsCandidate.filter(isObject);
    }
    const itemsCandidate = data.items;
    if (Array.isArray(itemsCandidate)) {
      return itemsCandidate.filter(isObject);
    }
    const documentsCandidate = data.documents;
    if (Array.isArray(documentsCandidate)) {
      return documentsCandidate.filter(isObject);
    }
    return [data];
  }
  return [];
}

function normalizeItem(source: JsonObject, sourcePath: string, index: number): NormalizedDoc | null {
  const id = pickString(source, ID_FIELDS) ?? `${sourcePath}#${index + 1}`;
  const topic = pickString(source, TOPIC_FIELDS) ?? "Без темы";
  const title = pickString(source, TITLE_FIELDS) ?? `Документ ${index + 1}`;
  const content = pickText(source);
  if (!content) {
    return null;
  }

  const normalized: NormalizedDoc = {
    id,
    topic,
    title,
    content,
    sourcePath,
    updatedAt: pickString(source, UPDATED_FIELDS) ?? undefined
  };

  const extra = stripKnownFields(source);
  if (Object.keys(extra).length > 0) {
    normalized.extraJson = JSON.stringify(extra);
  }

  return normalized;
}

function pickText(source: JsonObject): string | null {
  const primary = pickString(source, TEXT_FIELDS);
  if (primary) {
    return primary;
  }

  const values = Object.values(source);
  const textChunks: string[] = [];
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      textChunks.push(value.trim());
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim().length > 0) {
          textChunks.push(item.trim());
        }
      }
    }
  }

  if (textChunks.length === 0) {
    return null;
  }
  return textChunks.join("\n\n");
}

function pickString(source: JsonObject, fields: readonly string[]): string | null {
  for (const field of fields) {
    const value = source[field];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function stripKnownFields(source: JsonObject): JsonObject {
  const skip = new Set<string>([
    ...ID_FIELDS,
    ...TOPIC_FIELDS,
    ...TITLE_FIELDS,
    ...TEXT_FIELDS,
    ...UPDATED_FIELDS
  ]);

  const result: JsonObject = {};
  for (const [key, value] of Object.entries(source)) {
    if (!skip.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
