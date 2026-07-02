import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { memDb, StubProvider } from '../helpers.ts';
import type { Db } from '../../src/db.ts';
import type { LlmProvider } from '../../src/llm/provider.ts';
import { OllamaProvider } from '../../src/llm/provider.ts';
import { createApp } from '../../src/app.ts';
import { resetRateLimits } from '../../src/middleware/ratelimit.ts';
import { updateModelSettings, getModelSettings } from '../../src/services/settings.ts';
import { createProvider } from '../../src/llm/provider.ts';

function makeApp(db: Db, provider: LlmProvider): Express {
  return createApp({ db, getProvider: () => provider });
}

describe('知识 CRUD + 分页 API', () => {
  let db: Db;
  let app: Express;
  beforeEach(() => {
    db = memDb();
    app = makeApp(db, new StubProvider());
    resetRateLimits();
  });

  it('创建→读回→列表分页（真实持久化）', async () => {
    const create = await request(app)
      .post('/api/knowledge')
      .send({ content: '一段缓存穿透的笔记正文。', source_type: 'note' });
    expect(create.status).toBe(201);
    const id = create.body.id;
    const detail = await request(app).get(`/api/knowledge/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.content).toContain('缓存穿透');

    for (let i = 0; i < 14; i++) {
      await request(app).post('/api/knowledge').send({ content: `批量正文${i}`, source_type: 'note' });
    }
    const list = await request(app).get('/api/knowledge?page=1&pageSize=10');
    expect(list.body.total).toBe(15);
    expect(list.body.items.length).toBe(10);
    const page2 = await request(app).get('/api/knowledge?page=2&pageSize=10');
    expect(page2.body.items.length).toBe(5);
  });

  it('B-BND-04 空库列表返回空态数据（不报错）', async () => {
    const list = await request(app).get('/api/knowledge');
    expect(list.status).toBe(200);
    expect(list.body.items).toEqual([]);
    expect(list.body.total).toBe(0);
  });

  it('访问不存在知识返回 404（B-BND-08）', async () => {
    const res = await request(app).get('/api/knowledge/k_notexist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('创建空内容被拦截 400', async () => {
    const res = await request(app).post('/api/knowledge').send({ content: '', source_type: 'note' });
    expect(res.status).toBe(400);
  });
});

describe('浏览器剪藏 /ingest/clip（阶段二）', () => {
  let db: Db;
  let app: Express;
  beforeEach(() => {
    db = memDb();
    app = makeApp(db, new StubProvider());
    resetRateLimits();
  });

  const WEIXIN_HTML = `<!doctype html><html><head><title>微信文章</title></head><body>
    <h1 id="activity-name">分布式锁实战</h1>
    <div id="js_content"><p>分布式锁可用 Redis SETNX 实现。</p><p>注意锁续期与误删，可用 Redisson。</p></div>
    <script>window.x=1</script></body></html>`;

  it('提交页面 HTML+URL → 服务端提取正文入库（绕过反爬，复用 extractArticle）', async () => {
    const res = await request(app)
      .post('/api/ingest/clip')
      .send({ url: 'https://mp.weixin.qq.com/s/abc', html: WEIXIN_HTML });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.title).toBe('分布式锁实战');
    // 读回确认真实落库、正文提取、来源类型与 url
    const detail = await request(app).get(`/api/knowledge/${res.body.id}`);
    expect(detail.body.content).toContain('SETNX');
    expect(detail.body.content).not.toMatch(/<script/i); // 脚本已清洗
    expect(detail.body.source_type).toBe('link');
    expect(detail.body.source_url).toBe('https://mp.weixin.qq.com/s/abc');
  });

  it('空 HTML 提取不到正文 → 返回错误码（不静默入空库）', async () => {
    const res = await request(app)
      .post('/api/ingest/clip')
      .send({ url: 'https://x.test/p', html: '<html><body></body></html>' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('缺 html/url 参数 → 400', async () => {
    const res = await request(app).post('/api/ingest/clip').send({ url: 'https://x.test' });
    expect(res.status).toBe(400);
  });
});

describe('S-SEC 安全', () => {
  let db: Db;
  let app: Express;
  beforeEach(() => {
    db = memDb();
    app = makeApp(db, new StubProvider());
    resetRateLimits();
  });

  it('S-SEC-03 正文 XSS：<script> 入库即被清洗', async () => {
    const create = await request(app)
      .post('/api/knowledge')
      .send({ content: '正常正文<script>alert(document.cookie)</script>结尾', source_type: 'note' });
    const detail = await request(app).get(`/api/knowledge/${create.body.id}`);
    expect(detail.body.content).not.toMatch(/<script/i);
    expect(detail.body.content).not.toContain('alert(document.cookie)');
    expect(detail.body.content).toContain('正常正文');
  });

  it('S-SEC-04 SQL 注入：恶意载荷被参数化存为普通文本', async () => {
    const payload = "'; DROP TABLE knowledge;-- 缓存";
    const create = await request(app).post('/api/knowledge').send({ content: payload, source_type: 'note' });
    expect(create.status).toBe(201);
    // 表仍在、数据完好
    const detail = await request(app).get(`/api/knowledge/${create.body.id}`);
    expect(detail.body.content).toBe(payload);
    const list = await request(app).get('/api/knowledge');
    expect(list.body.total).toBe(1);
    // 检索含 SQL 特殊字符不崩溃
    const search = await request(app).get('/api/search').query({ q: "'; DROP TABLE" });
    expect(search.status).toBe(200);
  });

  it('S-SEC-05 API Key 不泄露：写入后读回为脱敏', async () => {
    await request(app)
      .put('/api/settings/model')
      .send({ provider: 'cloud', cloudBaseUrl: 'https://api.example.com/v1', cloudApiKey: 'sk-secret-1234567890' });
    const res = await request(app).get('/api/settings/model');
    expect(JSON.stringify(res.body)).not.toContain('sk-secret-1234567890');
    expect(res.body.hasCloudApiKey).toBe(true);
    expect(res.body.cloudApiKeyMasked).toMatch(/\*\*\*\*/);
    // 导出也不含 Key
    const exp = await request(app).get('/api/backup/export');
    expect(JSON.stringify(exp.body)).not.toContain('sk-secret-1234567890');
  });

  it('S-SEC-02 切云端后设置体现 provider=cloud（供 UI 给出外发提示）', async () => {
    await request(app)
      .put('/api/settings/model')
      .send({ provider: 'cloud', cloudBaseUrl: 'https://api.example.com/v1', cloudApiKey: 'sk-x' });
    const res = await request(app).get('/api/settings/model');
    expect(res.body.provider).toBe('cloud');
  });
});

describe('B-BND 边界与失败态', () => {
  let db: Db;
  beforeEach(() => {
    db = memDb();
    resetRateLimits();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('B-BND-10 空 query 检索被拦截 400 EMPTY_QUERY', async () => {
    const app = makeApp(db, new StubProvider());
    const res = await request(app).get('/api/search').query({ q: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EMPTY_QUERY');
  });

  it('B-BND-01 抓取失败返回 502 可重试（驱动前端回退粘贴）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })));
    const app = makeApp(db, new StubProvider());
    const res = await request(app).post('/api/ingest/link').send({ url: 'https://x.test/404' });
    expect(res.status).toBe(502);
    expect(res.body.error.retryable).toBe(true);
  });

  it('B-BND-02 本地模型不可用：检索返回 502 可重试错误（前端提示去设置）', async () => {
    const deadProvider = new OllamaProvider('http://127.0.0.1:1', 'm', 'e');
    const app = makeApp(db, deadProvider);
    const id = (
      await request(makeApp(db, new StubProvider())).post('/api/knowledge').send({ content: '正文', source_type: 'note' })
    ).body.id;
    // 给它一个向量以便进入 embed 阶段
    const { buildEmbeddings } = await import('../../src/services/embedding.ts');
    await buildEmbeddings(db, new StubProvider(), id, '正文');
    const res = await request(app).get('/api/search').query({ q: '正文' });
    expect(res.status).toBe(502);
    expect(res.body.error.retryable).toBe(true);
  });

  it('B-BND-03 云端 Key 失效/不可达返回可重试错误', async () => {
    updateModelSettings(db, { provider: 'cloud', cloudBaseUrl: 'http://127.0.0.1:1/v1', cloudApiKey: 'sk-bad' });
    const app = createApp({ db, getProvider: () => createProvider(getModelSettings(db)) });
    const id = (
      await request(makeApp(db, new StubProvider())).post('/api/knowledge').send({ content: '正文', source_type: 'note' })
    ).body.id;
    const { buildEmbeddings } = await import('../../src/services/embedding.ts');
    await buildEmbeddings(db, new StubProvider(), id, '正文');
    const res = await request(app).get('/api/search').query({ q: '正文' });
    expect(res.status).toBe(502);
    expect(res.body.error.retryable).toBe(true);
  });
});

describe('限流（红线：AI 入口必限流）', () => {
  it('超过每分钟阈值返回 429', async () => {
    const db = memDb();
    const app = makeApp(db, new StubProvider());
    resetRateLimits();
    let got429 = false;
    for (let i = 0; i < 35; i++) {
      const res = await request(app).get('/api/search').query({ q: '缓存' });
      if (res.status === 429) {
        got429 = true;
        expect(res.body.error.code).toBe('RATE_LIMITED');
        expect(res.headers['retry-after']).toBeTruthy();
        break;
      }
    }
    expect(got429).toBe(true);
  });
});
