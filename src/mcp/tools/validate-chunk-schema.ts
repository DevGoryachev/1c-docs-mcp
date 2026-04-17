import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { config } from "../../config.js";
import { KNOWN_TOPICS } from "../resources/topic-registry.js";

export const validateChunkSchemaToolSchema = {
  path: z.string().min(1).optional().describe("Файл или директория для проверки. Если не указан, используется data/normalized."),
  verbose: z.boolean().optional().describe("Добавить расширенные диагностические детали.")
};

type ValidateChunkSchemaArgs = {
  path?: string;
  verbose?: boolean;
};

type ValidationStatus = "valid" | "invalid";

type ValidationResult = {
  file: string;
  chunk_id: string | null;
  status: ValidationStatus;
  errors: string[];
  warnings: string[];
};

type ParsedChunk = {
  result: ValidationResult;
  chunkId: string | null;
};

export interface ValidateChunkSchemaResult {
  total_files: number;
  valid_files: number;
  invalid_files: number;
  duplicate_ids: number;
  results: ValidationResult[];
}

export function validateChunkSchema(args: ValidateChunkSchemaArgs): ValidateChunkSchemaResult {
  const verbose = args.verbose === true;
  const targetPath = resolveTargetPath(args.path);
  const files = collectJsonFiles(targetPath);
  const parsed: ParsedChunk[] = files.map((filePath) => validateSingleFile(filePath, verbose));

  applyDuplicateIdErrors(parsed);

  const results = parsed
    .map((item) => item.result)
    .sort((left, right) => left.file.localeCompare(right.file));

  const invalidFiles = results.filter((item) => item.status === "invalid").length;
  const duplicateIds = countDuplicateIds(parsed.map((item) => item.chunkId));

  return {
    total_files: results.length,
    valid_files: results.length - invalidFiles,
    invalid_files: invalidFiles,
    duplicate_ids: duplicateIds,
    results
  };
}

export async function handleValidateChunkSchema(args: ValidateChunkSchemaArgs) {
  const result = validateChunkSchema(args);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
}

function resolveTargetPath(rawPath?: string): string {
  if (!rawPath) {
    return config.dataDir;
  }
  return path.resolve(process.cwd(), rawPath);
}

function collectJsonFiles(targetPath: string): string[] {
  if (!fs.existsSync(targetPath)) {
    return [targetPath];
  }

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    return targetPath.toLowerCase().endsWith(".json") ? [targetPath] : [];
  }

  const files: string[] = [];
  walkDir(targetPath, files);
  files.sort((left, right) => left.localeCompare(right));
  return files;
}

function walkDir(dirPath: string, outFiles: string[]): void {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, outFiles);
      continue;
    }
    if (entry.isFile() && fullPath.toLowerCase().endsWith(".json")) {
      outFiles.push(fullPath);
    }
  }
}

function validateSingleFile(filePath: string, verbose: boolean): ParsedChunk {
  const result: ValidationResult = {
    file: filePath,
    chunk_id: null,
    status: "valid",
    errors: [],
    warnings: []
  };

  if (!fs.existsSync(filePath)) {
    result.errors.push("File not found.");
    result.status = "invalid";
    return { result, chunkId: null };
  }

  let parsedJson: unknown;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    parsedJson = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`Invalid JSON: ${message}`);
    result.status = "invalid";
    return { result, chunkId: null };
  }

  if (typeof parsedJson !== "object" || parsedJson === null || Array.isArray(parsedJson)) {
    result.errors.push("Root JSON value must be an object.");
    result.status = "invalid";
    return { result, chunkId: null };
  }

  const chunk = parsedJson as Record<string, unknown>;
  validateRequiredStringField(chunk, "id", result);
  validateRequiredStringField(chunk, "title", result);
  validateRequiredStringField(chunk, "source", result);
  validateRequiredStringField(chunk, "topic", result);
  validateRequiredStringField(chunk, "text", result);

  result.chunk_id = typeof chunk.id === "string" ? chunk.id : null;

  if ("tags" in chunk) {
    if (!Array.isArray(chunk.tags)) {
      result.errors.push("Field 'tags' must be an array of strings.");
    } else {
      const notStrings = chunk.tags.some((item) => typeof item !== "string");
      if (notStrings) {
        result.errors.push("Field 'tags' must contain only strings.");
      } else if (chunk.tags.length === 0) {
        result.warnings.push("Field 'tags' is empty.");
      }
    }
  }

  if ("priority" in chunk) {
    if (typeof chunk.priority !== "number" || !Number.isFinite(chunk.priority)) {
      result.errors.push("Field 'priority' must be a number.");
    } else if (chunk.priority < 0 || chunk.priority > 1) {
      result.warnings.push(verbose
        ? `Field 'priority' is outside expected range [0..1]: ${chunk.priority}.`
        : "Field 'priority' is outside expected range [0..1].");
    }
  }

  const topic = typeof chunk.topic === "string" ? chunk.topic.trim() : "";
  if (topic.length > 0 && !KNOWN_TOPICS.has(topic)) {
    result.warnings.push(`Unknown topic '${topic}' (not in topic registry).`);
  }

  const text = typeof chunk.text === "string" ? chunk.text.trim() : "";
  if (text.length > 0 && text.length < 80) {
    result.warnings.push(verbose
      ? `Text is too short: ${text.length} chars.`
      : "Text is too short.");
  }

  if (result.errors.length > 0) {
    result.status = "invalid";
  }

  return {
    result,
    chunkId: result.chunk_id
  };
}

function validateRequiredStringField(chunk: Record<string, unknown>, fieldName: string, result: ValidationResult): void {
  const value = chunk[fieldName];
  if (typeof value !== "string") {
    result.errors.push(`Field '${fieldName}' is required and must be a string.`);
    return;
  }
  if (value.trim().length === 0) {
    result.errors.push(`Field '${fieldName}' must not be empty.`);
  }
}

function applyDuplicateIdErrors(parsed: ParsedChunk[]): void {
  const idToIndices = new Map<string, number[]>();
  for (let index = 0; index < parsed.length; index += 1) {
    const item = parsed[index];
    if (!item) {
      continue;
    }
    const chunkId = item.chunkId;
    if (!chunkId) {
      continue;
    }
    const list = idToIndices.get(chunkId) ?? [];
    list.push(index);
    idToIndices.set(chunkId, list);
  }

  for (const [chunkId, indices] of idToIndices.entries()) {
    if (indices.length < 2) {
      continue;
    }
    for (const idx of indices) {
      const parsedItem = parsed[idx];
      if (!parsedItem) {
        continue;
      }
      const result = parsedItem.result;
      result.errors.push(`Duplicate chunk id '${chunkId}'.`);
      result.status = "invalid";
    }
  }
}

function countDuplicateIds(chunkIds: Array<string | null>): number {
  const counts = new Map<string, number>();
  for (const id of chunkIds) {
    if (!id) {
      continue;
    }
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  let duplicates = 0;
  for (const count of counts.values()) {
    if (count > 1) {
      duplicates += 1;
    }
  }
  return duplicates;
}
