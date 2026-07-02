/**
 * 语义检索（U-SR-05 Top-K 排序 / U-SR-06 归一化）与相关推荐（U-SR-09 排除自身）。
 * 进程内余弦：每条知识取其所有块中与 query 最相似的一块作为该知识得分。
 */
import type { Db } from '../db.ts';
import type { LlmProvider } from '../llm/provider.ts';
import { cosine, toRelevance } from '../util.ts';
import { loadAllEmbeddings, type EmbeddingRow } from './embedding.ts';
import { getKnowledge } from './knowledge.ts';
import { config } from '../config.ts';
import type { SearchHit } from '../types.ts';

interface Scored {
  knowledgeId: string;
  sim: number;
  bestChunk: string;
}

/** 每条知识取最相似块得分。 */
function scoreByKnowledge(rows: EmbeddingRow[], queryVec: number[], excludeId?: string): Scored[] {
  const best = new Map<string, Scored>();
  for (const row of rows) {
    if (excludeId && row.knowledge_id === excludeId) continue;
    if (row.vector.length !== queryVec.length) continue; // 维度不符跳过，不污染结果
    const sim = cosine(queryVec, row.vector);
    const cur = best.get(row.knowledge_id);
    if (!cur || sim > cur.sim) {
      best.set(row.knowledge_id, { knowledgeId: row.knowledge_id, sim, bestChunk: row.chunk_text });
    }
  }
  return Array.from(best.values()).sort((a, b) => b.sim - a.sim);
}

function makeSnippet(chunk: string, query: string, max = 180): string {
  const text = chunk.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  // 尝试围绕首个 query 关键字截取
  const term = query.trim().split(/\s+/).find((t) => t.length >= 2);
  if (term) {
    const idx = text.indexOf(term);
    if (idx >= 0) {
      const start = Math.max(0, idx - 60);
      return (start > 0 ? '…' : '') + text.slice(start, start + max) + '…';
    }
  }
  return text.slice(0, max) + '…';
}

export interface SearchResult {
  query: string;
  hits: SearchHit[];
  total: number;
}

/** 语义检索。query 为空抛错（B-BND-10 由路由层拦截，这里二次保险）。 */
export async function semanticSearch(
  db: Db,
  provider: LlmProvider,
  query: string,
  opts: { topK?: number } = {},
): Promise<SearchResult> {
  const q = query.trim();
  if (!q) throw new Error('检索词不能为空');
  const topK = opts.topK ?? config.topK;
  const rows = loadAllEmbeddings(db);
  if (rows.length === 0) return { query: q, hits: [], total: 0 };
  const queryVec = await provider.embed(q);
  const scored = scoreByKnowledge(rows, queryVec).slice(0, topK);
  const hits: SearchHit[] = [];
  for (const s of scored) {
    const k = getKnowledge(db, s.knowledgeId);
    if (!k) continue;
    hits.push({
      id: k.id,
      title: k.title,
      summary: k.summary,
      snippet: makeSnippet(s.bestChunk, q),
      source_type: k.source_type,
      source_url: k.source_url,
      tags: k.tags,
      relevance: toRelevance(s.sim),
      created_at: k.created_at,
    });
  }
  return { query: q, hits, total: hits.length };
}

export interface RelatedItem {
  id: string;
  title: string;
  relevance: number;
}

/** 相关推荐：以该知识向量质心为 query，排除自身，返回最相关 N 条（U-SR-09 / FR-4）。 */
export function relatedKnowledge(db: Db, knowledgeId: string, limit = 5): RelatedItem[] {
  const all = loadAllEmbeddings(db);
  const own = all.filter((r) => r.knowledge_id === knowledgeId);
  if (own.length === 0) return [];
  const dim = own[0].vector.length;
  const centroid = new Array<number>(dim).fill(0);
  for (const r of own) {
    if (r.vector.length !== dim) continue;
    for (let i = 0; i < dim; i++) centroid[i] += r.vector[i];
  }
  for (let i = 0; i < dim; i++) centroid[i] /= own.length;
  const scored = scoreByKnowledge(all, centroid, knowledgeId).slice(0, limit);
  const items: RelatedItem[] = [];
  for (const s of scored) {
    const k = getKnowledge(db, s.knowledgeId);
    if (!k) continue;
    items.push({ id: k.id, title: k.title, relevance: toRelevance(s.sim) });
  }
  return items;
}
