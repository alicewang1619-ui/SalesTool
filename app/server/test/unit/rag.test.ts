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

  it('系统提示注入知识库真实总数，避免把来源数误当总数（issue #5）', async () => {
    const db = memDb();
    await seed(db, Array.from({ length: 7 }, (_, i) => ({ title: `知识${i}`, content: `第${i}条缓存相关内容。` })));
    let sys = '';
    const recorder = new StubProvider({
      chatFn: (msgs) => {
        sys = msgs.find((m) => m.role === 'system')?.content ?? '';
        return '答案';
      },
    });
    // Top-K=3：只有 3 条来源，但系统提示里总数应是 7
    const res = await answerQuestion(db, recorder, '缓存', { topK: 3 });
    expect(res.sources.length).toBe(3);
    expect(sys).toContain('共有 7 条知识');
    expect(sys).toContain('不代表知识库总数');
  });

  it('空库返回 hasContext=false（无相关知识空态）', async () => {
    const db = memDb();
    const res = await answerQuestion(db, stub, '任何问题');
    expect(res.hasContext).toBe(false);
    expect(res.sources).toEqual([]);
  });

  it('多轮历史按 system→历史→当前问题 顺序注入对话（issue #10）', async () => {
    const db = memDb();
    await seed(db, [{ title: '缓存穿透', content: '缓存穿透用布隆过滤器解决。' }]);
    let roles: string[] = [];
    let contents: string[] = [];
    const recorder = new StubProvider({
      chatFn: (m) => {
        roles = m.map((x) => x.role);
        contents = m.map((x) => x.content);
        return '答案';
      },
    });
    await answerQuestion(db, recorder, '它怎么解决', {
      history: [
        { role: 'user', content: '缓存穿透是什么' },
        { role: 'assistant', content: '指查询不存在的 key 打穿缓存。' },
      ],
    });
    expect(roles).toEqual(['system', 'user', 'assistant', 'user']);
    expect(contents[1]).toBe('缓存穿透是什么');
    expect(contents[2]).toContain('打穿缓存');
    expect(contents[3]).toContain('它怎么解决');
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

  it('每来源均摊预算：块很长时 Top-K 仍足额展示，不因前几条吃满预算而丢末位（issue #4）', async () => {
    const db = memDb();
    const many = Array.from({ length: 8 }, (_, i) => ({
      title: `长知识${i}`,
      content: `第${i}条，缓存关键词。`.repeat(400), // 单条正文远超总预算
    }));
    await seed(db, many);
    const res = await answerQuestion(db, new StubProvider({ chatFn: () => '答案' }), '缓存', { topK: 5 });
    expect(res.sources.length).toBe(5); // 修复前会因 6000 截断只剩 1~4 条
    expect(res.sources.map((s) => s.index)).toEqual([1, 2, 3, 4, 5]);
  });
});
