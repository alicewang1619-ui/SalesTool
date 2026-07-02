import { describe, it, expect, beforeEach } from 'vitest';
import type { Db } from '../../src/db.ts';
import { memDb } from '../helpers.ts';
import { StubProvider } from '../helpers.ts';
import {
  createKnowledge,
  getKnowledge,
  setTags,
  updateKnowledge,
  softDelete,
  restore,
  purge,
  listKnowledge,
  listByTag,
} from '../../src/services/knowledge.ts';
import { buildEmbeddings, countEmbeddings } from '../../src/services/embedding.ts';

const provider = new StubProvider();

describe('数据存储集成（真实 SQLite）', () => {
  let db: Db;
  beforeEach(() => {
    db = memDb();
  });

  it('I-DB-01 知识读写一致：写入后字段可完整读回', () => {
    const id = createKnowledge(db, {
      title: 'Redis 缓存穿透',
      content: '正文内容',
      source_type: 'link',
      source_url: 'https://mp.weixin.qq.com/s/abc',
    });
    const k = getKnowledge(db, id)!;
    expect(k.title).toBe('Redis 缓存穿透');
    expect(k.content).toBe('正文内容');
    expect(k.source_type).toBe('link');
    expect(k.source_url).toBe('https://mp.weixin.qq.com/s/abc');
    expect(k.organize_status).toBe('pending');
    expect(k.created_at).toBeTruthy();
  });

  it('I-DB-02 多对多标签关系正确', () => {
    const id = createKnowledge(db, { title: 'x', content: '正文', source_type: 'note' });
    setTags(db, id, ['Redis', '缓存', '面试']);
    const k = getKnowledge(db, id)!;
    expect(k.tags.sort()).toEqual(['Redis', '缓存', '面试'].sort());
    // 同标签复用：另一条用相同标签，标签表不重复建
    const id2 = createKnowledge(db, { title: 'y', content: '正文2', source_type: 'note' });
    setTags(db, id2, ['Redis']);
    const tagCount = (db.prepare("SELECT COUNT(*) AS c FROM tags WHERE name='Redis'").get() as { c: number }).c;
    expect(tagCount).toBe(1);
    // 按标签聚合能查到两条
    expect(listByTag(db, 'Redis').total).toBe(2);
  });

  it('I-DB-03 向量可召回：入库构建后可加载', async () => {
    const id = createKnowledge(db, { title: 'x', content: '足够的正文用于生成向量块。', source_type: 'note' });
    await buildEmbeddings(db, provider, id, '足够的正文用于生成向量块。');
    expect(countEmbeddings(db, id)).toBeGreaterThan(0);
  });

  it('I-DB-04 删除事务一致：purge 同时清行+标签+向量', async () => {
    const id = createKnowledge(db, { title: 'x', content: '正文', source_type: 'note' });
    setTags(db, id, ['临时标签']);
    await buildEmbeddings(db, provider, id, '正文内容用于向量。');
    softDelete(db, id);
    purge(db, id);
    expect(getKnowledge(db, id, { includeDeleted: true })).toBeNull();
    expect(countEmbeddings(db, id)).toBe(0);
    const orphanTag = (db.prepare("SELECT COUNT(*) AS c FROM tags WHERE name='临时标签'").get() as { c: number }).c;
    expect(orphanTag).toBe(0); // 孤儿标签被清
  });

  it('I-DB-05 编辑同步：内容变更标记 contentChanged 以触发重建', () => {
    const id = createKnowledge(db, { title: 'x', content: '原正文', source_type: 'note' });
    const r1 = updateKnowledge(db, id, { content: '新正文' });
    expect(r1.contentChanged).toBe(true);
    const r2 = updateKnowledge(db, id, { title: '只改标题' });
    expect(r2.contentChanged).toBe(false);
    expect(getKnowledge(db, id)!.content).toBe('新正文');
  });

  it('I-DB-06 软删可恢复', () => {
    const id = createKnowledge(db, { title: 'x', content: '正文', source_type: 'note' });
    expect(softDelete(db, id)).toBe(true);
    expect(getKnowledge(db, id)).toBeNull(); // 列表不可见
    expect(getKnowledge(db, id, { includeDeleted: true })).not.toBeNull(); // 仍存在
    expect(restore(db, id)).toBe(true);
    expect(getKnowledge(db, id)).not.toBeNull();
  });

  it('I-DB-07 批量写入无丢失无主键冲突', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 60; i++) {
      ids.add(createKnowledge(db, { title: `t${i}`, content: `正文${i}`, source_type: 'note' }));
    }
    expect(ids.size).toBe(60);
    expect(listKnowledge(db, { pageSize: 100 }).total).toBe(60);
  });

  it('列表分页：第 2 页返回正确切片', () => {
    for (let i = 0; i < 25; i++) {
      createKnowledge(db, { title: `t${i}`, content: `正文${i}`, source_type: 'note' });
    }
    const p1 = listKnowledge(db, { page: 1, pageSize: 10 });
    const p2 = listKnowledge(db, { page: 2, pageSize: 10 });
    expect(p1.items.length).toBe(10);
    expect(p2.items.length).toBe(10);
    expect(p1.total).toBe(25);
    expect(p1.items[0].id).not.toBe(p2.items[0].id);
  });
});
