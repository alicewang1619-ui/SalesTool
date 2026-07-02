/**
 * 向量生成与存储（U-SR-02 入库触发 / U-SR-03 编辑重建 / U-SR-04 删除级联 / I-DB-03/05）。
 * 向量以 JSON float[] 存 SQLite embeddings 表；检索时进程内余弦（几千条规模足够）。
 */
import type { Db } from '../db.ts';
import { transaction } from '../db.ts';
import type { LlmProvider } from '../llm/provider.ts';
import { chunkText } from './chunk.ts';
import { config } from '../config.ts';

export interface StoredEmbedding {
  knowledge_id: string;
  chunk_index: number;
  vector: number[];
  chunk_text: string;
  model: string;
  dim: number;
}

/** 删除某知识的全部向量（重建前清旧 / 显式清理）。 */
export function deleteEmbeddings(db: Db, knowledgeId: string): void {
  db.prepare('DELETE FROM embeddings WHERE knowledge_id=?').run(knowledgeId);
}

/**
 * 为知识构建并存储向量。会先删旧再写新（重建一致性）。
 * 返回写入的块数。超长正文先截断（B-BND-05 / U-SR-08）。
 */
export async function buildEmbeddings(
  db: Db,
  provider: LlmProvider,
  knowledgeId: string,
  content: string,
): Promise<number> {
  const truncated = content.slice(0, config.maxContentChars);
  const chunks = chunkText(truncated);
  if (chunks.length === 0) {
    deleteEmbeddings(db, knowledgeId);
    return 0;
  }
  // 逐块 embedding（外部调用，不在事务内做 IO）。
  const vectors: number[][] = [];
  let dim = 0;
  for (const c of chunks) {
    const v = await provider.embed(c.text);
    if (dim === 0) dim = v.length;
    else if (v.length !== dim) {
      throw new Error(`embedding 维度不一致: ${v.length} vs ${dim}（I-LLM-04）`);
    }
    vectors.push(v);
  }
  // 一次性事务落库，保证「旧清新写」原子（I-DB-05）。
  transaction(db, () => {
    deleteEmbeddings(db, knowledgeId);
    const stmt = db.prepare(
      `INSERT INTO embeddings(knowledge_id, chunk_index, vector, chunk_text, model, dim)
       VALUES(?, ?, ?, ?, ?, ?)`,
    );
    chunks.forEach((c, i) => {
      stmt.run(knowledgeId, i, JSON.stringify(vectors[i]), c.text, provider.embedModel, dim);
    });
  });
  return chunks.length;
}

export interface EmbeddingRow {
  knowledge_id: string;
  chunk_index: number;
  vector: number[];
  chunk_text: string;
  dim: number;
}

/** 读取全部向量（检索用）。排除已软删知识。 */
export function loadAllEmbeddings(db: Db): EmbeddingRow[] {
  const rows = db
    .prepare(
      `SELECT e.knowledge_id, e.chunk_index, e.vector, e.chunk_text, e.dim
       FROM embeddings e
       JOIN knowledge k ON k.id = e.knowledge_id
       WHERE k.deleted_at IS NULL`,
    )
    .all() as { knowledge_id: string; chunk_index: number; vector: string; chunk_text: string; dim: number }[];
  return rows.map((r) => ({
    knowledge_id: r.knowledge_id,
    chunk_index: r.chunk_index,
    chunk_text: r.chunk_text,
    dim: r.dim,
    vector: JSON.parse(r.vector) as number[],
  }));
}

export function countEmbeddings(db: Db, knowledgeId: string): number {
  return Number(
    (db.prepare('SELECT COUNT(*) AS c FROM embeddings WHERE knowledge_id=?').get(knowledgeId) as { c: number }).c,
  );
}
