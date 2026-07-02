import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { KnowledgeListPage } from './KnowledgeListPage.tsx';
import type { Knowledge, PageResult } from '../api/types.ts';

vi.mock('../api/client.ts', () => ({
  api: { listKnowledge: vi.fn() },
}));
import { api } from '../api/client.ts';

const mockList = api.listKnowledge as unknown as ReturnType<typeof vi.fn>;

function mkKnowledge(over: Partial<Knowledge>): Knowledge {
  return {
    id: 'k1',
    title: '标题',
    content: '正文',
    source_type: 'link',
    source_url: null,
    summary: '一段摘要',
    organize_status: 'done',
    organize_error: null,
    deleted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: ['Redis'],
    ...over,
  };
}

function page(items: Knowledge[], total = items.length): PageResult<Knowledge> {
  return { items, total, page: 1, pageSize: 12 };
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <KnowledgeListPage />
    </MemoryRouter>,
  );

describe('C-KM-01 卡片字段与排序', () => {
  beforeEach(() => mockList.mockReset());
  it('卡片显示标题/摘要/标签/来源/时间，链接到详情', async () => {
    mockList.mockResolvedValue(
      page([
        mkKnowledge({ id: 'k1', title: 'Redis 缓存穿透', summary: '布隆过滤器方案', tags: ['Redis', '缓存'], source_type: 'link' }),
      ]),
    );
    renderPage();
    const card = await screen.findByTestId('knowledge-card');
    expect(within(card).getByText('Redis 缓存穿透')).toBeInTheDocument();
    expect(within(card).getByText('布隆过滤器方案')).toBeInTheDocument();
    expect(within(card).getByText('Redis')).toBeInTheDocument();
    expect(within(card).getByText(/公众号/)).toBeInTheDocument();
    expect(card).toHaveAttribute('href', '/k/k1');
  });

  it('未整理完成的卡片显示「AI 正在整理」', async () => {
    mockList.mockResolvedValue(page([mkKnowledge({ summary: '', organize_status: 'processing' })]));
    renderPage();
    expect(await screen.findByText(/AI 正在整理/)).toBeInTheDocument();
  });
});

describe('C-KM-02 空库引导', () => {
  beforeEach(() => mockList.mockReset());
  it('空库显示欢迎引导与新增第一条按钮', async () => {
    mockList.mockResolvedValue(page([], 0));
    renderPage();
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /新增第一条知识/ })).toBeInTheDocument();
  });
});

describe('C-KM-03 来源筛选', () => {
  beforeEach(() => mockList.mockReset());
  it('点「公众号」chip 用 source=link 重新请求', async () => {
    mockList.mockResolvedValue(page([mkKnowledge({})]));
    renderPage();
    await screen.findByTestId('knowledge-card');
    await userEvent.click(screen.getByRole('button', { name: '公众号' }));
    await waitFor(() => {
      expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'link' }));
    });
  });
});

describe('C-KM-04 无限滚动 / 加载更多', () => {
  beforeEach(() => mockList.mockReset());
  it('未加载满时点加载更多请求下一页并追加', async () => {
    mockList
      .mockResolvedValueOnce(page([mkKnowledge({ id: 'k1', title: '第一条' })], 2))
      .mockResolvedValueOnce({ items: [mkKnowledge({ id: 'k2', title: '第二条' })], total: 2, page: 2, pageSize: 12 });
    renderPage();
    await screen.findByText('第一条');
    await userEvent.click(screen.getByRole('button', { name: '加载更多' }));
    expect(await screen.findByText('第二条')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('没有更多了')).toBeInTheDocument());
  });
});
