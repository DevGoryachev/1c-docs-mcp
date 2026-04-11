export interface NormalizedDoc {
  id: string;
  topic: string;
  title: string;
  content: string;
  sourcePath?: string;
  updatedAt?: string;
  extraJson?: string;
}

export interface SearchResult {
  id: string;
  topic: string;
  title: string;
  snippet: string;
  score: number;
}

export interface FetchResult extends NormalizedDoc {}

export interface TopicRow {
  topic: string;
  docsCount: number;
}
