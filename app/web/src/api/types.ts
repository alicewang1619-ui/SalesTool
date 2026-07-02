/** 前端领域类型（与后端 src/types.ts 对齐）。 */
export type SourceType = 'link' | 'paste' | 'note' | 'file';
export type OrganizeStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface Knowledge {
  id: string;
  title: string;
  content: string;
  source_type: SourceType;
  source_url: string | null;
  summary: string;
  organize_status: OrganizeStatus;
  organize_error: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SearchHit {
  id: string;
  title: string;
  summary: string;
  snippet: string;
  source_type: SourceType;
  source_url: string | null;
  tags: string[];
  relevance: number;
  created_at: string;
}

export interface SearchResult {
  query: string;
  hits: SearchHit[];
  total: number;
}

export interface RelatedItem {
  id: string;
  title: string;
  relevance: number;
}

export interface AnswerSource {
  index: number;
  knowledge_id: string;
  title: string;
  relevance: number;
}

export interface AnswerResult {
  answer: string;
  sources: AnswerSource[];
  hasContext: boolean;
}

export interface TagCount {
  name: string;
  count: number;
}

export interface ModelSettingsPublic {
  provider: 'local' | 'cloud';
  chatModel: string;
  embedModel: string;
  cloudBaseUrl: string;
  cloudApiKeyMasked: string;
  hasCloudApiKey: boolean;
}

export interface GraphNode {
  id: string;
  title: string;
  tags: string[];
  degree: number;
}
export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}
export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface DataStats {
  knowledge: number;
  deleted: number;
  tags: number;
  embeddings: number;
}

export interface HealthResult {
  status: string;
  model: { ok: boolean; detail: string };
}

/** 来源类型展示映射（与原型一致）。 */
export const SOURCE_META: Record<SourceType, { label: string; emoji: string }> = {
  link: { label: '公众号', emoji: '📎' },
  paste: { label: 'AI 对话', emoji: '💬' },
  note: { label: '心得', emoji: '✍️' },
  file: { label: '文件', emoji: '📄' },
};
