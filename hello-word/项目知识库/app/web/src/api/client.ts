/** API 客户端：统一处理错误体 {error:{code,message,retryable}}，抛 ApiError。 */
import type {
  Knowledge,
  PageResult,
  SearchResult,
  RelatedItem,
  AnswerResult,
  TagCount,
  ModelSettingsPublic,
  DataStats,
  HealthResult,
  SourceType,
  Graph,
} from './types.ts';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE = '/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch (err) {
    throw new ApiError('NETWORK', `网络请求失败: ${(err as Error).message}`, true, 0);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(
      e?.code ?? 'HTTP_ERROR',
      e?.message ?? `请求失败 (${res.status})`,
      Boolean(e?.retryable),
      res.status,
    );
  }
  return data as T;
}

export const api = {
  health: () => req<HealthResult>('/health'),

  listKnowledge: (params: { page?: number; pageSize?: number; source?: SourceType } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    if (params.source) q.set('source', params.source);
    return req<PageResult<Knowledge>>(`/knowledge?${q.toString()}`);
  },
  getKnowledge: (id: string) => req<Knowledge>(`/knowledge/${id}`),
  related: (id: string, limit = 5) => req<{ items: RelatedItem[] }>(`/knowledge/${id}/related?limit=${limit}`),
  createKnowledge: (body: { title?: string; content: string; source_type: 'paste' | 'note' }) =>
    req<{ id: string; deduped: boolean }>('/knowledge', { method: 'POST', body: JSON.stringify(body) }),
  ingestLink: (url: string) =>
    req<{ id: string; deduped: boolean; title: string; viaWeixin: boolean }>('/ingest/link', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),
  ingestFile: (filename: string, contentBase64: string) =>
    req<{ id: string; deduped: boolean; title: string }>('/ingest/file', {
      method: 'POST',
      body: JSON.stringify({ filename, contentBase64 }),
    }),
  updateKnowledge: (id: string, body: { title?: string; content?: string; summary?: string }) =>
    req<Knowledge>(`/knowledge/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  setTags: (id: string, tags: string[]) =>
    req<Knowledge>(`/knowledge/${id}/tags`, { method: 'PATCH', body: JSON.stringify({ tags }) }),
  deleteKnowledge: (id: string) => req<{ ok: boolean }>(`/knowledge/${id}`, { method: 'DELETE' }),

  search: (q: string, topK?: number) => {
    const p = new URLSearchParams({ q });
    if (topK) p.set('topK', String(topK));
    return req<SearchResult>(`/search?${p.toString()}`);
  },
  ask: (question: string) => req<AnswerResult>('/ask', { method: 'POST', body: JSON.stringify({ question }) }),

  listTags: () => req<{ items: TagCount[] }>('/tags'),
  byTag: (name: string, page = 1, pageSize = 20) =>
    req<PageResult<Knowledge>>(`/tags/${encodeURIComponent(name)}?page=${page}&pageSize=${pageSize}`),

  recycle: (page = 1, pageSize = 20) => req<PageResult<Knowledge>>(`/recycle?page=${page}&pageSize=${pageSize}`),
  restore: (id: string) => req<{ ok: boolean }>(`/recycle/${id}/restore`, { method: 'POST' }),
  purge: (id: string) => req<{ ok: boolean }>(`/recycle/${id}`, { method: 'DELETE' }),
  emptyRecycle: () => req<{ purged: number }>('/recycle', { method: 'DELETE' }),

  getModel: () => req<ModelSettingsPublic>('/settings/model'),
  listLocalModels: () => req<{ models: string[] }>('/settings/local-models'),
  updateModel: (body: Partial<{ provider: 'local' | 'cloud'; chatModel: string; embedModel: string; cloudBaseUrl: string; cloudApiKey: string }>) =>
    req<ModelSettingsPublic>('/settings/model', { method: 'PUT', body: JSON.stringify(body) }),
  testModel: () => req<{ ok: boolean; detail: string }>('/settings/model/test', { method: 'POST' }),

  graph: (minRelevance?: number, limit?: number) => {
    const p = new URLSearchParams();
    if (minRelevance != null) p.set('minRelevance', String(minRelevance));
    if (limit != null) p.set('limit', String(limit));
    const qs = p.toString();
    return req<Graph>(`/graph${qs ? `?${qs}` : ''}`);
  },
  stats: () => req<DataStats>('/stats'),
  exportBackup: () => req<unknown>('/backup/export'),
  importBackup: (payload: unknown) => req<{ imported: number }>('/backup/import', { method: 'POST', body: JSON.stringify(payload) }),
};
