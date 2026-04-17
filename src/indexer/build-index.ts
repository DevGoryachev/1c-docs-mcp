import { rebuildCorpusIndex } from "./rebuild-index.js";

function main(): void {
  const result = rebuildCorpusIndex();
  process.stdout.write(`Индекс построен: ${result.chunksProcessed} документов, файлов: ${result.filesProcessed}\n`);
}

main();
