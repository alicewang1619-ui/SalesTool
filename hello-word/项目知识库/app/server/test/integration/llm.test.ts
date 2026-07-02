import { describe, it, expect, beforeAll } from 'vitest';
import {
  createProvider,
  OllamaProvider,
  OpenAICompatProvider,
  LlmError,
  listLocalChatModels,
} from '../../src/llm/provider.ts';
import type { ChatMessage } from '../../src/llm/provider.ts';
import { config } from '../../src/config.ts';
import { memDb, StubProvider, ollamaAvailable } from '../helpers.ts';
import { createKnowledge } from '../../src/services/knowledge.ts';
import { processKnowledge } from '../../src/services/pipeline.ts';
import { getKnowledge } from '../../src/services/knowledge.ts';
import { countEmbeddings } from '../../src/services/embedding.ts';
import { answerQuestion } from '../../src/services/rag.ts';

let hasOllama = false;
beforeAll(async () => {
  hasOllama = await ollamaAvailable();
});

describe('I-LLM 接口契约（结构 / 切换 / 配置）', () => {
  it('I-LLM-02 本地与云端实现同构（方法签名一致）', () => {
    const local = createProvider({ provider: 'local', chatModel: 'm', embedModel: 'e', cloudBaseUrl: '', cloudApiKey: '' });
    const cloud = createProvider({
      provider: 'cloud',
      chatModel: 'm',
      embedModel: 'e',
      cloudBaseUrl: 'https://api.example.com/v1',
      cloudApiKey: 'sk-test',
    });
    expect(local).toBeInstanceOf(OllamaProvider);
    expect(cloud).toBeInstanceOf(OpenAICompatProvider);
    for (const p of [local, cloud]) {
      expect(typeof p.embed).toBe('function');
      expect(typeof p.chat).toBe('function');
      expect(typeof p.health).toBe('function');
    }
    expect(local.isLocal).toBe(true);
    expect(cloud.isLocal).toBe(false);
  });

  it('云端缺 API Key 立即 throw（红线：配置缺失不静默兜底）', () => {
    expect(() =>
      createProvider({ provider: 'cloud', chatModel: 'm', embedModel: 'e', cloudBaseUrl: 'https://x/v1', cloudApiKey: '' }),
    ).toThrow(LlmError);
  });

  it('I-LLM-05 不可达服务抛可重试 LlmError，不静默吞错', async () => {
    const dead = new OllamaProvider('http://127.0.0.1:1', 'm', 'e');
    await expect(dead.embed('x')).rejects.toMatchObject({ name: 'LlmError', retryable: true });
  });

  it('I-LLM-07 RAG 只外发检索到的最小上下文，不含无关全库内容', async () => {
    const db = memDb();
    const relevant = createKnowledge(db, {
      title: '缓存穿透',
      content: '缓存穿透用布隆过滤器解决。',
      source_type: 'note',
    });
    createKnowledge(db, { title: '红烧肉', content: '红烧肉独家秘方冰糖上色XYZ标记。', source_type: 'note' });
    // 用 stub 构建向量与捕获 prompt
    const stub = new StubProvider();
    const { buildEmbeddings } = await import('../../src/services/embedding.ts');
    for (const id of [relevant, ...db.prepare('SELECT id FROM knowledge').all().map((r) => (r as { id: string }).id)]) {
      const c = (db.prepare('SELECT content FROM knowledge WHERE id=?').get(id) as { content: string }).content;
      await buildEmbeddings(db, stub, id, c);
    }
    let captured = '';
    const recorder = new StubProvider({
      chatFn: (msgs: ChatMessage[]) => {
        captured = msgs.map((m) => m.content).join('\n');
        return '答案 [1]';
      },
    });
    const res = await answerQuestion(db, recorder, '缓存穿透怎么解决', { topK: 1 });
    expect(res.hasContext).toBe(true);
    expect(captured).toContain('缓存穿透');
    expect(captured).not.toContain('XYZ标记'); // 无关知识未外发
  });
});

describe.runIf(true)('I-LLM 真实本地 Ollama（离线可用硬门）', () => {
  it('I-LLM-01 本地 chat 返回字符串', async (ctx) => {
    if (!hasOllama) return ctx.skip(); // CI 无 Ollama 自动跳过；本地离线硬门照常验证
    const p = createProvider({ provider: 'local', chatModel: config.defaultChatModel, embedModel: config.defaultEmbedModel, cloudBaseUrl: '', cloudApiKey: '' });
    const out = await p.chat([{ role: 'user', content: '只回复两个字：你好' }]);
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('I-LLM-04 embedding 维度固定（同长度）', async (ctx) => {
    if (!hasOllama) return ctx.skip();
    const p = createProvider({ provider: 'local', chatModel: config.defaultChatModel, embedModel: config.defaultEmbedModel, cloudBaseUrl: '', cloudApiKey: '' });
    const a = await p.embed('缓存穿透');
    const b = await p.embed('完全不同的另一段较长文本内容');
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBe(b.length);
  });

  it('列出本地可对话模型：返回非空且不含 embedding 模型', async (ctx) => {
    if (!hasOllama) return ctx.skip();
    const models = await listLocalChatModels();
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
    expect(models.some((n) => /embed|bge/i.test(n))).toBe(false);
    expect(models).toContain(config.defaultChatModel);
  });

  it('I-LLM-03 / I-LLM-06 离线整理流水线端到端贯通（真实本地模型）', async (ctx) => {
    if (!hasOllama) return ctx.skip();
    const db = memDb();
    const p = createProvider({ provider: 'local', chatModel: config.defaultChatModel, embedModel: config.defaultEmbedModel, cloudBaseUrl: '', cloudApiKey: '' });
    const id = createKnowledge(db, {
      title: 'Redis 缓存穿透解决方案',
      content:
        '缓存穿透指大量请求查询数据库中根本不存在的数据，导致缓存形同虚设、压力直达数据库。常见解决方案包括布隆过滤器拦截非法 key、对空结果也做短期缓存、以及对热点 key 加互斥锁防止并发重建。',
      source_type: 'note',
    });
    const r = await processKnowledge(db, p, id);
    expect(r.ok).toBe(true);
    const k = getKnowledge(db, id)!;
    expect(k.organize_status).toBe('done');
    expect(k.tags.length).toBeGreaterThanOrEqual(1);
    expect(k.summary.length).toBeGreaterThan(0);
    expect(countEmbeddings(db, id)).toBeGreaterThan(0);
  });
});
