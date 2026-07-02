/** 为每个请求注入 trace id 与子 logger，并记录访问日志（10 分钟可定位）。 */
import type { Request, Response, NextFunction } from 'express';
import { newTraceId, logger, type Logger } from '../logger.ts';

declare global {
  namespace Express {
    interface Request {
      traceId: string;
      log: Logger;
    }
  }
}

export function traceMiddleware(req: Request, res: Response, next: NextFunction): void {
  const traceId = (req.header('x-trace-id') || newTraceId()).slice(0, 64);
  req.traceId = traceId;
  req.log = logger.child({ traceId, method: req.method, path: req.path });
  res.setHeader('x-trace-id', traceId);
  const start = Date.now();
  res.on('finish', () => {
    req.log.info('请求完成', { status: res.statusCode, ms: Date.now() - start });
  });
  next();
}
