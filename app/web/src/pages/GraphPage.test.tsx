import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { GraphPage } from './GraphPage.tsx';
import type { Graph } from '../api/types.ts';

vi.mock('../api/client.ts', async () => {
  const actual = await vi.importActual<typeof import('../api/client.ts')>('../api/client.ts');
  return { ...actual, api: { graph: vi.fn() } };
});
import { api } from '../api/client.ts';
const mGraph = api.graph as unknown as ReturnType<typeof vi.fn>;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/graph']}>
      <Routes>
        <Route path="/graph" element={<GraphPage />} />
        <Route path="/k/:id" element={<div>详情页</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const sampleGraph = (): Graph => ({
  nodes: [
    { id: 'k1', title: '缓存穿透', tags: ['Redis'], degree: 2 },
    { id: 'k2', title: '缓存击穿', tags: ['Redis'], degree: 1 },
    { id: 'k3', title: '红烧肉', tags: ['美食'], degree: 1 },
  ],
  edges: [
    { source: 'k1', target: 'k2', weight: 88 },
    { source: 'k1', target: 'k3', weight: 60 },
  ],
});

beforeEach(() => mGraph.mockReset());

describe('知识图谱页', () => {
  it('渲染节点与统计', async () => {
    mGraph.mockResolvedValue(sampleGraph());
    renderPage();
    await screen.findByTestId('graph-svg');
    const nodes = screen.getAllByTestId('graph-node');
    expect(nodes.length).toBe(3);
    expect(screen.getByText(/3 个知识节点 · 2 条语义关联/)).toBeInTheDocument();
  });

  it('点击节点跳转知识详情', async () => {
    mGraph.mockResolvedValue(sampleGraph());
    renderPage();
    await screen.findByTestId('graph-svg');
    const nodes = screen.getAllByTestId('graph-node');
    await userEvent.click(nodes[0]);
    expect(await screen.findByText('详情页')).toBeInTheDocument();
  });

  it('调整关联强度阈值重新请求', async () => {
    mGraph.mockResolvedValue(sampleGraph());
    renderPage();
    await screen.findByTestId('graph-svg');
    await userEvent.selectOptions(screen.getByRole('combobox'), '75');
    await waitFor(() => expect(mGraph).toHaveBeenLastCalledWith(75));
  });

  it('空图显示空态', async () => {
    mGraph.mockResolvedValue({ nodes: [], edges: [] });
    renderPage();
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
  });
});
