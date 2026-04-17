import { z } from "zod";
import type { DocsRepository } from "../../db/repository.js";
import { runRegression } from "../../regression/run-regression.js";

export const runRegressionQueriesToolSchema = {
  verbose: z.boolean().optional().describe("Добавить расширенные диагностические детали в results[].details")
};

type RunRegressionQueriesArgs = {
  verbose?: boolean;
};

export async function handleRunRegressionQueries(repository: DocsRepository, args: RunRegressionQueriesArgs) {
  const result = runRegression(repository, { verbose: args.verbose });
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
}
