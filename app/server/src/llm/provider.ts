/**
 * 大模型 provider 抽象（I-LLM）。
 * 本地 Ollama 与云端 OpenAI 兼容 API 实现「同构」契约，可无损切换（I-LLM-02）。
 * - 维度固定由调用方校验（I-LLM-04）。
 * - 超时/网络错误抛 LlmError(retryable=true)，不静默吞错（I-LLM-05 / B-BND-03）。
 * - provider=cloud 缺 baseUrl/apiKey 即 throw，禁静默退回本地或硬编码厂商（红线）。
 */
import { config } from '../config.ts';
import type { ModelSettings } from '../types.ts';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly kind: 'timeout' | 'network' | 'http' | 'config' | 'response',
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

export interface LlmProvider {
  readonly name: string;
  readonly chatModel: string;
  readonly embedModel: string;
  readonly isLocal: boolean;
  embed(text: string): Promise<number[]>;
  chat(messages: ChatMessage[]): Promise<string>;
  health(): Promise<{ ok: boolean; detail: string }>;
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.llmTimeoutMs);
  try {
    return await fn(ctrl.signal);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new LlmError(`模型调用超时(${config.llmTimeoutMs}ms)`, true, 'timeout');
    }
    if (err instanceof LlmError) throw err;
    throw new LlmError(`模型调用网络错误: ${(err as Error).message}`, true, 'network');
  } finally {
    clearTimeout(timer);
  }
}

/** 本地 Ollama 实现。 */
export class OllamaProvider implements LlmProvider {
  readonly name = 'ollama';
  readonly isLocal = true;
  constructor(
    private readonly baseUrl: string,
    readonly chatModel: string,
    readonly embedModel: string,
  ) {}

  async embed(text: string): Promise<number[]> {
    return withTimeout(async (signal) => {
      const res = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.embedModel, prompt: text, keep_alive: config.ollamaKeepAlive }),
        signal,
      });
      if (!res.ok) throw new LlmError(`Ollama embeddings HTTP ${res.status}`, res.status >= 500, 'http');
      const data = (await res.json()) as { embedding?: number[] };
      if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
        throw new LlmError('Ollama 返回空 embedding', false, 'response');
      }
      return data.embedding;
    });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    return withTimeout(async (signal) => {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.chatModel, stream: false, messages, keep_alive: config.ollamaKeepAlive }),
        signal,
      });
      if (!res.ok) throw new LlmError(`Ollama chat HTTP ${res.status}`, res.status >= 500, 'http');
      const data = (await res.json()) as { message?: { content?: string } };
      const content = data.message?.content;
      if (typeof content !== 'string') throw new LlmError('Ollama chat 响应缺 content', false, 'response');
      return content;
    });
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { method: 'GET' });
      if (!res.ok) return { ok: false, detail: `Ollama HTTP ${res.status}` };
      const data = (await res.json()) as { models?: { name: string }[] };
      const names = (data.models ?? []).map((m) => m.name);
      const hasChat = names.some((n) => n === this.chatModel || n.startsWith(this.chatModel.split(':')[0]));
      const hasEmbed = names.some((n) => n === this.embedModel || n.startsWith(this.embedModel.split(':')[0]));
      if (!hasChat || !hasEmbed) {
        return { ok: false, detail: `缺模型 ${!hasChat ? this.chatModel : ''} ${!hasEmbed ? this.embedModel : ''}`.trim() };
      }
      return { ok: true, detail: `本地 Ollama 就绪（${names.length} 个模型）` };
    } catch (err) {
      return { ok: false, detail: `Ollama 未连接: ${(err as Error).message}` };
    }
  }
}

/** 云端 OpenAI 兼容实现（DeepSeek / 通义 / 智谱等）。 */
export class OpenAICompatProvider implements LlmProvider {
  readonly name = 'openai-compat';
  readonly isLocal = false;
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    readonly chatModel: string,
    readonly embedModel: string,
  ) {}

  private authHeaders() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` };
  }

  async embed(text: string): Promise<number[]> {
    return withTimeout(async (signal) => {
      const res = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify({ model: this.embedModel, input: text }),
        signal,
      });
      if (!res.ok) throw new LlmError(`云端 embeddings HTTP ${res.status}`, res.status >= 500 || res.status === 429, 'http');
      const data = (await res.json()) as { data?: { embedding: number[] }[] };
      const vec = data.data?.[0]?.embedding;
      if (!Array.isArray(vec) || vec.length === 0) throw new LlmError('云端返回空 embedding', false, 'response');
      return vec;
    });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    return withTimeout(async (signal) => {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify({ model: this.chatModel, messages, stream: false }),
        signal,
      });
      if (!res.ok) throw new LlmError(`云端 chat HTTP ${res.status}`, res.status >= 500 || res.status === 429, 'http');
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new LlmError('云端 chat 响应缺 content', false, 'response');
      return content;
    });
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, { headers: this.authHeaders() });
      if (res.status === 401) return { ok: false, detail: 'API Key 无效(401)' };
      if (!res.ok) return { ok: false, detail: `云端 HTTP ${res.status}` };
      return { ok: true, detail: '云端 API 就绪' };
    } catch (err) {
      return { ok: false, detail: `云端不可达: ${(err as Error).message}` };
    }
  }
}

/**
 * 列出本地 Ollama 已安装的可对话模型（供设置页下拉）。
 * 过滤掉 embedding 类模型（名字含 embed/bge 的不适合做 chat）。
 * Ollama 不可达时抛 LlmError(retryable)。
 */
export async function listLocalChatModels(baseUrl = config.ollamaBaseUrl): Promise<string[]> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(8000) });
  } catch (err) {
    throw new LlmError(`Ollama 不可达: ${(err as Error).message}`, true, 'network');
  }
  if (!res.ok) throw new LlmError(`Ollama HTTP ${res.status}`, res.status >= 500, 'http');
  const data = (await res.json()) as { models?: { name: string }[] };
  return (data.models ?? [])
    .map((m) => m.name)
    .filter((n) => !/embed|bge/i.test(n))
    .sort();
}

/** 按设置构造 provider。云端缺关键配置即 throw（红线：配置缺失 throw）。 */
export function createProvider(settings: ModelSettings): LlmProvider {
  if (settings.provider === 'cloud') {
    if (!settings.cloudBaseUrl) throw new LlmError('云端模式缺 baseUrl', false, 'config');
    if (!settings.cloudApiKey) throw new LlmError('云端模式缺 API Key', false, 'config');
    return new OpenAICompatProvider(
      settings.cloudBaseUrl.replace(/\/+$/, ''),
      settings.cloudApiKey,
      settings.chatModel,
      settings.embedModel,
    );
  }
  return new OllamaProvider(config.ollamaBaseUrl, settings.chatModel, settings.embedModel);
}
