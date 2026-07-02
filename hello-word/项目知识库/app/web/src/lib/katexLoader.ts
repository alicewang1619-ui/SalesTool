/**
 * 按需加载 KaTeX（代码分割）：只有当笔记里出现数学公式时才动态拉取 katex 及其 CSS，
 * 避免把 ~270KB 的 katex 打进首屏主包。加载结果缓存，全站只拉一次。
 */
type Katex = typeof import('katex')['default'];

let katexPromise: Promise<Katex> | null = null;

export function loadKatex(): Promise<Katex> {
  if (!katexPromise) {
    katexPromise = Promise.all([
      import('katex'),
      import('katex/dist/katex.min.css'),
    ]).then(([mod]) => mod.default);
  }
  return katexPromise;
}
