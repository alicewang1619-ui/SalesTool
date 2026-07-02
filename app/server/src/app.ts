/** Express 应用工厂。把数据层与 provider 工厂注入路由，便于测试。 */
import express, { type Express } from 'express';
import cors from 'cors';
import { traceMiddleware } from './middleware/trace.ts';
import { errorHandler } from './middleware/error.ts';
import { buildRouter, type RouteCtx } from './routes.ts';

export function createApp(ctx: RouteCtx): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  // base64 文件经 JSON 上传，留足体积（25MB 文件 ≈ 34MB base64）。
  app.use(express.json({ limit: '40mb' }));
  app.use(traceMiddleware);
  app.use('/api', buildRouter(ctx));
  app.use(errorHandler);
  return app;
}
