/**
 * 学术论文元数据抓取（issue #9 延伸）。
 * 付费墙/反爬的论文（Science、Nature 等）正文抓不到，但 DOI / arXiv 有开放 API 可取
 * 标题 + 作者 + 摘要，足够入库检索。纯函数（URL 解析、响应解析、Markdown 组装）可无网络单测。
 */
import { config } from '../config.ts';

export interface AcademicMeta {
  title: string;
  authors: string[];
  abstract: string;
  venue?: string;
  year?: string;
  doi?: string;
  arxivId?: string;
}

/** 从 URL 提取 DOI（如 science.org/doi/10.1126/sciadv.aec3209 → 10.1126/sciadv.aec3209）。 */
export function extractDoi(url: string): string | null {
  const path = url.split(/[?#]/)[0];
  const m = path.match(/10\.\d{4,9}\/[^\s/?#]+(?:\/[^\s?#]+)*/);
  if (!m) return null;
  return m[0].replace(/[.,;)]+$/, '');
}

/** 从 URL 提取 arXiv id（新式 2401.12345，可带版本号）。 */
export function extractArxivId(url: string): string | null {
  const m = url.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})(v\d+)?/i);
  return m ? m[1] : null;
}

/** 去掉 JATS/HTML 标签并解码常见实体（Crossref 摘要是 JATS XML）。 */
function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** 解析 Crossref /works/{doi} 响应。 */
export function parseCrossref(json: unknown): AcademicMeta | null {
  const msg = (json as { message?: Record<string, unknown> })?.message;
  if (!msg) return null;
  const title = Array.isArray(msg.title) ? String((msg.title as string[])[0] ?? '').trim() : '';
  if (!title) return null;
  const authors = Array.isArray(msg.author)
    ? (msg.author as { given?: string; family?: string }[])
        .map((a) => `${a.given ?? ''} ${a.family ?? ''}`.trim())
        .filter(Boolean)
    : [];
  const abstract = typeof msg.abstract === 'string' ? stripTags(msg.abstract) : '';
  const venue = Array.isArray(msg['container-title']) ? String((msg['container-title'] as string[])[0] ?? '') : undefined;
  const parts = (msg.published as { 'date-parts'?: number[][] })?.['date-parts']?.[0];
  const year = parts?.[0] ? String(parts[0]) : undefined;
  return { title, authors, abstract, venue, year, doi: typeof msg.DOI === 'string' ? msg.DOI : undefined };
}

/** 解析 arXiv Atom XML（取首个 entry）。 */
export function parseArxivAtom(xml: string): AcademicMeta | null {
  const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/)?.[1];
  if (!entry) return null;
  const title = stripTags(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '');
  if (!title) return null;
  const abstract = stripTags(entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? '');
  const authors = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)].map((m) => stripTags(m[1])).filter(Boolean);
  const year = entry.match(/<published>(\d{4})-/)?.[1];
  const arxivId = entry.match(/arxiv\.org\/abs\/([^<\s]+)/)?.[1];
  return { title, authors, abstract, venue: 'arXiv', year, arxivId };
}

/** 元数据组装成 Markdown 正文。 */
export function metaToArticle(meta: AcademicMeta, url: string): { title: string; content: string } {
  const lines: string[] = [`# ${meta.title}`, ''];
  if (meta.authors.length) lines.push(`**作者**：${meta.authors.join('、')}`);
  const src = [meta.venue, meta.year].filter(Boolean).join(' · ');
  if (src) lines.push(`**来源**：${src}`);
  if (meta.doi) lines.push(`**DOI**：${meta.doi}`);
  if (meta.arxivId) lines.push(`**arXiv**：${meta.arxivId}`);
  lines.push('', '## 摘要', '', meta.abstract || '（该来源未提供摘要）', '', `> 原文链接：${url}`);
  return { title: meta.title, content: lines.join('\n') };
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(config.fetchTimeoutMs),
    // Crossref 建议带联系方式的 UA（polite pool）。
    headers: { 'User-Agent': 'ZhiYuan-KB/1.0 (mailto:noreply@example.com)', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(config.fetchTimeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/**
 * 若 URL 是学术论文（DOI/arXiv），从开放 API 取元数据；否则返回 null 交给普通抓取。
 * 网络失败也返回 null（回退 HTML 抓取），不抛错打断主流程。
 */
export async function fetchAcademicMeta(url: string): Promise<AcademicMeta | null> {
  const arxivId = extractArxivId(url);
  if (arxivId) {
    try {
      const meta = parseArxivAtom(await getText(`http://export.arxiv.org/api/query?id_list=${arxivId}`));
      if (meta?.abstract || meta?.title) return meta;
    } catch {
      /* 回退 */
    }
  }
  const doi = extractDoi(url);
  if (doi) {
    try {
      const meta = parseCrossref(await getJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`));
      if (meta?.title) return meta;
    } catch {
      /* 回退 */
    }
  }
  return null;
}
