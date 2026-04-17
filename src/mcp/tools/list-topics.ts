import type { DocsRepository } from "../../db/repository.js";

export const listTopicsToolSchema = {
};

type ListTopicsToolArgs = Record<string, never>;

export async function handleListTopics(repository: DocsRepository, args: ListTopicsToolArgs) {
  void args;
  const rows = repository.listTopics();
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            total_topics: rows.length,
            items: rows.map((row) => ({
              topic: row.topic,
              docs_count: row.docsCount
            }))
          },
          null,
          2
        )
      }
    ]
  };
}
