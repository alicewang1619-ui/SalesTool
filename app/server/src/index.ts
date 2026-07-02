/** 服务入口：建库 → 起后台 worker → 监听 HTTP。 */
import { config } from './config.ts';
import { getDb } from './db.ts';
import { logger } from './logger.ts';
import { createApp } from './app.ts';
import { createProvider } from './llm/provider.ts';
import { getModelSettings } from './services/settings.ts';
import { TaskWorker } from './services/worker.ts';

function main(): void {
  const db = getDb();
  const getProvider = () => createProvider(getModelSettings(db));

  const worker = new TaskWorker({ db, getProvider });
  worker.start();

  const app = createApp({
    db,
    getProvider,
    nudgeWorker: () => {
      // worker 自身轮询，这里仅触发一次即时 tick 提升响应速度。
      void worker.tick().catch((err) => logger.error('nudge tick 失败', { error: (err as Error).message }));
    },
  });

  const server = app.listen(config.port, () => {
    logger.info('服务已启动', { port: config.port, dataDir: config.dataDir });
  });

  const shutdown = (sig: string) => {
    logger.info('收到关闭信号，正在退出', { sig });
    worker.stop();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
