/**
 * E2E 核心业务流（真实前端 + 真实后端 + 真实本地 Ollama）。
 * 覆盖 E-FLOW-01~07：链接抓取录入、抓取失败回退、检索→详情→相关、RAG 问答带来源、标签聚合、删除恢复、离线可用。
 * 不 mock 任何内部链路；外部仅用本地 fixture 静态页代替真实公众号（避免反爬/网络不稳）。
 */
import { test, expect, type Page } from '@playwright/test';

const FIXTURE_URL = 'http://localhost:8899/article.html';

/** 等待详情页异步整理完成（真实 Ollama 打标签/摘要），标签出现即成功。 */
async function waitOrganized(page: Page) {
  await expect(page.getByTestId('tags-row').locator('.tag')).toHaveCount(1, { timeout: 90_000 }).catch(() => {});
  await expect(async () => {
    const count = await page.getByTestId('tags-row').locator('.tag').count();
    expect(count).toBeGreaterThanOrEqual(1);
  }).toPass({ timeout: 90_000 });
}

test('E-FLOW-01 链接抓取 → 自动整理 → 列表可见 → 详情可读（真实抓取+真实模型）', async ({ page }) => {
  await page.goto('/new');
  await page.getByLabel('文章链接').fill(FIXTURE_URL);
  await page.getByRole('button', { name: '抓取' }).click();
  // 抓取成功提示（真实 readability 提取 fixture 正文）
  await expect(page.locator('.status.ok')).toContainText('已抓取', { timeout: 30_000 });
  await page.getByRole('button', { name: '保存入库' }).click();
  // 进入详情，真实模型整理出标签
  await expect(page).toHaveURL(/\/k\//);
  await expect(page.locator('.article h1')).toContainText('幂等');
  await waitOrganized(page);
  // 正文（去广告导航）真实可读
  await expect(page.locator('.body')).toContainText('幂等');
  await expect(page.locator('.body')).not.toContainText('版权所有');

  // 列表页能看到这条（读后端）
  await page.getByRole('button', { name: '返回全部知识' }).click();
  await expect(page).toHaveURL('http://localhost:5173/');
  await expect(page.getByTestId('knowledge-card').first()).toContainText('幂等');
});

test('E-FLOW-02 抓取失败 → 回退粘贴 → 仍能入库', async ({ page }) => {
  await page.goto('/new');
  await page.getByLabel('文章链接').fill('http://localhost:8899/不存在.html');
  await page.getByRole('button', { name: '抓取' }).click();
  await expect(page.locator('.status.fail')).toContainText('抓不到正文', { timeout: 30_000 });
  // 一键回退到粘贴文本
  await page.getByRole('button', { name: /改用「粘贴文本」/ }).click();
  await page.getByLabel('正文 / AI 对话记录').fill('这是手动粘贴回退的正文：缓存雪崩用随机过期时间缓解。');
  await page.getByRole('button', { name: '保存入库' }).click();
  await expect(page).toHaveURL(/\/k\//);
  await expect(page.locator('.body')).toContainText('缓存雪崩');
});

// 以下用例复用 E-FLOW-01/02/07 已录入的 3 条知识（幂等/缓存雪崩/向量检索），不再重复 seed，
// 避免 Ollama 模型反复换载导致超时。Playwright 在单文件内按声明顺序串行执行（workers=1）。

test('E-FLOW-03 检索 → 结果 → 详情 → 相关推荐（真实向量检索）', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('全局搜索').fill('缓存怎么防止雪崩');
  await page.getByLabel('全局搜索').press('Enter');
  await expect(page).toHaveURL(/\/search/);
  await expect(page.getByTestId('result-card').first()).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('result-card').first().click();
  await expect(page).toHaveURL(/\/k\//);
  // 相关推荐（库内其他知识，真实向量相似度）
  await expect(page.getByTestId('related-item').first()).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('related-item').first().click();
  await expect(page).toHaveURL(/\/k\//);
});

test('E-FLOW-04 RAG 问答带可点来源（真实本地模型）', async ({ page }) => {
  await page.goto('/ask');
  await page.getByLabel('提问').fill('缓存雪崩怎么应对？');
  await page.getByRole('button', { name: '发送' }).click();
  await expect(page.getByTestId('answer')).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId('source-item').first()).toBeVisible();
  await page.getByTestId('source-item').first().click();
  await expect(page).toHaveURL(/\/k\//);
});

test('E-FLOW-05 标签聚合 → 详情', async ({ page }) => {
  await page.goto('/tags');
  await expect(page.getByTestId('tag-chip').first()).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('tag-chip').first().click();
  await expect(page.getByTestId('tag-knowledge-card').first()).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('tag-knowledge-card').first().click();
  await expect(page).toHaveURL(/\/k\//);
});

test('E-FLOW-06 删除 → 回收站恢复（真实软删/恢复）', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('knowledge-card').first()).toBeVisible({ timeout: 30_000 });
  const before = await page.getByTestId('knowledge-card').count();
  await page.getByTestId('knowledge-card').first().click();
  await expect(page).toHaveURL(/\/k\//);
  await page.getByRole('button', { name: /删除/ }).click();
  await page.getByRole('button', { name: '移入回收站' }).click();
  await expect(page).toHaveURL('http://localhost:5173/');
  await expect(page.getByTestId('knowledge-card')).toHaveCount(before - 1, { timeout: 30_000 });
  // 回收站恢复
  await page.goto('/settings');
  await expect(page.getByTestId('recycle-row').first()).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('recycle-row').first().getByRole('button', { name: /恢复/ }).click();
  await page.goto('/');
  await expect(page.getByTestId('knowledge-card')).toHaveCount(before, { timeout: 30_000 });
});

test('E-FLOW-07 离线可用：本地模型走完录入→问答（无外网依赖）', async ({ page }) => {
  // 仅用本地 Ollama（默认 provider=local）。录入一条 → 真实本地整理 → 问答得到本地答案。
  await page.goto('/new');
  await page.getByRole('tab', { name: '📋 粘贴文本' }).click();
  await page.getByLabel('标题').fill('本地离线测试知识');
  await page.getByLabel('正文 / AI 对话记录').fill('向量检索通过 embedding 把文本映射为向量，用余弦相似度找语义相近的内容。');
  await page.getByRole('button', { name: '保存入库' }).click();
  await expect(page).toHaveURL(/\/k\//);
  await waitOrganized(page);

  await page.goto('/ask');
  await expect(page.getByTestId('model-badge')).toContainText('本地 Ollama');
  await page.getByLabel('提问').fill('向量检索是怎么工作的？');
  await page.getByRole('button', { name: '发送' }).click();
  await expect(page.getByTestId('answer')).toBeVisible({ timeout: 90_000 });
});
