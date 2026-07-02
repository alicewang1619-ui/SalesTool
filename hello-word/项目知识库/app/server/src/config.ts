/**
 * 运行配置。
 *
 * 设计原则（对齐工程健壮性红线）：
 * - 这是 local-first 单用户桌面级应用：data 目录、本地 Ollama 端点属于「声明式默认」，
 *   是产品形态本身，不是隐藏缺失值的静默兜底，故允许有显式默认常量。
 * - 真正的「生产地雷」是云端密钥：当模型 provider=cloud 却缺 apiKey/baseUrl 时，
 *   必须 throw（见 llm/provider.ts），绝不静默退回本地或硬编码厂商。
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function int(name: string, def: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return def;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`配置 ${name} 必须是数字，收到: ${raw}`);
  return n;
}

export const config = {
  port: int('PORT', 8787),
  /** 数据根目录：SQLite + 上传文件 + 备份。local-first 显式默认。 */
  dataDir: process.env.ZKB_DATA_DIR
    ? path.resolve(process.env.ZKB_DATA_DIR)
    : path.resolve(__dirname, '..', 'data'),
  /** 本地 Ollama 端点：local-first 形态本身的默认值。 */
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  /**
   * Ollama 模型常驻内存时长（keep_alive）。控制空闲后多久卸载模型释放内存。
   * 取值如 "5m"（默认，保持热）/ "30s"（省内存）/ "0"（每次调用后立即卸载）/ "-1"（永久常驻）。
   */
  ollamaKeepAlive: process.env.ZKB_OLLAMA_KEEP_ALIVE || '5m',
  /** 默认模型（首次启动写入 settings 表，之后以 DB 为准，可在设置页改）。 */
  defaultChatModel: process.env.ZKB_CHAT_MODEL || 'llama3.1:8b',
  defaultEmbedModel: process.env.ZKB_EMBED_MODEL || 'nomic-embed-text',
  /** 限流：AI 类入口每分钟最大请求数（防滥用 + 保护本地模型）。 */
  aiRateLimitPerMin: int('ZKB_AI_RATE_LIMIT', 30),
  /** 写入类入口每分钟最大请求数。 */
  writeRateLimitPerMin: int('ZKB_WRITE_RATE_LIMIT', 120),
  /** 单条正文最大字符数（超出在整理/检索前截断）。 */
  maxContentChars: int('ZKB_MAX_CONTENT_CHARS', 200_000),
  /** 上传文件大小上限（字节，默认 25MB，防 OOM）。 */
  maxUploadBytes: int('ZKB_MAX_UPLOAD_BYTES', 25 * 1024 * 1024),
  /** RAG / 检索 Top-K。 */
  topK: int('ZKB_TOP_K', 5),
  /** 文本分块大小（字符）与重叠。 */
  chunkSize: int('ZKB_CHUNK_SIZE', 800),
  chunkOverlap: int('ZKB_CHUNK_OVERLAP', 120),
  /** LLM 单次调用超时（毫秒）。本地大模型较慢，给足。 */
  llmTimeoutMs: int('ZKB_LLM_TIMEOUT_MS', 120_000),
  /** 抓取超时（毫秒）。 */
  fetchTimeoutMs: int('ZKB_FETCH_TIMEOUT_MS', 15_000),
  /** 异步整理任务僵尸阈值（毫秒）：超过此时长仍 processing 视为崩溃残留，重启时回收。 */
  taskStaleMs: int('ZKB_TASK_STALE_MS', 5 * 60_000),
  nodeEnv: process.env.NODE_ENV || 'development',
} as const;

export type Config = typeof config;
