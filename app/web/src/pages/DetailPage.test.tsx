import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { DetailPage } from './DetailPage.tsx';
import { ToastProvider } from '../components/Toast.tsx';
import type { Knowledge } from '../api/types.ts';

vi.mock('../api/client.ts', async () => {
  const actual = await vi.importActual<typeof import('../api/client.ts')>('../api/client.ts');
  return {
    ...actual,
    api: { getKnowledge: vi.fn(), related: vi.fn(), listTags: vi.fn(), updateKnowledge: vi.fn(), setTags: vi.fn(), deleteKnowledge: vi.fn() },
  };
});
import { api } from '../api/client.ts';
const m = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function knowledge(over: Partial<Knowledge> = {}): Knowledge {
  return {
    id: 'k1', title: 'Redis 缓存穿透', content: '# 一、缓存穿透\n\n用**布隆过滤器**拦截。',
    source_type: 'link', source_url: 'https://mp.weixin.qq.com/s/x', summary: '布隆过滤器方案',
    organize_status: 'done', organize_error: null, deleted_at: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), tags: ['Redis', '缓存'], ...over,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/k/k1']}>
      <ToastProvider>
        <Routes>
          <Route path="/k/:id" element={<DetailPage />} />
          <Route path="/" element={<div>列表页</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  m.listTags.mockResolvedValue({ items: [{ name: 'Redis', count: 12 }, { name: '缓存', count: 8 }] });
});

describe('C-KM-05 详情渲染', () => {
  it('显示标题/正文/可编辑摘要/标签', async () => {
    m.getKnowledge.mockResolvedValue(knowledge());
    m.related.mockResolvedValue({ items: [] });
    renderPage();
    expect(await screen.findByText('Redis 缓存穿透')).toBeInTheDocument();
    expect(screen.getByText('布隆过滤器方案')).toBeInTheDocument();
    // 正文 Markdown 渲染（布隆过滤器加粗）
    expect(screen.getByText('布隆过滤器')).toBeInTheDocument();
    // 标签
    const tagsRow = screen.getByTestId('tags-row');
    expect(within(tagsRow).getByText('Redis')).toBeInTheDocument();
    // 摘要可编辑
    await userEvent.click(screen.getByRole('button', { name: '编辑' }));
    expect(screen.getByLabelText('编辑摘要')).toBeInTheDocument();
  });

  it('编辑摘要保存调用后端并更新', async () => {
    m.getKnowledge.mockResolvedValue(knowledge());
    m.related.mockResolvedValue({ items: [] });
    m.updateKnowledge.mockResolvedValue(knowledge({ summary: '新摘要内容' }));
    renderPage();
    await screen.findByText('Redis 缓存穿透');
    await userEvent.click(screen.getByRole('button', { name: '编辑' }));
    const ta = screen.getByLabelText('编辑摘要');
    await userEvent.clear(ta);
    await userEvent.type(ta, '新摘要内容');
    await userEvent.click(screen.getByRole('button', { name: '保存摘要' }));
    await waitFor(() => expect(m.updateKnowledge).toHaveBeenCalledWith('k1', { summary: '新摘要内容' }));
    expect(await screen.findByText('新摘要内容')).toBeInTheDocument();
  });
});

describe('C-KM-06 相关推荐可点', () => {
  it('展示相关推荐及相关度并可跳转', async () => {
    m.getKnowledge.mockResolvedValue(knowledge());
    m.related.mockResolvedValue({
      items: [
        { id: 'k2', title: '缓存雪崩', relevance: 84 },
        { id: 'k3', title: '分布式锁', relevance: 71 },
        { id: 'k4', title: '向量库选型', relevance: 52 },
      ],
    });
    renderPage();
    await screen.findByText('Redis 缓存穿透');
    const items = await screen.findAllByTestId('related-item');
    expect(items.length).toBe(3);
    expect(within(items[0]).getByText('缓存雪崩')).toBeInTheDocument();
    expect(within(items[0]).getByText('相关度 84%')).toBeInTheDocument();
    expect(items[0]).toHaveAttribute('href', '/k/k2');
  });
});

describe('C-KM-07 相关推荐空态', () => {
  it('库内容不足时显示空态', async () => {
    m.getKnowledge.mockResolvedValue(knowledge());
    m.related.mockResolvedValue({ items: [] });
    renderPage();
    await screen.findByText('Redis 缓存穿透');
    expect(await screen.findByTestId('related-empty')).toBeInTheDocument();
  });
});

describe('详情删除二次确认 → 移回收站 → 返回列表', () => {
  it('点删除弹确认，确认后调用删除并跳转', async () => {
    m.getKnowledge.mockResolvedValue(knowledge());
    m.related.mockResolvedValue({ items: [] });
    m.deleteKnowledge.mockResolvedValue({ ok: true });
    renderPage();
    await screen.findByText('Redis 缓存穿透');
    await userEvent.click(screen.getByRole('button', { name: /删除/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('删除这条知识？')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: '移入回收站' }));
    await waitFor(() => expect(m.deleteKnowledge).toHaveBeenCalledWith('k1'));
    expect(await screen.findByText('列表页')).toBeInTheDocument();
  });
});

describe('B-BND-08 访问已删除/不存在详情', () => {
  it('后端 404 时显示不存在友好提示', async () => {
    const { ApiError } = await vi.importActual<typeof import('../api/client.ts')>('../api/client.ts');
    m.getKnowledge.mockRejectedValue(new ApiError('NOT_FOUND', '知识不存在或已删除', false, 404));
    m.related.mockResolvedValue({ items: [] });
    renderPage();
    expect(await screen.findByTestId('not-found')).toBeInTheDocument();
  });
});
