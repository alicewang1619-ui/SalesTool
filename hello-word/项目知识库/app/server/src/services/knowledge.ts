/**
 * 知识仓储层（I-DB-01/02/06、U-AT-04 标签去重、分页与 DB 侧聚合）。
 * 纯数据访问；embedding 重建等副作用由上层 ingest/tasks 编排。
 */
import type { Db, SqlParam } from '../db.ts';
import { transaction } from '../db.ts';
import { genId, nowIso } from '../util.ts';
import type { Knowledge, KnowledgeWithTags, SourceType, Tag } from '../types.ts';

export interface CreateInput {
  title: string;
  content: string;
  source_type: SourceType;
  source_url?: string | null;
  summary?: string;
}

const KNOWLEDGE_COLS =
  'id, title, content, source_type, source_url, summary, organize_status, organize_error, deleted_at, created_at, updated_at';

function tagsOf(db: Db, knowledgeId: string): string[] {
  const rows = db
    .prepare(
      `SELECT t.name FROM tags t
       JOIN knowledge_tags kt ON kt.tag_id = t.id
       WHERE kt.knowledge_id = ? ORDER BY t.name`,
    )
    .all(knowledgeId) as { name: string }[];
  return rows.map((r) => r.name);
}

/** 批量取多条知识的标签，避免 N+1（列表页用）。 */
function tagsOfMany(db: Db, ids: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT kt.knowledge_id AS kid, t.name AS name FROM knowledge_tags kt
       JOIN tags t ON t.id = kt.tag_id
       WHERE kt.knowledge_id IN (${placeholders}) ORDER BY t.name`,
    )
    .all(...ids) as { kid: string; name: string }[];
  for (const r of rows) {
    const arr = map.get(r.kid) ?? [];
    arr.push(r.name);
    map.set(r.kid, arr);
  }
  return map;
}

export function createKnowledge(db: Db, input: CreateInput): string {
  const title = input.title?.trim();
  const content = input.content?.trim();
  if (!content) throw new Error('内容不能为空');
  const id = genId('k');
  const ts = nowIso();
  db.prepare(
    `INSERT INTO knowledge(${KNOWLEDGE_COLS})
     VALUES(?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, ?)`,
  ).run(
    id,
    title || content.slice(0, 30),
    content,
    input.source_type,
    input.source_url ?? null,
    input.summary ?? '',
    ts,
    ts,
  );
  return id;
}

export function getKnowledge(
  db: Db,
  id: string,
  opts: { includeDeleted?: boolean } = {},
): KnowledgeWithTags | null {
  const row = db
    .prepare(`SELECT ${KNOWLEDGE_COLS} FROM knowledge WHERE id = ?`)
    .get(id) as Knowledge | undefined;
  if (!row) return null;
  if (row.deleted_at && !opts.includeDeleted) return null;
  return { ...row, tags: tagsOf(db, id) };
}

export interface ListResult {
  items: KnowledgeWithTags[];
  total: number;
  page: number;
  pageSize: number;
}

/** 列表分页（最近优先），可按来源类型筛（DB 侧过滤，禁全量 select）。 */
export function listKnowledge(
  db: Db,
  opts: { page?: number; pageSize?: number; sourceType?: SourceType } = {},
): ListResult {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(opts.pageSize ?? 20)));
  const where: string[] = ['deleted_at IS NULL'];
  const params: SqlParam[] = [];
  if (opts.sourceType) {
    where.push('source_type = ?');
    params.push(opts.sourceType);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const total = Number(
    (db.prepare(`SELECT COUNT(*) AS c FROM knowledge ${whereSql}`).get(...params) as { c: number }).c,
  );
  const rows = db
    .prepare(
      `SELECT ${KNOWLEDGE_COLS} FROM knowledge ${whereSql}
       ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize) as unknown as Knowledge[];
  const tagMap = tagsOfMany(db, rows.map((r) => r.id));
  return {
    items: rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] })),
    total,
    page,
    pageSize,
  };
}

export interface UpdateInput {
  title?: string;
  content?: string;
  summary?: string;
}

/** 更新知识字段。返回是否 content 发生变化（供上层决定是否重建 embedding）。 */
export function updateKnowledge(db: Db, id: string, input: UpdateInput): { contentChanged: boolean } {
  const existing = getKnowledge(db, id);
  if (!existing) throw new Error('知识不存在或已删除');
  const newContent = input.content !== undefined ? input.content.trim() : existing.content;
  if (input.content !== undefined && !newContent) throw new Error('正文不能为空');
  const contentChanged = newContent !== existing.content;
  db.prepare(
    `UPDATE knowledge SET title=?, content=?, summary=?, updated_at=? WHERE id=?`,
  ).run(
    input.title !== undefined ? input.title.trim() || existing.title : existing.title,
    newContent,
    input.summary !== undefined ? input.summary : existing.summary,
    nowIso(),
    id,
  );
  return { contentChanged };
}

/** 设置知识标签（全量替换，去重，复用同名 Tag，清理孤儿标签）。事务保证一致。 */
export function setTags(db: Db, knowledgeId: string, tagNames: string[]): string[] {
  const clean = Array.from(
    new Set(tagNames.map((t) => t.trim()).filter((t) => t.length > 0 && t.length <= 40)),
  );
  return transaction(db, () => {
    db.prepare('DELETE FROM knowledge_tags WHERE knowledge_id=?').run(knowledgeId);
    for (const name of clean) {
      let tag = db.prepare('SELECT id FROM tags WHERE name=?').get(name) as { id: string } | undefined;
      if (!tag) {
        const tid = genId('t');
        db.prepare('INSERT INTO tags(id, name) VALUES(?, ?)').run(tid, name);
        tag = { id: tid };
      }
      db.prepare('INSERT OR IGNORE INTO knowledge_tags(knowledge_id, tag_id) VALUES(?, ?)').run(
        knowledgeId,
        tag.id,
      );
    }
    cleanupOrphanTags(db);
    return clean;
  });
}

