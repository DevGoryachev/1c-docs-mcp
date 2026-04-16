import { z } from "zod";
import { openReadonlyDb } from "../../db/connection.js";
import { DocsRepository } from "../../db/repository.js";
import { rebuildCorpusIndex } from "../../indexer/rebuild-index.js";
import { runRegression } from "../../regression/run-regression.js";
import { config } from "../../config.js";
import { validateChunkSchema } from "./validate-chunk-schema.js";

export const rebuildCorpusIndexToolSchema = {
  validate_first: z.boolean().optional().describe("Сначала выполнить validate_chunk_schema и остановить пересборку при ошибках."),
  run_regression_after: z.boolean().optional().describe("После пересборки выполнить run_regression_queries."),
  verbose: z.boolean().optional().describe("Добавить расширенные детали для validation/regression.")
};

type RebuildCorpusIndexArgs = {
  validate_first?: boolean;
  run_regression_after?: boolean;
  verbose?: boolean;
};

type RebuildValidationSummary = {
  total_files: number;
  valid_files: number;
  invalid_files: number;
  duplicate_ids: number;
};

type RebuildRegressionSummary = {
  total: number;
  passed: number;
  failed: number;
};

type RebuildCorpusIndexResult = {
  success: boolean;
  chunks_processed: number;
  topics_processed: number;
  index_path: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  validation: RebuildValidationSummary | null;
  regression: RebuildRegressionSummary | null;
  warnings: string[];
};

export async function handleRebuildCorpusIndex(args: RebuildCorpusIndexArgs) {
  const startedAt = new Date();
  const warnings: string[] = [];

  let validation: RebuildValidationSummary | null = null;
  if (args.validate_first === true) {
    const validationResult = validateChunkSchema({ verbose: args.verbose });
    validation = {
      total_files: validationResult.total_files,
      valid_files: validationResult.valid_files,
      invalid_files: validationResult.invalid_files,
      duplicate_ids: validationResult.duplicate_ids
    };
    if (validationResult.invalid_files > 0 || validationResult.duplicate_ids > 0) {
      warnings.push("Validation failed. Rebuild skipped.");
      const finishedAt = new Date();
      return asToolResult(
        finalizeResult({
          success: false,
          chunks_processed: 0,
          topics_processed: 0,
          index_path: config.dbPath,
          started_at: startedAt.toISOString(),
          finished_at: finishedAt.toISOString(),
          duration_ms: finishedAt.getTime() - startedAt.getTime(),
          validation,
          regression: null,
          warnings
        })
      );
    }
  }

  try {
    const rebuildResult = rebuildCorpusIndex();
    let regression: RebuildRegressionSummary | null = null;

    if (args.run_regression_after === true) {
      const db = openReadonlyDb();
      try {
        const repository = new DocsRepository(db);
        const regressionResult = runRegression(repository, { verbose: args.verbose });
        regression = {
          total: regressionResult.total,
          passed: regressionResult.passed,
          failed: regressionResult.failed
        };
        if (regressionResult.failed > 0) {
          warnings.push("Regression checks completed with failures.");
        }
      } finally {
        db.close();
      }
    }

    const finishedAt = new Date();
    return asToolResult(
      finalizeResult({
        success: true,
        chunks_processed: rebuildResult.chunksProcessed,
        topics_processed: rebuildResult.topicsProcessed,
        index_path: rebuildResult.indexPath,
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - startedAt.getTime(),
        validation,
        regression,
        warnings
      })
    );
  } catch (error) {
    const finishedAt = new Date();
    warnings.push(error instanceof Error ? error.message : String(error));
    return asToolResult(
      finalizeResult({
        success: false,
        chunks_processed: 0,
        topics_processed: 0,
        index_path: config.dbPath,
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - startedAt.getTime(),
        validation,
        regression: null,
        warnings
      })
    );
  }
}

function finalizeResult(result: RebuildCorpusIndexResult): RebuildCorpusIndexResult {
  return {
    ...result,
    duration_ms: Math.max(result.duration_ms, 0)
  };
}

function asToolResult(result: RebuildCorpusIndexResult): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
}
