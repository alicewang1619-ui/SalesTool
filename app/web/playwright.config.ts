import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const E2E_DATA_DIR = path.join(dir, '.e2e-data');

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  // 真实本地 Ollama 较慢，单测给足；expect 轮询超时覆盖单次模型调用。
  timeout: 480_000,
  expect: { timeout: 120_000 },
  globalSetup: './e2e/global-setup.ts',
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // 后端：独立临时数据目录（global-setup 已清空），真实 Ollama。
      command: `node --experimental-transform-types --no-warnings ../server/src/index.ts`,
      cwd: dir,
      env: { ZKB_DATA_DIR: E2E_DATA_DIR, PORT: '8787', ZKB_LOG_LEVEL: 'warn' },
      url: 'http://localhost:8787/api/health',
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      // 前端 dev（/api 代理到 8787）。
      command: 'npm run dev',
      cwd: dir,
      url: 'http://localhost:5173',
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      // 抓取用本地 fixture 静态服务（E-FLOW-01 链接录入真实抓取路径）。
      command: 'python3 -m http.server 8899',
      cwd: path.join(dir, 'e2e', 'fixtures'),
      url: 'http://localhost:8899/article.html',
      timeout: 30_000,
      reuseExistingServer: true,
    },
  ],
});
