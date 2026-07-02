import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { TagsPage } from './TagsPage.tsx';
import type { Knowledge, PageResult } from '../api/types.ts';

vi.mock('../api/client.ts', async () => {
  const actual = await vi.importActual<typeof import('../api/client.ts')>('../api/client.ts');
  return { ...actual, api: { listTags: vi.fn(), byTag: vi.fn() } };
});
import { api } from '../api/client.ts';
const m = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function mk(id: string, title: string): Knowledge {
  return {
    id, title, content: '正文', source_type: 'note', source_url: null, summary: '摘要',
    organize_status: 'done', organize_error: null, deleted_at: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), tags: ['Redis'],
  };
}
function pageOf(items: Knowledge[]): PageResult<Knowledge> {
  return { items, total: items.length, page: 1, pageSize: 50 };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tags" element={<TagsPage />} />
        <Route path="/tags/:name" element={<TagsPage />} />
        <Route path="/k/:id" element={<div>详情页</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
});

describe('C-ST-06 标签云渲染', () => {
  it('按知识数展示标签与计数', async () => {
    m.listTags.mockResolvedValue({ items: [{ name: 'Redis', count: 12 }, { name: '缓存', count: 8 }] });
    m.byTag.mockResolvedValue(pageOf([mk('k1', 'Redis 文章')]));
    renderAt('/tags/Redis');
    const chips = await screen.findAllByTestId('tag-chip');
    expect(chips.length).toBe(2);
    expect(within(chips[0]).getByText('Redis')).toBeInTheDocument();
    expect(within(chips[0]).getByText('12')).toBeInTheDocument();
  });
});

describe('C-ST-07 标签聚合', () => {
  it('选中标签展示其下知识，点卡片进详情', async () => {
    m.listTags.mockResolvedValue({ items: [{ name: 'Redis', count: 2 }] });
    m.byTag.mockResolvedValue(pageOf([mk('k1', 'Redis 缓存穿透'), mk('k2', '分布式锁')]));
    renderAt('/tags/Redis');
    await waitFor(() => expect(m.byTag).toHaveBeenCalledWith('Redis', 1, 50));
    expect(await screen.findByTestId('tag-section')).toHaveTextContent('标签「Redis」下的 2 条知识');
    const cards = await screen.findAllByTestId('tag-knowledge-card');
    expect(cards.length).toBe(2);
    expect(cards[0]).toHaveAttribute('href', '/k/k1');
  });

  it('点另一个标签切换聚合', async () => {
    m.listTags.mockResolvedValue({ items: [{ name: 'Redis', count: 2 }, { name: '缓存', count: 1 }] });
    m.byTag.mockResolvedValueOnce(pageOf([mk('k1', 'Redis 文章')]));
    renderAt('/tags/Redis');
    await screen.findAllByTestId('tag-knowledge-card');
    m.byTag.mockResolvedValueOnce(pageOf([mk('k3', '缓存文章')]));
    await userEvent.click(screen.getByRole('button', { name: /缓存/ }));
    await waitFor(() => expect(m.byTag).toHaveBeenLastCalledWith('缓存', 1, 50));
  });
});

describe('C-ST-08 无标签空态', () => {
  it('无标签显示空态引导', async () => {
    m.listTags.mockResolvedValue({ items: [] });
    renderAt('/tags');
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('还没有标签')).toBeInTheDocument();
  });
});
