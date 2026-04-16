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
  extraJson?: string;
  content?: string;
}

export interface SearchItem {
  id: string;
  title: string;
  source: string;
  topic: string;
  snippet: string;
}

export interface FetchResult extends NormalizedDoc {}

export interface FetchItem extends Record<string, unknown> {
  id: string;
  topic: string;
  title: string;
  text: string;
  source_path: string | null;
  updated_at: string | null;
}

export interface TopicRow {
  topic: string;
  docsCount: number;
}

export interface TopicResourceItemRow {
  id: string;
  title: string;
  priority?: number;
}
