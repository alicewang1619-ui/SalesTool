import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // 集成/离线用例会真打本地 Ollama，给足超时。
    testTimeout: 180_000,
    hookTimeout: 60_000,
    // 串行跑：共享本地 Ollama，避免并发打爆模型。
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
