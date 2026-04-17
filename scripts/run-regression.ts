import { openReadonlyDb } from "../src/db/connection.js";
import { DocsRepository } from "../src/db/repository.js";
import { runRegression } from "../src/regression/run-regression.js";

const db = openReadonlyDb();

try {
  const repository = new DocsRepository(db);
  const result = runRegression(repository);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.failed > 0) {
    process.exitCode = 2;
  }
} finally {
  db.close();
}
