import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { IngestPage } from './IngestPage.tsx';
import { ToastProvider } from '../components/Toast.tsx';
import { ApiError } from '../api/client.ts';

vi.mock('../api/client.ts', async () => {
  const actual = await vi.importActual<typeof import('../api/client.ts')>('../api/client.ts');
  return { ...actual, api: { ingestLink: vi.fn(), ingestFile: vi.fn(), createKnowledge: vi.fn() } };
});
import { api } from '../api/client.ts';
const mLink = api.ingestLink as unknown as ReturnType<typeof vi.fn>;
const mCreate = api.createKnowledge as unknown as ReturnType<typeof vi.fn>;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/new']}>
      <ToastProvider>
        <Routes>
          <Route path="/new" element={<IngestPage />} />
          <Route path="/k/:id" element={<div>详情页 {location.pathname}</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mLink.mockReset();
  mCreate.mockReset();
  localStorage.clear();
});

describe('C-ING-01 四 Tab 切换', () => {
  it('切换 Tab 显示对应面板', async () => {
    renderPage();
    // 默认贴链接
    expect(screen.getByLabelText('文章链接')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: '📋 粘贴文本' }));
    expect(screen.getByLabelText('正文 / AI 对话记录')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: '✍️ 写一条' }));
    expect(screen.getByLabelText('正文（Markdown）')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: '📄 上传文件' }));
    expect(screen.getByLabelText('上传文件')).toBeInTheDocument();
  });
});

describe('C-ING-02 / C-ING-04 抓取中与整理中反馈', () => {
  it('点抓取显示抓取中，成功后显示 AI 整理中', async () => {
    let resolve!: (v: { id: string; deduped: boolean; title: string; viaWeixin: boolean }) => void;
    mLink.mockReturnValue(new Promise((r) => (resolve = r)));
    renderPage();
    await userEvent.type(screen.getByLabelText('文章链接'), 'https://mp.weixin.qq.com/s/x');
    await userEvent.click(screen.getByRole('button', { name: '抓取' }));
    expect(await screen.findByText('正在抓取正文…')).toBeInTheDocument();
    resolve({ id: 'k1', deduped: false, title: 'Redis 缓存穿透', viaWeixin: true });
    expect(await screen.findByText(/AI 正在自动打标签和摘要/)).toBeInTheDocument();
  });
});

describe('C-ING-03 失败回退入口', () => {
  it('抓取失败显示提示且一键切到粘贴文本', async () => {
    mLink.mockRejectedValue(new ApiError('FETCH_HTTP', '抓取失败 HTTP 404', true, 502));
    renderPage();
    await userEvent.type(screen.getByLabelText('文章链接'), 'https://x.test/404');
    await userEvent.click(screen.getByRole('button', { name: '抓取' }));
    expect(await screen.findByText(/抓不到正文/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /改用「粘贴文本」/ }));
    expect(screen.getByLabelText('正文 / AI 对话记录')).toBeInTheDocument();
  });
});

describe('C-ING-07 保存跳转', () => {
  it('粘贴保存成功后跳转知识详情', async () => {
    mCreate.mockResolvedValue({ id: 'k99', deduped: false });
    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: '📋 粘贴文本' }));
    await userEvent.type(screen.getByLabelText('正文 / AI 对话记录'), '一段缓存相关的笔记');
    await userEvent.click(screen.getByRole('button', { name: '保存入库' }));
    await waitFor(() => expect(mCreate).toHaveBeenCalledWith(expect.objectContaining({ source_type: 'paste' })));
    expect(await screen.findByText(/详情页/)).toBeInTheDocument();
  });
});

describe('C-ING-05 自动存草稿', () => {
  it('写一条输入后写入 localStorage 草稿', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: '✍️ 写一条' }));
    await userEvent.type(screen.getByLabelText('正文（Markdown）'), '我的心得内容');
    await waitFor(() => {
      const draft = localStorage.getItem('zkb-draft-note');
      expect(draft).toBeTruthy();
      expect(JSON.parse(draft!).body).toContain('我的心得内容');
    });
  });
});

describe('C-ING-06 超大文件提示', () => {
  it('上传超过 25MB 的文件显示拒绝提示，不入库', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: '📄 上传文件' }));
    const input = screen.getByLabelText('上传文件') as HTMLInputElement;
    const big = new File(['x'], 'huge.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 26 * 1024 * 1024 });
    await userEvent.upload(input, big);
    expect(await screen.findByText(/文件过大/)).toBeInTheDocument();
  });
});

describe('C-ING-08 防重复提交', () => {
  it('提交进行中按钮禁用，不会重复入库', async () => {
    let resolve!: (v: { id: string; deduped: boolean }) => void;
    mCreate.mockReturnValue(new Promise((r) => (resolve = r)));
    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: '📋 粘贴文本' }));
    await userEvent.type(screen.getByLabelText('正文 / AI 对话记录'), '内容');
    const saveBtn = screen.getByRole('button', { name: '保存入库' });
    await userEvent.click(saveBtn);
    expect(saveBtn).toBeDisabled();
    resolve({ id: 'k1', deduped: false });
    await waitFor(() => expect(mCreate).toHaveBeenCalledTimes(1));
  });
});
