import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AskPage } from './AskPage.tsx';
import type { AnswerResult } from '../api/types.ts';

vi.mock('../api/client.ts', async () => {
  const actual = await vi.importActual<typeof import('../api/client.ts')>('../api/client.ts');
  return { ...actual, api: { ask: vi.fn(), getModel: vi.fn() } };
});
import { api } from '../api/client.ts';
const m = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ask']}>
      <Routes>
        <Route path="/ask" element={<AskPage />} />
        <Route path="/k/:id" element={<div>详情页</div>} />
        <Route path="/settings" element={<div>设置页</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  m.getModel.mockResolvedValue({ provider: 'local', chatModel: 'llama3.1:8b', embedModel: 'nomic', cloudBaseUrl: '', cloudApiKeyMasked: '', hasCloudApiKey: false });
});

const answer = (): AnswerResult => ({
  answer: '你整理过缓存穿透[1]和缓存雪崩[2]两类方案。',
  sources: [
    { index: 1, knowledge_id: 'k1', title: 'Redis 缓存穿透', relevance: 90 },
    { index: 2, knowledge_id: 'k2', title: '缓存雪崩应对', relevance: 80 },
  ],
  hasContext: true,
});

describe('C-QA-01 思考中状态', () => {
  it('提交后显示用户气泡与 AI 思考态', async () => {
    let resolve!: (v: AnswerResult) => void;
    m.ask.mockReturnValue(new Promise((r) => (resolve = r)));
    renderPage();
    await userEvent.type(screen.getByLabelText('提问'), '缓存相关方案');
    await userEvent.click(screen.getByRole('button', { name: '发送' }));
    expect(screen.getByText('缓存相关方案')).toBeInTheDocument();
    expect(await screen.findByTestId('thinking')).toBeInTheDocument();
    resolve(answer());
    await screen.findByTestId('answer');
  });
});

describe('C-QA-02 / C-QA-03 答案带来源且可点', () => {
  it('渲染答案正文 + 行内角标 + 来源列表，来源可跳转', async () => {
    m.ask.mockResolvedValue(answer());
    renderPage();
    await userEvent.type(screen.getByLabelText('提问'), '缓存方案');
    await userEvent.click(screen.getByRole('button', { name: '发送' }));
    const ans = await screen.findByTestId('answer');
    // 行内角标
    const cites = within(ans).getAllByTestId('cite');
    expect(cites.length).toBe(2);
    expect(cites[0]).toHaveAttribute('href', '/k/k1');
    // 来源列表
    const srcs = within(ans).getAllByTestId('source-item');
    expect(srcs.length).toBe(2);
    expect(within(srcs[0]).getByText('Redis 缓存穿透')).toBeInTheDocument();
    expect(srcs[1]).toHaveAttribute('href', '/k/k2');
  });
});

describe('C-QA-04 无相关提示', () => {
  it('hasContext=false 显示无相关内容提示，不编造答案', async () => {
    m.ask.mockResolvedValue({ answer: '', sources: [], hasContext: false });
    renderPage();
    await userEvent.type(screen.getByLabelText('提问'), '完全无关的问题');
    await userEvent.click(screen.getByRole('button', { name: '发送' }));
    expect(await screen.findByTestId('no-context')).toBeInTheDocument();
    expect(screen.getByText(/库里没有找到相关内容/)).toBeInTheDocument();
  });
});

describe('C-QA-05 模型不可用提示', () => {
  it('ask 抛 LLM 错误时提示去设置', async () => {
    const { ApiError } = await vi.importActual<typeof import('../api/client.ts')>('../api/client.ts');
    m.ask.mockRejectedValue(new ApiError('LLM_NETWORK', '模型调用网络错误', true, 502));
    renderPage();
    await userEvent.type(screen.getByLabelText('提问'), '问题');
    await userEvent.click(screen.getByRole('button', { name: '发送' }));
    const err = await screen.findByTestId('ask-error');
    expect(within(err).getByText(/无法获取答案/)).toBeInTheDocument();
    expect(within(err).getByRole('link', { name: '设置' })).toBeInTheDocument();
  });
});

describe('C-QA-06 模型标识', () => {
  it('顶栏显示当前模型', async () => {
    m.ask.mockResolvedValue(answer());
    renderPage();
    await waitFor(() => expect(screen.getByTestId('model-badge')).toHaveTextContent('本地 Ollama · llama3.1:8b'));
  });
});
