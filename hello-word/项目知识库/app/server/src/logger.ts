/**
 * 结构化日志（对齐红线：时间 / 级别 / trace id，出事 10 分钟可定位）。
 * 输出单行 JSON 到 stdout/stderr，便于检索与采集。禁止裸 console.error 当日志。
 */
import { randomUUID } from 'node:crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: LogLevel = (process.env.ZKB_LOG_LEVEL as LogLevel) || 'info';

function redact(meta: Record<string, unknown>): Record<string, unknown> {
  // 防 API Key 等敏感字段进日志（S-SEC-05）。
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (/key|token|secret|password|authorization/i.test(k) && typeof v === 'string') {
      out[k] = v.length <= 4 ? '****' : `${v.slice(0, 2)}****${v.slice(-2)}`;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function emit(level: LogLevel, msg: string, meta: Record<string, unknown> = {}): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...redact(meta),
  });
  if (level === 'error' || level === 'warn') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

export function createLogger(bindings: Record<string, unknown> = {}): Logger {
  const wrap = (level: LogLevel) => (msg: string, meta: Record<string, unknown> = {}) =>
    emit(level, msg, { ...bindings, ...meta });
  return {
    debug: wrap('debug'),
    info: wrap('info'),
    warn: wrap('warn'),
    error: wrap('error'),
    child: (extra) => createLogger({ ...bindings, ...extra }),
  };
}

export const logger = createLogger({ svc: 'zkb-server' });

export function newTraceId(): string {
  return randomUUID();
}
