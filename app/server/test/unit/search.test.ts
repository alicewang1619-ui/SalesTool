import { describe, it, expect, beforeEach } from 'vitest';
import type { Db } from '../../src/db.ts';
import { memDb, StubProvider } from '../helpers.ts';
import { createKnowledge, softDelete, purge } from '../../src/services/knowledge.ts';
import { buildEmbeddings, countEmbeddings, loadAllEmbeddings } from '../../src/services/embedding.ts';
import { semanticSearch, relatedKnowledge } from '../../src/services/search.ts';

const provider = new StubProvider(); // 确定性袋装向量

async function seed(db: Db) {
  const k1 = createKnowledge(db, {
    title: '缓存穿透解决方案',
    content: '缓存穿透指查询不存在的数据击穿缓存，常用布隆过滤器与空值缓存解决。',
    source_type: 'note',
  });
  const k2 = createKnowledge(db, {
    title: '红烧肉做法',
    content: '红烧肉需要五花肉、冰糖、酱油，小火慢炖出油亮色泽。',
    source_type: 'note',
  });
  const k3 = createKnowledge(db, {
    title: '西湖旅游攻略',
    content: '西湖适合春天游玩，可以坐船赏断桥残雪与雷峰塔。',
    source_type: 'note',
  });
  for (const id of [k1, k2, k3]) await buildEmbeddings(db, provider, id, getContent(db, id));
  return { k1, k2, k3 };
}

function getContent(db: Db, id: string): string {
  return (db.prepare('SELECT content FROM knowledge WHERE id=?').get(id) as { content: string }).content;
}

describe('U-SR-02 入库构建 embedding', () => {
  let db: Db;
  beforeEach(() => {
    db = memDb();
  });
  it('buildEmbeddings 为知识写入向量块', async () => {
    const id = createKnowledge(db, { title: 'x', content: '这是一段足够的正文用于生成向量。', source_type: 'note' });
    const n = await buildEmbeddings(db, provider, id, getContent(db, id));
    expect(n).toBeGreaterThanOrEqual(1);
    expect(countEmbeddings(db, id)).toBe(n);
  });
});

describe('U-SR-03 编辑重建 embedding', () => {
  it('重新 build 替换旧向量，不残留', async () => {
    const db = memDb();
    const id = createKnowledge(db, { title: 'x', content: '短文。', source_type: 'note' });
    await buildEmbeddings(db, provider, id, '短文。');
    const longContent = '加长很多的正文内容用于强制分块。'.repeat(80); // 远超分块阈值
    db.prepare('UPDATE knowledge SET content=? WHERE id=?').run(longContent, id);
    const n2 = await buildEmbeddings(db, provider, id, longContent);
    expect(n2).toBeGreaterThan(1);
    expect(countEmbeddings(db, id)).toBe(n2); // 旧的 1 块已被清，等于新块数
  });
});

describe('U-SR-04 删除级联清向量', () => {
  it('软删后检索不再加载其向量；purge 后物理清零', async () => {
    const db = memDb();
    const { k1 } = await seed(db);
    expect(countEmbeddings(db, k1)).toBeGreaterThan(0);
    softDelete(db, k1);
    const loaded = loadAllEmbeddings(db).filter((r) => r.knowledge_id === k1);
    expect(loaded.length).toBe(0); // 软删的向量不参与检索
    purge(db, k1);
    expect(countEmbeddings(db, k1)).toBe(0); // FK 级联物理清除
  });
});

describe('U-SR-05 Top-K 相似度排序', () => {
  it('语义最相关项排首位', async () => {
    const db = memDb();
    await seed(db);
    const res = await semanticSearch(db, provider, '缓存穿透怎么解决', { topK: 3 });
    expect(res.hits.length).toBeGreaterThan(0);
    expect(res.hits[0].title).toContain('缓存穿透');
    // 相关度降序
    for (let i = 1; i < res.hits.length; i++) {
      expect(res.hits[i - 1].relevance).toBeGreaterThanOrEqual(res.hits[i].relevance);
    }
  });

  it('空库检索返回空结果不报错', async () => {
    const db = memDb();
    const res = await semanticSearch(db, provider, '任意问题');
    expect(res.hits).toEqual([]);
    expect(res.total).toBe(0);
  });

  it('空 query 抛错', async () => {
    const db = memDb();
    await expect(semanticSearch(db, provider, '   ')).rejects.toThrow();
  });
});

describe('U-SR-06 相关度归一化', () => {
  it('relevance 落在 0–100', async () => {
    const db = memDb();
    await seed(db);
    const res = await semanticSearch(db, provider, '缓存');
    for (const h of res.hits) {
      expect(h.relevance).toBeGreaterThanOrEqual(0);
      expect(h.relevance).toBeLessThanOrEqual(100);
    }
  });
});

describe('U-SR-09 相关推荐排除自身', () => {
  it('不把自己推荐进结果', async () => {
    const db = memDb();
    const { k1 } = await seed(db);
    const items = relatedKnowledge(db, k1, 5);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.id !== k1)).toBe(true);
  });
});
