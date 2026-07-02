/** 领域类型（对齐 PRD §5 数据模型）。 */

export type SourceType = 'link' | 'paste' | 'note' | 'file';

/** 异步整理任务状态。 */
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
}

export interface Tag {
  id: string;
  name: string;
}

/** 列表 / 详情对外返回的知识（含标签）。 */
export interface KnowledgeWithTags extends Knowledge {
  tags: string[];
}

/** 检索结果条目。 */
export interface SearchHit {
  id: string;
  title: string;
  summary: string;
  snippet: string;
  source_type: SourceType;
  source_url: string | null;
  tags: string[];
  /** 0–100 归一化相关度。 */
  relevance: number;
  created_at: string;
}

/** RAG 答案来源。 */
export interface AnswerSource {
  index: number;
  knowledge_id: string;
  title: string;
  relevance: number;
}

export interface AnswerResult {
  answer: string;
  sources: AnswerSource[];
}

/** 模型提供方设置。 */
export interface ModelSettings {
  provider: 'local' | 'cloud';
  chatModel: string;
  embedModel: string;
  /** 云端时使用，本地为空。 */
  cloudBaseUrl: string;
  cloudApiKey: string;
}
