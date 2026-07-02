/** 通用工具：ID、哈希、向量运算。 */
import { randomUUID, createHash } from 'node:crypto';

export function genId(prefix = 'k'): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

export function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** 余弦相似度。维度不一致抛错（防向量库被污染，I-LLM-04 联动）。 */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`向量维度不一致: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * 余弦相似度（-1..1）映射到 0–100 相关度（U-SR-06）。
 * 图谱对质心做均值中心化后余弦可为负（无关文本），此线性映射把 [-1,1] 映到 [0,100]，
 * 让无关文本落到 50% 以下、相关文本在 55%+，配合阈值才有区分度（见 issue #5 的中心化处理）。
 */
export function toRelevance(sim: number): number {
  const clamped = Math.max(-1, Math.min(1, sim));
  return Math.round(((clamped + 1) / 2) * 100);
}
