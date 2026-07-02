/** 测试公共件：内存库、确定性桩 provider、真实 Ollama 探测。 */
import { openDatabase, type Db } from '../src/db.ts';
import type { LlmProvider, ChatMessage } from '../src/llm/provider.ts';
import { createProvider } from '../src/llm/provider.ts';
import { getModelSettings } from '../src/services/settings.ts';
import { config } from '../src/config.ts';

export function memDb(): Db {
  return openDatabase(':memory:');
}

const STUB_DIM = 64;

/** 确定性 embedding：按字符散列成袋装向量，相似文本相似度更高（可区分梯度）。 */
export function stubEmbed(text: string): number[] {
  const v = new Array<number>(STUB_DIM).fill(0);
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    v[code % STUB_DIM] += 1;
  }
  return v;
}

export interface StubOptions {
  embedFn?: (text: string) => number[] | Promise<number[]>;
  chatFn?: (messages: ChatMessage[]) => string | Promise<string>;
  healthy?: boolean;
}

export class StubProvider implements LlmProvider {
  readonly name = 'stub';
  readonly chatModel = 'stub-chat';
  readonly embedModel = 'stub-embed';
  readonly isLocal = true;
  constructor(private readonly opts: StubOptions = {}) {}
  async embed(text: string): Promise<number[]> {
    return (this.opts.embedFn ?? stubEmbed)(text);
  }
  async chat(messages: ChatMessage[]): Promise<string> {
    if (this.opts.chatFn) return this.opts.chatFn(messages);
    // 默认对整理 prompt 返回合法 JSON。
    return JSON.stringify({ tags: ['测试标签'], summary: '这是一段自动生成的摘要。' });
  }
  async health(): Promise<{ ok: boolean; detail: string }> {
    return { ok: this.opts.healthy ?? true, detail: 'stub' };
  }
}

/** 真实本地 Ollama 是否可用（用于离线/集成硬门用例）。 */
export async function ollamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${config.ollamaBaseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 构造真实本地 provider（按默认设置）。 */
export function realLocalProvider(db: Db): LlmProvider {
  return createProvider(getModelSettings(db));
}
