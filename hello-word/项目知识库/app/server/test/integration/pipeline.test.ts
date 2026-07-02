import { describe, it, expect } from 'vitest';
import { memDb, StubProvider } from '../helpers.ts';
import { recoverStuckTasks } from '../../src/db.ts';
import { ingest, processKnowledge } from '../../src/services/pipeline.ts';
import { getKnowledge, createKnowledge, setOrganizeStatus } from '../../src/services/knowledge.ts';
import { TaskWorker } from '../../src/services/worker.ts';

describe('U-AT-04 同名标签复用', () => {
  it('两条知识生成相同标签时，标签表不重复建', async () => {
    const db = memDb();
    const provider = new StubProvider({
      chatFn: () => JSON.stringify({ tags: ['Redis', '缓存'], summary: '摘要' }),
    });
    const a = ingest(db, { title: 'A', content: '正文A 讲 Redis。', source_type: 'note' });
    const b = ingest(db, { title: 'B', content: '正文B 也讲 Redis。', source_type: 'note' });
    await processKnowledge(db, provider, a.id);
    await processKnowledge(db, provider, b.id);
    const redisCount = (db.prepare("SELECT COUNT(*) AS c FROM tags WHERE name='Redis'").get() as { c: number }).c;
    expect(redisCount).toBe(1);
    expect(getKnowledge(db, a.id)!.tags).toContain('Redis');
    expect(getKnowledge(db, b.id)!.tags).toContain('Redis');
  });
});

describe('B-BND-07 录入幂等去重', () => {
  it('相同内容短时间重复提交返回同一 id，不重复入库', () => {
    const db = memDb();
    const r1 = ingest(db, { title: 'x', content: '完全相同的正文内容', source_type: 'paste' });
    const r2 = ingest(db, { title: 'x', content: '完全相同的正文内容', source_type: 'paste' });
    expect(r2.deduped).toBe(true);
    expect(r2.id).toBe(r1.id);
    const total = (db.prepare('SELECT COUNT(*) AS c FROM knowledge').get() as { c: number }).c;
    expect(total).toBe(1);
  });

  it('不同内容不去重', () => {
    const db = memDb();
    const r1 = ingest(db, { title: 'x', content: '正文一', source_type: 'paste' });
    const r2 = ingest(db, { title: 'y', content: '正文二', source_type: 'paste' });
    expect(r2.id).not.toBe(r1.id);
  });
});

describe('U-SR-02 worker 自动整理待处理任务', () => {
  it('worker.tick 处理 pending 知识至 done', async () => {
    const db = memDb();
    const provider = new StubProvider();
    const id = createKnowledge(db, { title: 'x', content: '一段需要整理的正文内容。', source_type: 'note' });
    expect(getKnowledge(db, id)!.organize_status).toBe('pending');
    const worker = new TaskWorker({ db, getProvider: () => provider });
    const processed = await worker.tick();
    expect(processed).toBe(true);
    expect(getKnowledge(db, id)!.organize_status).toBe('done');
  });
});

describe('崩溃恢复：僵尸 processing 任务重置', () => {
  it('超时仍 processing 的任务被重置为 pending', () => {
    const db = memDb();
    const id = createKnowledge(db, { title: 'x', content: '正文', source_type: 'note' });
    // 模拟崩溃：置 processing 且 updated_at 远早于阈值
    setOrganizeStatus(db, id, 'processing');
    db.prepare('UPDATE knowledge SET updated_at=? WHERE id=?').run('2000-01-01T00:00:00.000Z', id);
    const recovered = recoverStuckTasks(db, 60_000);
    expect(recovered).toBe(1);
    expect(getKnowledge(db, id)!.organize_status).toBe('pending');
  });

  it('整理失败置 failed 且记录可重试错误', async () => {
    const db = memDb();
    const badProvider = new StubProvider({ chatFn: () => '不是合法JSON' });
    const id = createKnowledge(db, { title: 'x', content: '正文', source_type: 'note' });
    const r = await processKnowledge(db, badProvider, id);
    expect(r.ok).toBe(false);
    expect(getKnowledge(db, id)!.organize_status).toBe('failed');
    expect(getKnowledge(db, id)!.organize_error).toBeTruthy();
  });
});
