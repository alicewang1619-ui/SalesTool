/**
 * 文件解析（U-ING-04/05/06/07）。
 * 支持 PDF / Word(docx) / Markdown(txt)。
 * - 损坏/加密文件返回明确错误而非崩溃（U-ING-07 / B-BND-06）。
 * - 仅接受内存 Buffer，不接受路径，从根上杜绝路径穿越越权读盘（S-SEC-06）。
 */
import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';
import { config } from '../config.ts';
import { sanitizeContent } from './sanitize.ts';

export type FileKind = 'pdf' | 'docx' | 'markdown';

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

export function detectKind(filename: string): FileKind {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) return 'docx';
  if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.txt')) {
    return 'markdown';
  }
  throw new ParseError(`不支持的文件类型: ${filename}`);
}

export interface ParsedFile {
  title: string;
  content: string;
}

function baseTitle(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').trim() || '未命名文件';
}

/**
 * 将文本文件 Buffer 按其真实编码解码为字符串（修复 issue #6：非 UTF-8 的 .md 上传后显示乱码）。
 * 优先按 BOM 判定；无 BOM 时先严格校验 UTF-8，失败再回退 GB18030（GBK/GB2312 超集，覆盖中文 Windows 常见编码）。
 */
function decodeText(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString('utf8'); // UTF-8 BOM
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buf.subarray(2));
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buf.subarray(2));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('gb18030').decode(buf);
  }
}

/** 解析文件 Buffer 为文本。filename 仅用于类型判定与标题，不做任何文件系统访问。 */
export async function parseFile(filename: string, buffer: Buffer): Promise<ParsedFile> {
  if (!Buffer.isBuffer(buffer)) throw new ParseError('文件内容无效');
  if (buffer.length === 0) throw new ParseError('文件为空');
  if (buffer.length > config.maxUploadBytes) {
    throw new ParseError(
      `文件过大(${buffer.length} 字节)，上限 ${config.maxUploadBytes} 字节`,
    );
  }
  const kind = detectKind(filename);
  try {
    if (kind === 'markdown') {
      const text = decodeText(buffer);
      return { title: baseTitle(filename), content: sanitizeContent(text) };
    }
    if (kind === 'pdf') {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text: extracted } = await extractText(pdf, { mergePages: true });
      const text = (Array.isArray(extracted) ? extracted.join('\n') : extracted ?? '').trim();
      if (!text) throw new ParseError('PDF 无可抽取文本（可能为扫描件或加密）');
      return { title: baseTitle(filename), content: sanitizeContent(text) };
    }
    // docx
    const result = await mammoth.extractRawText({ buffer });
    const text = (result?.value ?? '').trim();
    if (!text) throw new ParseError('Word 文档无可抽取文本');
    return { title: baseTitle(filename), content: sanitizeContent(text) };
  } catch (err) {
    if (err instanceof ParseError) throw err;
    throw new ParseError(`解析失败(${kind}): ${(err as Error).message}`);
  }
}
