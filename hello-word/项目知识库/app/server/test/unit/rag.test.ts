import { describe, it, expect } from 'vitest';
import type { Db } from '../../src/db.ts';
import { memDb, StubProvider } from '../helpers.ts';
import { createKnowledge } from '../../src/services/knowledge.ts';
import { buildEmbeddings } from '../../src/services/embedding.ts';
import { answerQuestion } from '../../src/services/rag.ts';

const stub = new StubProvider();

async function seed(db: Db, contents: { title: string; content: string }[]) {
  for (const c of contents) {
    const id = createKnowledge(db, { title: c.title, content: c.content, source_type: 'note' });
    await buildEmbeddings(db, stub, id, c.content);
  }
}

describe('U-SR-07 RAG 收集来源', () => {
  it('返回答案并带 knowledge_id 来源列表（编号从 1）', async () => {
    const db = memDb();
    await seed(db, [
      { title: '缓存穿透', content: '缓存穿透用布隆过滤器解决。' },
      { title: '缓存雪崩', content: '缓存雪崩可用随机过期时间缓解。' },
    ]);
    const recorder = new StubProvider({ chatFn: () => '综合答案，引用 [1]。' });
    const res = await answerQuestion(db, recorder, '缓存相关方案', { topK: 5 });
    expect(res.hasContext).toBe(true);
    expect(res.sources.length).toBeGreaterThanOrEqual(1);
    expect(res.sources[0].index).toBe(1);
    expect(res.sources[0].knowledge_id).toBeTruthy();
    expect(res.answer).toContain('答案');
  });

  it('空库返回 hasContext=false（无相关知识空态）', async () => {
    const db = memDb();
    const res = await answerQuestion(db, stub, '任何问题');
    expect(res.hasContext).toBe(false);
    expect(res.sources).toEqual([]);
  });
});

describe('U-SR-08 超长上下文截断', () => {
  it('Top-K 限制来源数量，超长上下文不撑爆', async () => {
    const db = memDb();
    const many = Array.from({ length: 10 }, (_, i) => ({
      title: `知识${i}`,
      content: `这是第${i}条知识的正文，包含缓存相关关键词。`.repeat(50),
    }));
    await seed(db, many);
    const res = await answerQuestion(db, new StubProvider({ chatFn: () => '答案' }), '缓存', { topK: 3 });
    expect(res.sources.length).toBeLessThanOrEqual(3);
    expect(res.hasContext).toBe(true);
  });
});
