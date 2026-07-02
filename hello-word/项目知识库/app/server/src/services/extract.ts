/**
 * 正文抓取与提取（U-ING-01/02/03/08）。
 * - extractArticle: 纯函数，输入 HTML + url，输出 {title, content}。可用 fixture 测试，无网络。
 * - fetchAndExtract: 负责真实网络抓取（超时/非 200 抛 FetchError，驱动回退粘贴）。
 * 公众号(mp.weixin.qq.com)单独适配；其余走 Readability 通用算法。
 */
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { config } from '../config.ts';
import { sanitizeContent } from './sanitize.ts';

export class FetchError extends Error {
  constructor(
    message: string,
    readonly kind: 'http' | 'timeout' | 'network',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

export interface Article {
  title: string;
  content: string;
  /** 是否走了公众号适配。 */
  viaWeixin: boolean;
}

function isWeixin(url: string, html: string): boolean {
  return (
    /mp\.weixin\.qq\.com/i.test(url) ||
    /id=["']js_content["']/i.test(html) ||
    /rich_media_content/i.test(html)
  );
}

/** 公众号反爬/验证拦截页特征（环境异常、需验证、内容已删除等）。 */
function isWeixinBlocked(doc: Document, html: string): boolean {
  const t = (doc.querySelector('.weui-msg__title')?.textContent ?? '').trim();
  return (
    /环境异常|去验证|请在微信客户端打开|访问过于频繁/.test(html) ||
    /该内容已被发布者删除|此内容因违规无法查看|参数错误/.test(html) ||
    t.length > 0
  );
}

/** 公众号正文里的非正文噪音（赞赏/关注/工具栏/二维码等）。 */
const WEIXIN_NOISE = [
  '.rich_media_tool', '.reward_area', '.qr_code_pc', '.promotion_area',
  '#js_pc_qr_code', '.rich_media_meta_list', '.js_img_placeholder', '.code_snippet_view',
];

function textFromNode(doc: Document, selectors: string[], stripSelectors: string[] = []): string {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el && (el.textContent ?? '').trim().length > 0) {
      // 用 innerText 风格：块级元素间补换行。先剔除噪音节点。
      const tmp = new JSDOM(`<body>${el.innerHTML}</body>`).window.document.body;
      stripSelectors.forEach((s) => tmp.querySelectorAll(s).forEach((n) => n.remove()));
      tmp.querySelectorAll('p, br, div, section, h1, h2, h3, h4, h5, li, blockquote').forEach((n) => {
        n.append('\n');
      });
      return (tmp.textContent ?? '').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
    }
  }
  return '';
}

/** 从 HTML 提取正文（去导航/广告/脚本）。抓不到正文抛 FetchError('network')。 */
export function extractArticle(html: string, url = ''): Article {
  const safeHtml = sanitizeContent(html);
  const dom = new JSDOM(safeHtml, { url: url || 'https://example.invalid/' });
  const doc = dom.window.document;

  if (isWeixin(url, html)) {
    // 反爬/验证拦截页 → 明确失败信号，驱动前端回退「剪藏扩展」或「粘贴正文」。
    if (isWeixinBlocked(doc, html)) {
      throw new FetchError('公众号反爬/验证页，无法直接抓取（请用浏览器剪藏扩展或粘贴正文）', 'network');
    }
    // og:title 从原始 html 取（sanitize 会移除 <meta>）。
    const ogTitle = html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    )?.[1]?.trim();
    const title =
      doc.querySelector('#activity-name')?.textContent?.trim() ||
      ogTitle ||
      doc.querySelector('h1')?.textContent?.trim() ||
      doc.title?.trim() ||
      '未命名';
    const content = textFromNode(doc, ['#js_content', '.rich_media_content'], WEIXIN_NOISE);
    if (!content) throw new FetchError('公众号正文为空', 'network');
    return { title, content: sanitizeContent(content), viaWeixin: true };
  }

  const reader = new Readability(doc);
  const parsed = reader.parse();
  const content = (parsed?.textContent ?? '').trim();
  if (!content) {
    // 退化：取 body 文本
    const body = (doc.body?.textContent ?? '').trim();
    if (!body) throw new FetchError('正文提取为空', 'network');
    return {
      title: parsed?.title?.trim() || doc.title?.trim() || '未命名',
      content: sanitizeContent(body),
      viaWeixin: false,
    };
  }
  return {
    title: parsed?.title?.trim() || doc.title?.trim() || '未命名',
    content: sanitizeContent(content),
    viaWeixin: false,
  };
}

/** 真实抓取并提取。非 200 / 超时 / 网络错误抛 FetchError（U-ING-03）。 */
export async function fetchAndExtract(url: string): Promise<Article> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.fetchTimeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      },
      redirect: 'follow',
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new FetchError(`抓取超时(${config.fetchTimeoutMs}ms): ${url}`, 'timeout');
    }
    throw new FetchError(`抓取网络错误: ${(err as Error).message}`, 'network');
  }
  clearTimeout(timer);
  if (!res.ok) {
    throw new FetchError(`抓取失败 HTTP ${res.status}`, 'http', res.status);
  }
  const html = await res.text();
  return extractArticle(html, url);
}
