/**
 * SQLite 数据层（node:sqlite 内置，无原生编译）。
 * 负责：建库 / 迁移 / 崩溃恢复 / 事务 helper。
 * 服务层以依赖注入方式接收 DatabaseSync 实例，便于测试用隔离临时库。
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.ts';
import { logger } from './logger.ts';

// 经 createRequire 加载 node:sqlite，绕过打包器（Vite/vitest）对该新内置模块的解析限制。
const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

export type Db = InstanceType<typeof DatabaseSync>;

/** node:sqlite 可接受的绑定参数类型。 */
export type SqlParam = string | number | bigint | null | Uint8Array;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS knowledge (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('link','paste','note','file')),
  source_url TEXT,
  summary TEXT NOT NULL DEFAULT '',
  organize_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (organize_status IN ('pending','processing','done','failed')),
  organize_error TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_knowledge_created ON knowledge (deleted_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_source ON knowledge (source_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge (organize_status);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS knowledge_tags (
  knowledge_id TEXT NOT NULL REFERENCES knowledge(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (knowledge_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_kt_tag ON knowledge_tags (tag_id);

CREATE TABLE IF NOT EXISTS embeddings (
  knowledge_id TEXT NOT NULL REFERENCES knowledge(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  vector TEXT NOT NULL,          -- JSON float[]
  chunk_text TEXT NOT NULL,
  model TEXT NOT NULL,
  dim INTEGER NOT NULL,
  PRIMARY KEY (knowledge_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 录入幂等去重（同一内容短时间重复提交不产生重复知识，B-BND-07 / C-ING-08）。
CREATE TABLE IF NOT EXISTS ingest_dedup (
  content_hash TEXT PRIMARY KEY,
  knowledge_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

/** 打开（或新建）数据库并执行迁移。filePath 为 ':memory:' 时为内存库（测试用）。 */
export function openDatabase(filePath: string): Db {
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new DatabaseSync(filePath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

/** 事务 helper：fn 内任意 throw 即整体回滚（钱/多表状态变更必事务）。 */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/**
 * 崩溃恢复：把卡在 processing 且超过僵尸阈值的整理任务重置回 pending，
 * 以便重启后 worker 重跑（对齐红线：长/异步任务崩溃恢复）。
 * 返回被回收的任务数。
 */
export function recoverStuckTasks(db: Db, staleMs = config.taskStaleMs): number {
  const cutoff = new Date(Date.now() - staleMs).toISOString();
  const stmt = db.prepare(
    `UPDATE knowledge SET organize_status='pending', updated_at=?
     WHERE organize_status='processing' AND updated_at < ?`,
  );
  const info = stmt.run(new Date().toISOString(), cutoff);
  const n = Number(info.changes);
  if (n > 0) logger.warn('恢复僵尸整理任务', { recovered: n });
  return n;
}

let singleton: Db | null = null;

/** 进程级单例数据库（应用运行时使用）。 */
export function getDb(): Db {
  if (!singleton) {
    const file = path.join(config.dataDir, 'zkb.sqlite');
    singleton = openDatabase(file);
    logger.info('数据库就绪', { file });
  }
  return singleton;
}
