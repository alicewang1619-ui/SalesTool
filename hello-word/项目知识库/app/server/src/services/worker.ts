/**
 * 后台整理 worker（红线：重活与 Web 请求解耦 + 崩溃恢复 + 超时）。
 * - 录入请求立即返回，整理(LLM/embedding)在此后台循环里串行处理，不阻塞 HTTP。
 * - 启动时回收僵尸任务（recoverStuckTasks）。
 * - 串行处理避免并发打爆本地大模型。
 * 可被主进程内嵌启动，也可作为独立进程入口（见 worker-entry.ts）。
 */
import type { Db } from '../db.ts';
import { recoverStuckTasks } from '../db.ts';
import type { LlmProvider } from '../llm/provider.ts';
import { processKnowledge } from './pipeline.ts';
import { logger } from '../logger.ts';

export interface WorkerDeps {
  db: Db;
  /** 每次取 provider（设置可能在运行中被改）。 */
  getProvider: () => LlmProvider;
  pollIntervalMs?: number;
}

export class TaskWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = false;

  constructor(private readonly deps: WorkerDeps) {}

  /** 取一条待处理知识 id。 */
  private nextPendingId(): string | null {
    const row = this.deps.db
      .prepare(
        `SELECT id FROM knowledge
         WHERE organize_status='pending' AND deleted_at IS NULL
         ORDER BY created_at ASC LIMIT 1`,
      )
      .get() as { id: string } | undefined;
    return row?.id ?? null;
  }

  /** 处理一轮（处理至多一条），返回是否处理了任务。供测试直接驱动。 */
  async tick(): Promise<boolean> {
    if (this.running) return false;
    this.running = true;
    try {
      const id = this.nextPendingId();
      if (!id) return false;
      const provider = this.deps.getProvider();
      await processKnowledge(this.deps.db, provider, id);
      return true;
    } finally {
      this.running = false;
    }
  }

  start(): void {
    const recovered = recoverStuckTasks(this.deps.db);
    logger.info('整理 worker 启动', { recovered });
    const interval = this.deps.pollIntervalMs ?? 1500;
    const loop = async () => {
      if (this.stopped) return;
      try {
        await this.tick();
      } catch (err) {
        logger.error('worker tick 异常', { error: (err as Error).message });
      }
      if (!this.stopped) this.timer = setTimeout(loop, interval);
    };
    this.timer = setTimeout(loop, interval);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
