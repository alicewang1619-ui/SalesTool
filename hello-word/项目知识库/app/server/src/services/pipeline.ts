/**
 * 录入流水线与整理处理（I-LLM-06 端到端贯通、幂等 B-BND-07）。
 * ingest：写入知识(pending) + 幂等去重，立即返回；重活交给后台 worker。
 * processKnowledge：整理(标签/摘要) + 向量构建 + 状态流转，可被 worker 或测试同步调用。
 */
import type { Db } from '../db.ts';
import { transaction } from '../db.ts';
import type { LlmProvider } from '../llm/provider.ts';
import { sha256, nowIso } from '../util.ts';
import {
  createKnowledge,
  getKnowledge,
  setOrganizeStatus,
  setSummary,
  setTags,
  type CreateInput,
} from './knowledge.ts';
import { buildEmbeddings } from './embedding.ts';
import { organize } from './organize.ts';
import { sanitizeContent } from './sanitize.ts';
import { logger } from '../logger.ts';

/** 录入去重时间窗（毫秒）：同内容在窗口内重复提交返回原 id，不重复入库。 */
const DEDUP_WINDOW_MS = 10 * 60_000;

export interface IngestResult {
  id: string;
  deduped: boolean;
}

/** 录入一条内容（幂等）。返回知识 id；deduped=true 表示命中近期重复。 */
export function ingest(db: Db, input: CreateInput): IngestResult {
  // 统一收口：所有入库内容（粘贴/编辑/抓取/上传）在此清洗可执行脚本（S-SEC-03 纵深防御）。
  input = { ...input, content: sanitizeContent(input.content) };
  const hash = sha256(`${input.source_type}|${input.source_url ?? ''}|${input.content.trim()}`);
  return transaction(db, () => {
    const existing = db
      .prepare('SELECT knowledge_id, created_at FROM ingest_dedup WHERE content_hash=?')
      .get(hash) as { knowledge_id: string; created_at: string } | undefined;
    if (existing) {
      const age = Date.now() - new Date(existing.created_at).getTime();
      const stillAlive = getKnowledge(db, existing.knowledge_id, { includeDeleted: true });
      if (age < DEDUP_WINDOW_MS && stillAlive && !stillAlive.deleted_at) {
        return { id: existing.knowledge_id, deduped: true };
      }
    }
    const id = createKnowledge(db, input);
    db.prepare(
      `INSERT INTO ingest_dedup(content_hash, knowledge_id, created_at) VALUES(?, ?, ?)
       ON CONFLICT(content_hash) DO UPDATE SET knowledge_id=excluded.knowledge_id, created_at=excluded.created_at`,
    ).run(hash, id, nowIso());
    return { id, deduped: false };
  });
}

/**
 * 处理一条知识：整理(标签+摘要) + 构建向量。幂等——仅处理非 done 状态。
 * 任一步失败 → 标 failed 并记 error（可重试），不抛出（供 worker 批量推进）。
 */
export async function processKnowledge(
  db: Db,
  provider: LlmProvider,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const k = getKnowledge(db, id);
  if (!k) return { ok: false, error: '知识不存在或已删除' };
  setOrganizeStatus(db, id, 'processing');
  const log = logger.child({ knowledge_id: id });
  try {
    // 先建向量（快）——检索/相关推荐/RAG 立即可用，不被慢的标签摘要阻塞。
    await buildEmbeddings(db, provider, id, k.content);
    // 再做标签/摘要（慢，依赖 chat）。
    const result = await organize(provider, k.content);
    setTags(db, id, result.tags);
    if (result.summary) setSummary(db, id, result.summary);
    setOrganizeStatus(db, id, 'done');
    log.info('整理完成', { tags: result.tags.length });
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message;
    setOrganizeStatus(db, id, 'failed', msg);
    log.error('整理失败', { error: msg });
    return { ok: false, error: msg };
  }
}

/** 仅重建向量（编辑正文后调用，U-SR-03 / I-DB-05）。 */
export async function reindexKnowledge(db: Db, provider: LlmProvider, id: string): Promise<void> {
  const k = getKnowledge(db, id);
  if (!k) throw new Error('知识不存在');
  await buildEmbeddings(db, provider, id, k.content);
}
