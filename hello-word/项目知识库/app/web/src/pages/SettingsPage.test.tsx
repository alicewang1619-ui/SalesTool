import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from './SettingsPage.tsx';
import { ToastProvider } from '../components/Toast.tsx';
import type { Knowledge, ModelSettingsPublic } from '../api/types.ts';

vi.mock('../api/client.ts', async () => {
  const actual = await vi.importActual<typeof import('../api/client.ts')>('../api/client.ts');
  return {
    ...actual,
    api: {
      getModel: vi.fn(), health: vi.fn(), stats: vi.fn(), recycle: vi.fn(),
      updateModel: vi.fn(), testModel: vi.fn(), exportBackup: vi.fn(), restore: vi.fn(), emptyRecycle: vi.fn(),
      listLocalModels: vi.fn(),
    },
  };
});
import { api } from '../api/client.ts';
const m = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const localModel: ModelSettingsPublic = { provider: 'local', chatModel: 'llama3.1:8b', embedModel: 'nomic-embed-text', cloudBaseUrl: '', cloudApiKeyMasked: '', hasCloudApiKey: false };

function mkDeleted(id: string, title: string): Knowledge {
  return { id, title, content: 'x', source_type: 'note', source_url: null, summary: '', organize_status: 'done', organize_error: null, deleted_at: new Date().toISOString(), created_at: '', updated_at: '', tags: [] };
}

function renderPage() {
  return render(<MemoryRouter><ToastProvider><SettingsPage /></ToastProvider></MemoryRouter>);
}

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  m.getModel.mockResolvedValue(localModel);
  m.health.mockResolvedValue({ status: 'ok', model: { ok: true, detail: '本地 Ollama 就绪' } });
  m.stats.mockResolvedValue({ knowledge: 128, deleted: 2, tags: 24, embeddings: 320 });
  m.recycle.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
  m.listLocalModels.mockResolvedValue({ models: ['llama3.1:8b', 'qwen2.5:32b', 'gemma4:26b'] });
});

describe('C-SET-02 连接状态徽标', () => {
  it('本地已连接显示「已连接」', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('conn-badge')).toHaveTextContent('已连接'));
  });
  it('未就绪显示「未就绪」', async () => {
    m.health.mockResolvedValue({ status: 'ok', model: { ok: false, detail: 'Ollama 未连接' } });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('conn-badge')).toHaveTextContent('未就绪'));
  });
});

describe('C-SET-01 / C-SET-03 模型切换与 Key 脱敏', () => {
  it('切到云端持久化并出现 password 类型 Key 输入', async () => {
    m.updateModel.mockResolvedValue({ ...localModel, provider: 'cloud' });
    renderPage();
    // 等初始 getModel 落地（本地模型下拉拿到当前值），避免初始加载覆盖切换结果
    await waitFor(() => expect((screen.getByLabelText('本地模型') as HTMLSelectElement).value).toBe('llama3.1:8b'));
    await userEvent.click(screen.getByTestId('opt-cloud'));
    await waitFor(() => expect(m.updateModel).toHaveBeenCalledWith({ provider: 'cloud' }));
    const keyInput = await screen.findByLabelText(/API Key/);
    expect(keyInput).toHaveAttribute('type', 'password');
  });
});

describe('本地模型下拉切换', () => {
  it('下拉列出已装模型，选择后调用 updateModel(chatModel)', async () => {
    m.updateModel.mockResolvedValue({ ...localModel, chatModel: 'qwen2.5:32b' });
    renderPage();
    const select = (await screen.findByLabelText('本地模型')) as HTMLSelectElement;
    // 列出后端返回的模型
    expect(within(select).getByRole('option', { name: 'qwen2.5:32b' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'gemma4:26b' })).toBeInTheDocument();
    // 当前值为 llama3.1:8b
    expect(select.value).toBe('llama3.1:8b');
    await userEvent.selectOptions(select, 'qwen2.5:32b');
    await waitFor(() => expect(m.updateModel).toHaveBeenCalledWith({ chatModel: 'qwen2.5:32b' }));
    await waitFor(() => expect((screen.getByLabelText('本地模型') as HTMLSelectElement).value).toBe('qwen2.5:32b'));
  });
});

describe('C-SET-04 导出备份', () => {
  it('点导出触发 exportBackup', async () => {
    m.exportBackup.mockResolvedValue({ app: 'zkb', version: 1, knowledge: [] });
    // jsdom: URL.createObjectURL 缺失
    const createSpy = vi.fn(() => 'blob:x');
    Object.defineProperty(URL, 'createObjectURL', { value: createSpy, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    HTMLAnchorElement.prototype.click = vi.fn();
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /导出备份/ }));
    await waitFor(() => expect(m.exportBackup).toHaveBeenCalled());
  });
});

describe('C-SET-05 回收站恢复', () => {
  it('点恢复调用 restore 并刷新', async () => {
    m.recycle
      .mockResolvedValueOnce({ items: [mkDeleted('k1', '过时笔记')], total: 1, page: 1, pageSize: 50 })
      .mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 50 });
    m.restore.mockResolvedValue({ ok: true });
    renderPage();
    const row = await screen.findByTestId('recycle-row');
    await userEvent.click(within(row).getByRole('button', { name: /恢复/ }));
    await waitFor(() => expect(m.restore).toHaveBeenCalledWith('k1'));
  });
});

describe('C-SET-06 清空二次确认', () => {
  it('清空回收站需二次确认', async () => {
    m.recycle.mockResolvedValue({ items: [mkDeleted('k1', 'x')], total: 1, page: 1, pageSize: 50 });
    m.emptyRecycle.mockResolvedValue({ purged: 1 });
    renderPage();
    await screen.findByTestId('recycle-row');
    await userEvent.click(screen.getByRole('button', { name: '清空回收站' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('清空回收站？')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: '永久清空' }));
    await waitFor(() => expect(m.emptyRecycle).toHaveBeenCalled());
  });
});

describe('C-SET-07 数据统计', () => {
  it('显示知识数/标签数/向量数', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('stats')).toHaveTextContent('128 条知识'));
    expect(screen.getByTestId('stats')).toHaveTextContent('24 个标签');
  });
});
