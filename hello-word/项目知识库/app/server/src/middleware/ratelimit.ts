/**
 * 限流（红线：AI / 写入入口必限流）。
 * 进程内滑动窗口，按 IP + 桶名计数；超限返回 429 + Retry-After。
 * 单用户本地场景下也防失控脚本/重复提交打爆本地大模型。
 */
import type { Request, Response, NextFunction } from 'express';

interface Bucket {
  hits: number[];
}

const store = new Map<string, Bucket>();

function clientKey(req: Request, bucket: string): string {
  const ip = req.ip || req.socket.remoteAddress || 'local';
  return `${bucket}:${ip}`;
}

export function rateLimit(bucket: string, maxPerMin: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = clientKey(req, bucket);
    const now = Date.now();
    const windowStart = now - 60_000;
    const b = store.get(key) ?? { hits: [] };
    b.hits = b.hits.filter((t) => t > windowStart);
    if (b.hits.length >= maxPerMin) {
      const retryAfter = Math.ceil((b.hits[0] + 60_000 - now) / 1000);
      res.setHeader('Retry-After', String(Math.max(1, retryAfter)));
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: `请求过于频繁，请 ${retryAfter}s 后重试`, retryable: true },
        traceId: req.traceId,
      });
      return;
    }
    b.hits.push(now);
    store.set(key, b);
    next();
  };
}

/** 测试用：清空限流状态。 */
export function resetRateLimits(): void {
  store.clear();
}
