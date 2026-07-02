/**
 * 内容安全清洗（S-SEC-03 / U-ING-08）。
 * 抓取/上传/粘贴的外部内容入库前，移除可执行脚本与危险属性，
 * 作为 XSS 纵深防御的服务端一层（前端渲染层再做一层）。
 */

const SCRIPT_RE = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;
const STYLE_RE = /<style\b[^>]*>[\s\S]*?<\/style\s*>/gi;
const IFRAME_RE = /<\/?(iframe|object|embed|link|meta)\b[^>]*>/gi;
// 事件处理器属性： onerror= onclick= 等
const EVENT_ATTR_RE = /\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
// javascript: 协议
const JS_PROTO_RE = /javascript\s*:/gi;

/** 清洗外部内容中的可执行片段。保留普通文本/Markdown。 */
export function sanitizeContent(input: string): string {
  if (!input) return '';
  let out = input;
  out = out.replace(SCRIPT_RE, '');
  out = out.replace(STYLE_RE, '');
  out = out.replace(IFRAME_RE, '');
  out = out.replace(EVENT_ATTR_RE, '');
  out = out.replace(JS_PROTO_RE, 'blocked:');
  return out;
}

/** 是否仍含可执行脚本（测试断言用）。用非全局正则避免 lastIndex 状态污染。 */
export function containsExecutableScript(s: string): boolean {
  return (
    /<script\b/i.test(s) ||
    /\son\w+\s*=/i.test(s) ||
    /javascript\s*:/i.test(s)
  );
}
