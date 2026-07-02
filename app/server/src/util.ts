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
 * 字面/关键词命中打分（0–1），用于与向量相似度做混合检索（issue #13）。
 * 纯向量检索对短缩写（MAE）或字面标题（掩码图像建模）信号弱，需要字面命中来兜底。
 * 标题整串命中最强，正文整串次之，再看分词命中。
 */
export function lexicalScore(query: string, title: string, text: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = (title ?? '').toLowerCase();
  const c = (text ?? '').toLowerCase();
  let score = 0;
  if (t.includes(q)) score += 0.6;
  if (c.includes(q)) score += 0.25;

  const seen = new Set<string>();
  const add = (w: string, wt: number, wc: number) => {
    if (w.length < 2 || w === q || seen.has(w)) return;
    seen.add(w);
    if (t.includes(w)) score += wt;
    else if (c.includes(w)) score += wc;
  };
  // 空白/标点分词（英文、混排）
  for (const w of q.split(/[\s,，。/、:：()（）?？!！；;]+/)) add(w, 0.15, 0.08);
  // 中文无空格：对含中文的片段补 3-gram / 2-gram 子串匹配，命中「召回率是什么」里的「召回率」等（issue #16）。
  for (const w of q.split(/[\s,，。/、:：()（）?？!！；;]+/)) {
    if (!/[一-龥]/.test(w) || w.length < 3) continue;
    for (let i = 0; i + 3 <= w.length; i++) add(w.slice(i, i + 3), 0.12, 0.09);
    for (let i = 0; i + 2 <= w.length; i++) add(w.slice(i, i + 2), 0.08, 0.06);
  }
  return Math.min(1, score);
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