/** 删除不再被任何知识引用的标签。 */
function cleanupOrphanTags(db: Db): void {
  db.exec(
    `DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM knowledge_tags)`,
  );
}

/** 软删除（移入回收站，I-DB-06）。 */
export function softDelete(db: Db, id: string): boolean {
  const info = db
    .prepare(`UPDATE knowledge SET deleted_at=?, updated_at=? WHERE id=? AND deleted_at IS NULL`)
    .run(nowIso(), nowIso(), id);
  return Number(info.changes) > 0;
}

/** 从回收站恢复（E-FLOW-06）。 */
export function restore(db: Db, id: string): boolean {
  const info = db
    .prepare(`UPDATE knowledge SET deleted_at=NULL, updated_at=? WHERE id=? AND deleted_at IS NOT NULL`)
    .run(nowIso(), id);
  return Number(info.changes) > 0;
}

export function listDeleted(db: Db, opts: { page?: number; pageSize?: number } = {}): ListResult {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(opts.pageSize ?? 20)));
  const total = Number(
    (db.prepare('SELECT COUNT(*) AS c FROM knowledge WHERE deleted_at IS NOT NULL').get() as { c: number }).c,
  );
  const rows = db
    .prepare(
      `SELECT ${KNOWLEDGE_COLS} FROM knowledge WHERE deleted_at IS NOT NULL
       ORDER BY deleted_at DESC LIMIT ? OFFSET ?`,
    )
    .all(pageSize, (page - 1) * pageSize) as unknown as Knowledge[];
  const tagMap = tagsOfMany(db, rows.map((r) => r.id));
  return { items: rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] })), total, page, pageSize };
}

/** 物理清除（回收站清空 / 单条彻底删）。FK ON DELETE CASCADE 级联清标签与向量（I-DB-04）。 */
export function purge(db: Db, id: string): boolean {
  return transaction(db, () => {
    const info = db.prepare('DELETE FROM knowledge WHERE id=? AND deleted_at IS NOT NULL').run(id);
    cleanupOrphanTags(db);
    return Number(info.changes) > 0;
  });
}

export function emptyRecycle(db: Db): number {
  return transaction(db, () => {
    const info = db.prepare('DELETE FROM knowledge WHERE deleted_at IS NOT NULL').run();
    cleanupOrphanTags(db);
    return Number(info.changes);
  });
}

/** 标签云：名称 + 计数（DB 侧 GROUP BY 聚合）。 */
export function listTagsWithCount(db: Db): { name: string; count: number }[] {
  return db
    .prepare(
      `SELECT t.name AS name, COUNT(kt.knowledge_id) AS count
       FROM tags t
       JOIN knowledge_tags kt ON kt.tag_id = t.id
       JOIN knowledge k ON k.id = kt.knowledge_id AND k.deleted_at IS NULL
       GROUP BY t.id ORDER BY count DESC, t.name ASC`,
    )
    .all() as { name: string; count: number }[];
}

/** 某标签下的知识（分页）。 */
export function listByTag(
  db: Db,
  tagName: string,
  opts: { page?: number; pageSize?: number } = {},
): ListResult {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(opts.pageSize ?? 20)));
  const total = Number(
    (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM knowledge k
           JOIN knowledge_tags kt ON kt.knowledge_id = k.id
           JOIN tags t ON t.id = kt.tag_id
           WHERE t.name = ? AND k.deleted_at IS NULL`,
        )
        .get(tagName) as { c: number }
    ).c,
  );
  const rows = db
    .prepare(
      `SELECT ${KNOWLEDGE_COLS.split(', ').map((c) => 'k.' + c).join(', ')} FROM knowledge k
       JOIN knowledge_tags kt ON kt.knowledge_id = k.id
       JOIN tags t ON t.id = kt.tag_id
       WHERE t.name = ? AND k.deleted_at IS NULL
       ORDER BY k.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(tagName, pageSize, (page - 1) * pageSize) as unknown as Knowledge[];
  const tagMap = tagsOfMany(db, rows.map((r) => r.id));
  return { items: rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] })), total, page, pageSize };
}

/** 整理状态流转。 */
export function setOrganizeStatus(
  db: Db,
  id: string,
  status: Knowledge['organize_status'],
  error: string | null = null,
): void {
  db.prepare('UPDATE knowledge SET organize_status=?, organize_error=?, updated_at=? WHERE id=?').run(
    status,
    error,
    nowIso(),
    id,
  );
}

export function setSummary(db: Db, id: string, summary: string): void {
  db.prepare('UPDATE knowledge SET summary=?, updated_at=? WHERE id=?').run(summary, nowIso(), id);
}

export function getAllTags(db: Db): Tag[] {
  return db.prepare('SELECT id, name FROM tags ORDER BY name').all() as unknown as Tag[];
}

/** 数据统计（设置页占用展示）。 */
export function dataStats(db: Db): { knowledge: number; deleted: number; tags: number; embeddings: number } {
  return {
    knowledge: Number((db.prepare('SELECT COUNT(*) AS c FROM knowledge WHERE deleted_at IS NULL').get() as { c: number }).c),
    deleted: Number((db.prepare('SELECT COUNT(*) AS c FROM knowledge WHERE deleted_at IS NOT NULL').get() as { c: number }).c),
    tags: Number((db.prepare('SELECT COUNT(*) AS c FROM tags').get() as { c: number }).c),
    embeddings: Number((db.prepare('SELECT COUNT(*) AS c FROM embeddings').get() as { c: number }).c),
  };
}
