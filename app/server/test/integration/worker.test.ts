import { describe, it, expect } from 'vitest';
import { memDb, StubProvider, stubEmbed } from '../helpers.ts';
import type { Db } from '../../src/db.ts';
import { createKnowledge } from '../../src/services/knowledge.ts';
import { TaskWorker } from '../../src/services/worker.ts';

function statusOf(db: Db, id: string) {
  return db
    .prepare('SELECT organize_status AS s, organize_attempts AS a FROM knowledge WHERE id=?')
    .get(id) as { s: string; a: number };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('worker failed 任务有界自动重试（P0：瞬时失败不再永久搜不到）', () => {
  it('embedding 失败后自动重试，达上限即停止', async () => {
    const db = memDb();
    const provider = new StubProvider({
      embedFn: () => {
        throw new Error('embedding 暂时不可用');
      },
    });
    const id = createKnowledge(db, { title: 't', content: '一段足够长的正文用于构建向量。', source_type: 'note' });
    const worker = new TaskWorker({ db, getProvider: () => provider, maxAttempts: 3, retryBackoffMs: 0 });

    let processed = 0;
    for (let i = 0; i < 6; i++) {
      if (await worker.tick()) processed++;
      await sleep(3); // 让 updated_at 越过退避窗口
    }
    const k = statusOf(db, id);
    expect(k.s).toBe('failed');
    expect(k.a).toBe(3); // 恰好重试到上限
    expect(processed).toBe(3); // 达上限后不再被拾取
  });

  it('failed 任务在依赖恢复后重试成功转 done', async () => {
    const db = memDb();
    let down = true;
    const provider = new StubProvider({
      embedFn: (t) => {
        if (down) throw new Error('down');
        return stubEmbed(t);
      },
    });
    const id = createKnowledge(db, { title: 't', content: '缓存穿透用布隆过滤器解决。', source_type: 'note' });
    const worker = new TaskWorker({ db, getProvider: () => provider, maxAttempts: 5, retryBackoffMs: 0 });

    await worker.tick(); // 首次失败
    expect(statusOf(db, id).s).toBe('failed');
    down = false; // 依赖恢复
    await sleep(3);
    await worker.tick(); // 重试成功
    expect(statusOf(db, id).s).toBe('done');
  });
});
