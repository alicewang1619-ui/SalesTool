import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractArticle, fetchAndExtract, FetchError } from '../../src/services/extract.ts';

const longPara = (s: string) => `<p>${s.repeat(8)}</p>`;

const NORMAL_HTML = `<!doctype html><html><head><title>缓存穿透解决方案</title></head>
<body>
  <nav>首页 关于 登录</nav>
  <header>站点导航广告 banner</header>
  <article>
    <h1>缓存穿透解决方案</h1>
    ${longPara('当大量请求查询不存在的 key 时会击穿缓存直达数据库，这就是缓存穿透。')}
    ${longPara('常见方案是布隆过滤器与空值缓存，结合互斥锁可有效缓解。')}
  </article>
  <footer>版权所有 联系我们 更多广告</footer>
  <aside>侧边栏推荐广告位</aside>
</body></html>`;

const WEIXIN_HTML = `<!doctype html><html><head><title>微信文章</title></head>
<body>
  <h1 id="activity-name">分布式锁实战</h1>
  <div id="js_content">
    <p>分布式锁可用 Redis SETNX 实现。</p>
    <p>需要注意锁续期与误删问题，可用 Redisson。</p>
  </div>
  <script>window.weixin=1</script>
</body></html>`;

describe('U-ING-01 普通网页正文提取', () => {
  it('提取正文且去除导航/广告/脚注', () => {
    const art = extractArticle(NORMAL_HTML, 'https://blog.example.com/a');
    expect(art.title).toContain('缓存穿透');
    expect(art.content).toContain('布隆过滤器');
    expect(art.content).not.toContain('版权所有');
    expect(art.content).not.toContain('侧边栏推荐广告位');
    expect(art.viaWeixin).toBe(false);
  });
});

describe('U-ING-02 公众号正文适配', () => {
  it('命中公众号规则返回正文与标题', () => {
    const art = extractArticle(WEIXIN_HTML, 'https://mp.weixin.qq.com/s/abc');
    expect(art.viaWeixin).toBe(true);
    expect(art.title).toBe('分布式锁实战');
    expect(art.content).toContain('SETNX');
    expect(art.content).toContain('Redisson');
  });
});

describe('公众号抓取增强（阶段二②）', () => {
  it('og:title 兜底标题 + section 段落 + 去赞赏/关注噪音', () => {
    const html = `<!doctype html><html><head>
      <meta property="og:title" content="Redis 高可用实战" /><title>微信</title></head>
      <body><div id="js_content">
        <section>第一段：主从复制是基础。</section>
        <section>第二段：哨兵负责故障转移。</section>
        <div class="rich_media_tool">赞赏 关注 在看</div>
        <div class="reward_area">长按二维码赞赏作者</div>
      </div></body></html>`;
    const art = extractArticle(html, 'https://mp.weixin.qq.com/s/x');
    expect(art.viaWeixin).toBe(true);
    expect(art.title).toBe('Redis 高可用实战'); // 无 #activity-name 时用 og:title
    expect(art.content).toContain('主从复制');
    expect(art.content).toContain('哨兵');
    expect(art.content).not.toContain('赞赏作者'); // 噪音被剔除
  });

  it('反爬/验证拦截页抛 FetchError，给出回退提示', () => {
    const blocked = `<!doctype html><html><body>
      <div id="js_content"></div>
      <div class="weui-msg__title">环境异常</div>
      <p>当前环境异常，完成验证后即可继续访问。去验证</p></body></html>`;
    expect(() => extractArticle(blocked, 'https://mp.weixin.qq.com/s/y')).toThrow(/反爬|验证/);
  });
});

describe('U-ING-08 抓取正文脚本清洗', () => {
  it('提取结果不含可执行脚本', () => {
    const art = extractArticle(WEIXIN_HTML, 'https://mp.weixin.qq.com/s/abc');
    expect(art.content).not.toMatch(/<script/i);
    expect(art.content).not.toContain('window.weixin');
  });
});

describe('U-ING-03 抓取失败判定', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('非 200 抛 FetchError(kind=http, status)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
    await expect(fetchAndExtract('https://x.test/404')).rejects.toMatchObject({
      name: 'FetchError',
      kind: 'http',
      status: 404,
    });
  });

  it('超时抛 FetchError(kind=timeout)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const e = new Error('aborted');
        e.name = 'AbortError';
        throw e;
      }),
    );
    await expect(fetchAndExtract('https://x.test/slow')).rejects.toMatchObject({
      name: 'FetchError',
      kind: 'timeout',
    });
  });

  it('FetchError 是可被识别的错误类型', () => {
    expect(new FetchError('x', 'network') instanceof FetchError).toBe(true);
  });
});
