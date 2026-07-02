/**
 * 文本分块（U-SR-01）。
 * 按字符窗口切分，块间重叠，保证不丢字、块大小在阈值内。
 * 中文按字符计长（字符 ≈ token 量级足够），优先在段落/句子边界附近切。
 */
import { config } from '../config.ts';

export interface Chunk {
  index: number;
  text: string;
}

export function chunkText(
  content: string,
  size = config.chunkSize,
  overlap = config.chunkOverlap,
): Chunk[] {
  const text = (content ?? '').trim();
  if (!text) return [];
  if (size <= 0) throw new Error('chunk size 必须 > 0');
  if (overlap < 0 || overlap >= size) throw new Error('overlap 必须在 [0, size) 内');

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;
  const step = size - overlap;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    // 若未到结尾，尝试回退到最近的换行/句号边界，避免切断句子（但不回退过多）。
    if (end < text.length) {
      const window = text.slice(start, end);
      const lastBreak = Math.max(
        window.lastIndexOf('\n'),
        window.lastIndexOf('。'),
        window.lastIndexOf('！'),
        window.lastIndexOf('？'),
        window.lastIndexOf('. '),
      );
      if (lastBreak > size * 0.5) {
        end = start + lastBreak + 1;
      }
    }
    chunks.push({ index, text: text.slice(start, end).trim() });
    index += 1;
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + step - overlap, start + 1);
  }
  return chunks.filter((c) => c.text.length > 0).map((c, i) => ({ index: i, text: c.text }));
}
