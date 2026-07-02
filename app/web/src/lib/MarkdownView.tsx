/**
 * 极简且安全的 Markdown 渲染（S-SEC-03 前端层防御）：
 * 文本部分全程构造 React 元素、绝不注入用户原始 HTML，从根上杜绝 XSS。
 * 支持：标题 / 无序列表 / 加粗 / 行内代码 / 段落 / 换行 / LaTeX 数学公式（块级 $$…$$、行内 $…$）。
 *
 * 数学公式用 KaTeX 渲染。KaTeX 的 renderToString 从 LaTeX 源生成结构受限的标记，
 * 默认 trust:false（不产出 \href / 原始 HTML）、throwOnError:false（出错渲染为提示而非抛错），
 * 因此对其输出使用 dangerouslySetInnerHTML 是安全的——注入的不是用户 HTML，而是 KaTeX 自身的公式标记。
 */
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { loadKatex } from './katexLoader.ts';

/** 按需渲染公式：动态加载 KaTeX，加载完成前用原始 tex 占位（避免闪烁空白）。 */
function Math({ tex, display }: { tex: string; display: boolean }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadKatex().then((katex) => {
      if (alive) setHtml(katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html' }));
    });
    return () => {
      alive = false;
    };
  }, [tex, display]);
  const cls = display ? 'math-block' : 'math-inline';
  if (html === null) {
    const content = <span className="math-loading">{tex}</span>;
    return display ? <div className={cls}>{content}</div> : <span className={cls}>{content}</span>;
  }
  return display ? (
    <div className={cls} dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span className={cls} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

function MathInline({ tex }: { tex: string }) {
  return <Math tex={tex} display={false} />;
}

function MathBlock({ tex }: { tex: string }) {
  return <Math tex={tex} display />;
}

interface InlineOpts {
  highlight?: string;
  /** 把答案里的 [n] 渲染成来源角标（问答页用）；不传则 [n] 按普通文本处理。 */
  renderCitation?: (n: number) => ReactNode;
}

function renderInline(text: string, opts: InlineOpts = {}): ReactNode[] {
  const { highlight, renderCitation } = opts;
  // 先按 **bold** / `code` / $行内公式$ /（可选）[n] 引用角标 切分；再对纯文本片段做高亮。
  const nodes: ReactNode[] = [];
  const regex = renderCitation
    ? /(\*\*[^*]+\*\*|`[^`]+`|\$(?!\s)[^$\n]+?(?<!\s)\$|\[\d+\])/g
    : /(\*\*[^*]+\*\*|`[^`]+`|\$(?!\s)[^$\n]+?(?<!\s)\$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  const pushText = (s: string) => {
    if (!s) return;
    if (highlight && highlight.trim()) {
      const terms = highlight.trim().split(/\s+/).filter((t) => t.length >= 1);
      const esc = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      if (esc) {
        const parts = s.split(new RegExp(`(${esc})`, 'gi'));
        parts.forEach((p) => {
          if (terms.some((t) => t.toLowerCase() === p.toLowerCase())) {
            nodes.push(<mark key={key++} className="hl">{p}</mark>);
          } else if (p) {
            nodes.push(<Fragment key={key++}>{p}</Fragment>);
          }
        });
        return;
      }
    }
    nodes.push(<Fragment key={key++}>{s}</Fragment>);
  };
  while ((m = regex.exec(text)) !== null) {
    pushText(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) nodes.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('`')) nodes.push(<code key={key++} className="md-code">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith('$')) nodes.push(<MathInline key={key++} tex={tok.slice(1, -1)} />);
    else nodes.push(<Fragment key={key++}>{renderCitation!(Number(tok.slice(1, -1)))}</Fragment>);
    last = m.index + tok.length;
  }
  pushText(text.slice(last));
  return nodes;
}

/** 渲染不含块级公式的一段文本（标题/列表/段落）。 */
function renderTextBlocks(content: string, opts: InlineOpts, startKey: number): ReactNode[] {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];
  let listBuf: string[] = [];
  let key = startKey;
  const flushList = () => {
    if (listBuf.length) {
      blocks.push(
        <ul key={key++} className="md-ul">
          {listBuf.map((li, i) => (
            <li key={i}>{renderInline(li, opts)}</li>
          ))}
        </ul>,
      );
      listBuf = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      listBuf.push(line.replace(/^\s*[-*]\s+/, ''));
      continue;
    }
    flushList();
    if (/^#{1,3}\s+/.test(line)) {
      const level = line.match(/^#+/)![0].length;
      const txt = line.replace(/^#+\s+/, '');
      const cls = `md-h${level}`;
      blocks.push(
        level === 1 ? <h2 key={key++} className={cls}>{renderInline(txt, opts)}</h2>
        : level === 2 ? <h3 key={key++} className={cls}>{renderInline(txt, opts)}</h3>
        : <h4 key={key++} className={cls}>{renderInline(txt, opts)}</h4>,
      );
    } else if (line.trim() === '') {
      blocks.push(<div key={key++} className="md-gap" />);
    } else {
      blocks.push(<p key={key++} className="md-p">{renderInline(line, opts)}</p>);
    }
  }
  flushList();
  return blocks;
}

export function MarkdownView({
  content,
  highlight,
  renderCitation,
}: {
  content: string;
  highlight?: string;
  renderCitation?: (n: number) => ReactNode;
}) {
  const opts: InlineOpts = { highlight, renderCitation };
  const src = content ?? '';
  const blocks: ReactNode[] = [];
  let base = 0;

  // 非代码段：先抽块级公式 $$…$$（可跨行），其余按普通 Markdown 渲染。
  const renderText = (text: string) => {
    const segs = text.split(/\$\$([\s\S]*?)\$\$/);
    segs.forEach((seg, i) => {
      if (i % 2 === 1) {
        const tex = seg.trim();
        if (tex) blocks.push(<MathBlock key={`m${base}-${i}`} tex={tex} />);
      } else if (seg) {
        blocks.push(...renderTextBlocks(seg, opts, base * 100000 + i * 1000));
      }
    });
    base += 1;
  };

  // 先抽出围栏代码块 ```lang\n…\n```：原样渲染，不参与 Markdown/公式解析（issue #11 Python 代码显示错乱）。
  const fence = /```[^\n]*\n([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let codeKey = 0;
  while ((m = fence.exec(src)) !== null) {
    if (m.index > last) renderText(src.slice(last, m.index));
    blocks.push(
      <pre key={`code-${codeKey++}`} className="md-pre">
        <code>{m[1].replace(/\n$/, '')}</code>
      </pre>,
    );
    last = m.index + m[0].length;
  }
  if (last < src.length) renderText(src.slice(last));

  return <div className="markdown">{blocks}</div>;
}
