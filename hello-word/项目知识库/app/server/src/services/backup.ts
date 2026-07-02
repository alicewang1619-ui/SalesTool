/**
 * 数据导出 / 导入备份（AC-8、C-SET-04/05、S-SEC-07）。
 * - 导出：纯知识数据 JSON，绝不含 API Key 等凭据（S-SEC-05）。
 * - 导入：严格校验结构，拒绝可疑/非法内容（S-SEC-07），导入后标 pending 由 worker 重建向量。
 */
import type { Db } from '../db.ts';
import { transaction } from '../db.ts';
import { genId, nowIso } from '../util.ts';
import type { SourceType } from '../types.ts';

const BACKUP_VERSION = 1;
const VALID_SOURCES: SourceType[] = ['link', 'paste', 'note', 'file'];

export interface BackupItem {
  title: string;
  content: string;
  source_type: SourceType;
  source_url: string | null;
  summary: string;
  tags: string[];
  created_at: string;
}

export interface Backup {
  app: 'zkb';
  version: number;
  exported_at: string;
  count: number;
  knowledge: BackupItem[];
}

export function exportData(db: Db): Backup {
  const rows = db
    .prepare(
      `SELECT id, title, content, source_type, source_url, summary, created_at
       FROM knowledge WHERE deleted_at IS NULL ORDER BY created_at ASC`,
    )
    .all() as {
    id: string;
    title: string;
    content: string;
    source_type: SourceType;
    source_url: string | null;
    summary: string;
    created_at: string;
  }[];
  const items: BackupItem[] = rows.map((r) => {
    const tags = (
      db
        .prepare(
          `SELECT t.name FROM tags t JOIN knowledge_tags kt ON kt.tag_id=t.id WHERE kt.knowledge_id=? ORDER BY t.name`,
        )
        .all(r.id) as { name: string }[]
    ).map((t) => t.name);
    return {
      title: r.title,
      content: r.content,
      source_type: r.source_type,
      source_url: r.source_url,
      summary: r.summary,
      tags,
      created_at: r.created_at,
    };
  });
  return { app: 'zkb', version: BACKUP_VERSION, exported_at: nowIso(), count: items.length, knowledge: items };
}

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

/** 校验并导入备份。返回导入条数。校验失败抛 ImportError（S-SEC-07）。 */
export function importData(db: Db, payload: unknown): { imported: number } {
  if (typeof payload !== 'object' || payload === null) {
    throw new ImportError('备份格式非法：不是对象');
  }
  const p = payload as Partial<Backup>;
  if (p.app !== 'zkb') throw new ImportError('备份来源不可信：app 标识不符');
  if (typeof p.version !== 'number' || p.version > BACKUP_VERSION) {
    throw new ImportError(`不支持的备份版本: ${p.version}`);
  }
  if (!Array.isArray(p.knowledge)) throw new ImportError('备份缺 knowledge 数组');
  const entries: unknown[] = p.knowledge;

  return transaction(db, () => {
    let imported = 0;
    for (const raw of entries) {
      if (typeof raw !== 'object' || raw === null) throw new ImportError('知识条目非法');
      const item = raw as Partial<BackupItem>;
      if (typeof item.content !== 'string' || item.content.trim().length === 0) {
        throw new ImportError('知识条目缺正文');
      }
      const sourceType = item.source_type;
      if (sourceType === undefined || !VALID_SOURCES.includes(sourceType)) {
        throw new ImportError(`非法 source_type: ${sourceType}`);
      }
      const id = genId('k');
      const ts = item.created_at && typeof item.created_at === 'string' ? item.created_at : nowIso();
      db.prepare(
        `INSERT INTO knowledge(id, title, content, source_type, source_url, summary, organize_status, organize_error, deleted_at, created_at, updated_at)
         VALUES(?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, ?)`,
      ).run(
        id,
        (item.title ?? '').trim() || item.content.slice(0, 30),
        item.content,
        sourceType,
        item.source_url ?? null,
        item.summary ?? '',
        ts,
        nowIso(),
      );
      const tags = Array.isArray(item.tags) ? item.tags : [];
      for (const name of tags) {
        const tagName = String(name).trim();
        if (!tagName) continue;
        let tag = db.prepare('SELECT id FROM tags WHERE name=?').get(tagName) as { id: string } | undefined;
        if (!tag) {
          const tid = genId('t');
          db.prepare('INSERT INTO tags(id, name) VALUES(?, ?)').run(tid, tagName);
          tag = { id: tid };
        }
        db.prepare('INSERT OR IGNORE INTO knowledge_tags(knowledge_id, tag_id) VALUES(?, ?)').run(id, tag.id);
      }
      imported += 1;
    }
    return { imported };
  });
}
