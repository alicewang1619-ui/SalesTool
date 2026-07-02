import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { EditPage } from './EditPage.tsx';
import { ToastProvider } from '../components/Toast.tsx';
import type { Knowledge } from '../api/types.ts';

vi.mock('../api/client.ts', async () => {
  const actual = await vi.importActual<typeof import('../api/client.ts')>('../api/client.ts');
  return { ...actual, api: { getKnowledge: vi.fn(), updateKnowledge: vi.fn(), setTags: vi.fn(), deleteKnowledge: vi.fn() } };
});
import { api } from '../api/client.ts';
const m = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function knowledge(over: Partial<Knowledge> = {}): Knowledge {
  return {
    id: 'k1', title: '原标题', content: '原正文内容', source_type: 'note', source_url: null,
    summary: '原摘要', organize_status: 'done', organize_error: null, deleted_at: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), tags: ['Redis'], ...over,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/k/k1/edit']}>
      <ToastProvider>
        <Routes>
          <Route path="/k/:id/edit" element={<EditPage />} />
          <Route path="/k/:id" element={<div>详情页</div>} />
          <Route path="/" element={<div>列表页</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  m.getKnowledge.mockResolvedValue(knowledge());
});

describe('编辑保存', () => {
  it('修改正文保存 → 调用 PATCH 并跳回详情（后端重建 embedding）', async () => {
    m.updateKnowledge.mockResolvedValue(knowledge({ content: '新正文' }));
    renderPage();
    const ta = await screen.findByLabelText('正文（Markdown）');
    await userEvent.clear(ta);
    await userEvent.type(ta, '新正文');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(m.updateKnowledge).toHaveBeenCalledWith('k1', expect.objectContaining({ content: '新正文' })));
    expect(await screen.findByText('详情页')).toBeInTheDocument();
  });

  it('标签变更时同步调用 setTags', async () => {
    m.updateKnowledge.mockResolvedValue(knowledge());
    m.setTags.mockResolvedValue(knowledge({ tags: ['Redis', '面试'] }));
    renderPage();
    await screen.findByLabelText('正文（Markdown）');
    await userEvent.click(screen.getByRole('button', { name: '＋ 加标签' }));
    await userEvent.type(screen.getByLabelText('新标签'), '面试');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(m.setTags).toHaveBeenCalledWith('k1', ['Redis', '面试']));
  });
});

describe('C-KM-08 / C-KM-09 删除二次确认 → 回收站', () => {
  it('点删除弹确认，确认后软删并回列表', async () => {
    m.deleteKnowledge.mockResolvedValue({ ok: true });
    renderPage();
    await screen.findByLabelText('正文（Markdown）');
    await userEvent.click(screen.getByRole('button', { name: /删除这条知识/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('删除这条知识？')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: '移到回收站' }));
    await waitFor(() => expect(m.deleteKnowledge).toHaveBeenCalledWith('k1'));
    expect(await screen.findByText('列表页')).toBeInTheDocument();
  });

  it('删除确认弹窗可 Esc 关闭（a11y）', async () => {
    renderPage();
    await screen.findByLabelText('正文（Markdown）');
    await userEvent.click(screen.getByRole('button', { name: /删除这条知识/ }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('C-KM-10 离开拦截', () => {
  afterEach(() => vi.restoreAllMocks());
  it('有未保存修改时取消触发确认拦截', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();
    const titleInput = await screen.findByLabelText('标题');
    await userEvent.type(titleInput, '改动');
    await userEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(confirmSpy).toHaveBeenCalled();
    // 用户选择留下，仍在编辑页
    expect(screen.getByLabelText('正文（Markdown）')).toBeInTheDocument();
  });
});
