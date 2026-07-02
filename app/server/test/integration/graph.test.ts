import { describe, it, expect } from 'vitest';
import { memDb, StubProvider } from '../helpers.ts';
import type { Db } from '../../src/db.ts';
import { createKnowledge } from '../../src/services/knowledge.ts';
import { buildEmbeddings } from '../../src/services/embedding.ts';
import { buildGraph } from '../../src/services/graph.ts';

/**
 * 受控“各向异性”嵌入：大共同分量（各向异性地板）+ 小主题分量。
 * 这样任意两文本的【原始】余弦都 >0.9（红烧肉 vs 缓存也高达 0.93），复现真实句向量的问题；
 * buildGraph 做均值中心化后，缓存簇仍强相关、红烧肉转为强负相关 → 验证 issue #5 的修复。
 */
function anisoEmbed(text: string): number[] {
  const v = new Array<number>(8).fill(5); // 各向异性共同分量
  if (text.includes('缓存')) v[0] += 4; // 缓存簇共同方向
  if (text.includes('穿透')) v[1] += 1.2;
  if (text.includes('击穿')) v[2] += 1.2;
  if (text.includes('雪崩')) v[3] += 1.2;
  if (text.includes('红烧肉')) {
    v[4] += 4;
    v[5] += 1.2;
  } // 完全不同方向
  return v;
}
const stub = new StubProvider({ embedFn: anisoEmbed });

async function seed(db: Db) {
  const data = [
    { t: '缓存穿透', c: '缓存穿透用布隆过滤器拦截不存在的 key 缓存穿透。' },
    { t: '缓存击穿', c: '缓存击穿用互斥锁解决热点 key 失效缓存击穿。' },
    { t: '缓存雪崩', c: '缓存雪崩给过期时间加随机值缓存雪崩。' },
    { t: '红烧肉', c: '红烧肉需要五花肉冰糖酱油慢炖红烧肉做法。' },
  ];
  const ids: string[] = [];
  for (const d of data) {
    const id = createKnowledge(db, { title: d.t, content: d.c, source_type: 'note' });
    await buildEmbeddings(db, stub, id, d.c);
    ids.push(id);
  }
  return ids;
}

describe('关系图谱（阶段二③）', () => {
  it('节点对应知识、边来自向量相似且无向去重', async () => {
    const db = memDb();
    const ids = await seed(db);
    const g = buildGraph(db, { minRelevance: 0, edgesPerNode: 3 });
    // 4 个节点
    expect(g.nodes.length).toBe(4);
    expect(g.nodes.map((n) => n.id).sort()).toEqual([...ids].sort());
    // 边无向去重：不存在 (a,b) 与 (b,a) 同时出现
    const keys = g.edges.map((e) => (e.source < e.target ? `${e.source}|${e.target}` : `${e.target}|${e.source}`));
    expect(new Set(keys).size).toBe(keys.length);
    // 权重 0-100
    for (const e of g.edges) expect(e.weight).toBeGreaterThanOrEqual(0), expect(e.weight).toBeLessThanOrEqual(100);
    // degree 正确累计
    const byDegree = new Map(g.nodes.map((n) => [n.id, n.degree]));
    for (const e of g.edges) {
      expect(byDegree.get(e.source)).toBeGreaterThan(0);
    }
  });

  it('高阈值时缓存三兄弟相互连通、红烧肉相对孤立', async () => {
    const db = memDb();
    await seed(db);
    const g = buildGraph(db, { minRelevance: 60, edgesPerNode: 3 });
    const idByTitle = new Map(g.nodes.map((n) => [n.title, n.id]));
    const hong = idByTitle.get('红烧肉')!;
    const cacheIds = ['缓存穿透', '缓存击穿', '缓存雪崩'].map((t) => idByTitle.get(t)!);
    const hongDegree = g.nodes.find((n) => n.id === hong)!.degree;
    const cacheDegreeSum = cacheIds.reduce((s, id) => s + g.nodes.find((n) => n.id === id)!.degree, 0);
    // 缓存簇内部连边应明显多于红烧肉
    expect(cacheDegreeSum).toBeGreaterThan(hongDegree);
  });

  it('默认阈值下无关知识（红烧肉）不连边，但缓存簇仍连通（issue #5 中心化修复）', async () => {
    const db = memDb();
    await seed(db);
    const g = buildGraph(db); // 默认 minRelevance=55
    const hong = g.nodes.find((n) => n.title === '红烧肉')!;
    const cacheSum = ['缓存穿透', '缓存击穿', '缓存雪崩']
      .map((t) => g.nodes.find((n) => n.title === t)!.degree)
      .reduce((s, d) => s + d, 0);
    // 原始余弦下红烧肉与缓存高达 0.93 会误连；中心化后红烧肉转负相关 → 零连边
    expect(hong.degree).toBe(0);
    // 缓存三兄弟仍应相互连通（证明不是把所有边都杀掉）
    expect(cacheSum).toBeGreaterThan(0);
    // 红烧肉不应出现在任何一条边里
    expect(g.edges.some((e) => e.source === hong.id || e.target === hong.id)).toBe(false);
  });

  it('空库返回空图不报错', () => {
    const db = memDb();
    const g = buildGraph(db);
    expect(g.nodes).toEqual([]);
    expect(g.edges).toEqual([]);
  });
});
