/**
 * 设置存取（模型 provider / 模型名 / 云端凭据）。
 * 持久化在 settings 表；首次以 config 默认值初始化。
 * API Key 存库但对外读取时脱敏（S-SEC-05）。
 */
import type { Db } from '../db.ts';
import { config } from '../config.ts';
import type { ModelSettings } from '../types.ts';

const KEYS = {
  provider: 'model.provider',
  chatModel: 'model.chat',
  embedModel: 'model.embed',
  cloudBaseUrl: 'model.cloud.baseUrl',
  cloudApiKey: 'model.cloud.apiKey',
} as const;

function get(db: Db, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key) as
    | { value: string }
    | undefined;
  return row ? row.value : null;
}

function set(db: Db, key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings(key, value) VALUES(?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
  ).run(key, value);
}

/** 读取完整模型设置（含明文 Key，仅供内部构造 provider 用，绝不直接出 API）。 */
export function getModelSettings(db: Db): ModelSettings {
  const provider = (get(db, KEYS.provider) as 'local' | 'cloud' | null) ?? 'local';
  return {
    provider,
    chatModel: get(db, KEYS.chatModel) ?? config.defaultChatModel,
    embedModel: get(db, KEYS.embedModel) ?? config.defaultEmbedModel,
    cloudBaseUrl: get(db, KEYS.cloudBaseUrl) ?? '',
    cloudApiKey: get(db, KEYS.cloudApiKey) ?? '',
  };
}

/** 对外安全视图：API Key 脱敏，绝不返回明文。 */
export function getPublicModelSettings(db: Db): Omit<ModelSettings, 'cloudApiKey'> & {
  cloudApiKeyMasked: string;
  hasCloudApiKey: boolean;
} {
  const s = getModelSettings(db);
  const key = s.cloudApiKey;
  return {
    provider: s.provider,
    chatModel: s.chatModel,
    embedModel: s.embedModel,
    cloudBaseUrl: s.cloudBaseUrl,
    cloudApiKeyMasked: key ? `${key.slice(0, 2)}****${key.slice(-2)}` : '',
    hasCloudApiKey: key.length > 0,
  };
}

export interface UpdateModelInput {
  provider?: 'local' | 'cloud';
  chatModel?: string;
  embedModel?: string;
  cloudBaseUrl?: string;
  cloudApiKey?: string;
}

export function updateModelSettings(db: Db, input: UpdateModelInput): void {
  if (input.provider) {
    if (input.provider !== 'local' && input.provider !== 'cloud') {
      throw new Error('provider 仅支持 local / cloud');
    }
    set(db, KEYS.provider, input.provider);
  }
  if (input.chatModel !== undefined) set(db, KEYS.chatModel, input.chatModel.trim());
  if (input.embedModel !== undefined) set(db, KEYS.embedModel, input.embedModel.trim());
  if (input.cloudBaseUrl !== undefined) set(db, KEYS.cloudBaseUrl, input.cloudBaseUrl.trim());
  // 仅当传入非空 Key 时更新（避免脱敏值回写覆盖真实 Key）。
  if (input.cloudApiKey !== undefined && input.cloudApiKey.length > 0) {
    set(db, KEYS.cloudApiKey, input.cloudApiKey);
  }
}
