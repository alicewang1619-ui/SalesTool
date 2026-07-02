import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SearchPage } from './SearchPage.tsx';
import type { SearchResult } from '../api/types.ts';

vi.mock('../api/client.ts', async () => {
  const actual = await vi.importActual<typeof import('../api/client.ts')>('../api/client.ts');
  return { ...actual, api: { search: vi.fn() } };
});
import { api } from '../api/client.ts';
const mockSearch = api.search as unknown as ReturnType<typeof vi.fn>;

function renderAt(q: string) {
  return render(
    <MemoryRouter initialEntries={[`/search?q=${encodeURIComponent(q)}`]}>
      <Routes>
        <Route path="/search" element={<SearchPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const result = (hits: SearchResult['hits']): SearchResult => ({ query: 'q', hits, total: hits.length });

describe('C-ST-01 结果卡片字段', () => {
  beforeEach(() => mockSearch.mockReset());
  it('卡片显示标题/命中片段/相关度/标签/来源', async () => {
    mockSearch.mockResolvedValue(
      result([
        {
          id: 'k1',
          title: 'Redis 缓存击穿',
          summary: '摘要',
          snippet: '缓存击穿指热点 key 失效用互斥锁解决',
          source_type: 'link',
          source_url: null,
          tags: ['Redis', '缓存'],
          relevance: 92,
          created_at: new Date().toISOString(),
        },
      ]),
    );
    renderAt('缓存击穿');
    const card = await screen.findByTestId('result-card');
    expect(within(card).getByText('Redis 缓存击穿')).toBeInTheDocument();
    expect(within(card).getByText('相关度 92%')).toBeInTheDocument();
    expect(within(card).getByText('Redis')).toBeInTheDocument();
    expect(within(card).getByText(/公众号/)).toBeInTheDocument();
    expect(card).toHaveAttribute('href', '/k/k1');
  });
});

describe('C-ST-02 命中高亮', () => {
  beforeEach(() => mockSearch.mockReset());
  it('命中关键词以 <mark class="hl"> 高亮', async () => {
    mockSearch.mockResolvedValue(
      result([
        {
          id: 'k1',
          title: 't',
          summary: '',
          snippet: '缓存击穿的解决方案',
          source_type: 'note',
          source_url: null,
          tags: [],
          relevance: 80,
          created_at: new Date().toISOString(),
        },
      ]),
    );
    const { container } = renderAt('击穿');
    await screen.findByTestId('result-card');
    const marks = container.querySelectorAll('.hl');
    expect(marks.length).toBeGreaterThanOrEqual(1);
    expect(Array.from(marks).some((m) => m.textContent === '击穿')).toBe(true);
  });
});

describe('C-ST-03 无结果空态', () => {
  beforeEach(() => mockSearch.mockReset());
  it('空结果显示空态与去问答/去录入引导', async () => {
    mockSearch.mockResolvedValue(result([]));
    renderAt('不存在的东西');
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('没找到相关知识')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '去问答' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '去录入' })).toBeInTheDocument();
  });
});

describe('C-ST-04 点结果卡片进详情', () => {
  beforeEach(() => mockSearch.mockReset());
  it('点击结果卡片导航到对应知识详情', async () => {
    mockSearch.mockResolvedValue(
      result([
        {
          id: 'k77',
          title: '缓存击穿',
          summary: '',
          snippet: '互斥锁解决',
          source_type: 'note',
          source_url: null,
          tags: [],
          relevance: 88,
          created_at: new Date().toISOString(),
        },
      ]),
    );
    render(
      <MemoryRouter initialEntries={['/search?q=击穿']}>
        <Routes>
          <Route path="/search" element={<SearchPage />} />
          <Route path="/k/:id" element={<div>详情页 k77</div>} />
        </Routes>
      </MemoryRouter>,
    );
    const card = await screen.findByTestId('result-card');
    expect(card).toHaveAttribute('href', '/k/k77');
    await userEvent.click(card);
    expect(await screen.findByText('详情页 k77')).toBeInTheDocument();
  });
});

describe('C-ST-05 检索加载态', () => {
  beforeEach(() => mockSearch.mockReset());
  it('检索中显示加载骨架', async () => {
    let resolve!: (v: SearchResult) => void;
    mockSearch.mockReturnValue(new Promise((r) => (resolve = r)));
    renderAt('缓存');
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(screen.getByText('正在语义检索…')).toBeInTheDocument();
    resolve(result([]));
  });
});
