import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 每次 E2E 跑前清空临时数据目录（从空库开始）并预热本地模型（消除首调冷启动）。 */
export default async function globalSetup() {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const dataDir = path.join(dir, '..', '.e2e-data');
  fs.rmSync(dataDir, { recursive: true, force: true });

  // 预热 chat + embedding，避免首个用例承担模型冷启动开销。
  const base = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const chat = process.env.ZKB_CHAT_MODEL || 'llama3.1:8b';
  const embed = process.env.ZKB_EMBED_MODEL || 'nomic-embed-text';
  try {
    await Promise.all([
      fetch(`${base}/api/chat`, {
        method: 'POST',
        body: JSON.stringify({ model: chat, stream: false, messages: [{ role: 'user', content: '回复ok' }] }),
      }),
      fetch(`${base}/api/embeddings`, {
        method: 'POST',
        body: JSON.stringify({ model: embed, prompt: '预热' }),
      }),
    ]);
  } catch {
    /* 预热失败不阻断，用例会真实报错 */
  }
}
