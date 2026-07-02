/**
 * 知识关系图谱（/graph，阶段二③）。无设计原型，按 DESIGN.md 令牌实现。
 * 节点=知识，边=向量语义相似度（后端 /api/graph 计算）。
 * 零依赖力导向布局（确定性初始化 + 固定迭代），SVG 渲染，节点可点进详情。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchTopbar } from '../components/SearchTopbar.tsx';
import { api, ApiError } from '../api/client.ts';
import type { Graph, GraphNode } from '../api/types.ts';

const W = 900;
const H = 600;

interface Pos { x: number; y: number }

/** 简易力导向：确定性圆形初始化 → 斥力 + 边引力 + 向心力，固定迭代。 */
function layout(g: Graph): Map<string, Pos> {
  const n = g.nodes.length;
  const pos = new Map<string, Pos>();
  g.nodes.forEach((node, i) => {
    const angle = (i / Math.max(1, n)) * Math.PI * 2;
    pos.set(node.id, { x: W / 2 + Math.cos(angle) * 220, y: H / 2 + Math.sin(angle) * 200 });
  });
  if (n <= 1) return pos;
  const idx = g.nodes.map((nd) => nd.id);
  const iters = Math.min(400, 120 + n * 4);
  const k = Math.sqrt((W * H) / n); // 理想间距
  for (let it = 0; it < iters; it++) {
    const disp = new Map<string, Pos>(idx.map((id) => [id, { x: 0, y: 0 }]));
    // 斥力
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        const pa = pos.get(idx[a])!;
        const pb = pos.get(idx[b])!;
        let dx = pa.x - pb.x;
        let dy = pa.y - pb.y;
        let dist = Math.hypot(dx, dy) || 0.01;
        const rep = (k * k) / dist / 6;
        dx = (dx / dist) * rep;
        dy = (dy / dist) * rep;
        const da = disp.get(idx[a])!;
        const db = disp.get(idx[b])!;
        da.x += dx; da.y += dy; db.x -= dx; db.y -= dy;
      }
    }
    // 边引力（相关度越高拉得越近）
    for (const e of g.edges) {
      const pa = pos.get(e.source);
      const pb = pos.get(e.target);
      if (!pa || !pb) continue;
      const dx = pa.x - pb.x;
      const dy = pa.y - pb.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const attr = (dist * dist) / k / 60 * (e.weight / 100);
      const ax = (dx / dist) * attr;
      const ay = (dy / dist) * attr;
      disp.get(e.source)!.x -= ax; disp.get(e.source)!.y -= ay;
      disp.get(e.target)!.x += ax; disp.get(e.target)!.y += ay;
    }
    const cooling = 1 - it / iters;
    for (const id of idx) {
      const d = disp.get(id)!;
      const p = pos.get(id)!;
      // 向心力，防飘散
      d.x += (W / 2 - p.x) * 0.01;
      d.y += (H / 2 - p.y) * 0.01;
      const len = Math.hypot(d.x, d.y) || 0.01;
      const step = Math.min(len, 18 * cooling);
      p.x += (d.x / len) * step;
      p.y += (d.y / len) * step;
      p.x = Math.max(30, Math.min(W - 30, p.x));
      p.y = Math.max(30, Math.min(H - 30, p.y));
    }
  }
  return pos;
}

export function GraphPage() {
  const navigate = useNavigate();
  const [graph, setGraph] = useState<Graph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [minRel, setMinRel] = useState(55);
  const [hover, setHover] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api
      .graph(minRel)
      .then((g) => alive && setGraph(g))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [minRel]);

  const pos = useMemo(() => (graph ? layout(graph) : new Map<string, Pos>()), [graph]);
  const maxDegree = useMemo(() => (graph ? Math.max(1, ...graph.nodes.map((n) => n.degree)) : 1), [graph]);

  const nodeRadius = (nd: GraphNode) => 6 + (nd.degree / maxDegree) * 12;

  return (
    <>
      <SearchTopbar />
      <div className="content">
        <div className="page-head">
          <div>
            <div className="page-title">知识图谱</div>
            <div className="page-sub">
              {graph ? `${graph.nodes.length} 个知识节点 · ${graph.edges.length} 条语义关联` : '基于向量语义相似度自动构建'}
            </div>
          </div>
          <label className="page-sub" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            关联强度阈值
            <select className="input" style={{ width: 120, height: 34 }} value={minRel} onChange={(e) => setMinRel(Number(e.target.value))}>
              <option value={45}>弱（45%）</option>
              <option value={55}>中（55%）</option>
              <option value={65}>强（65%）</option>
              <option value={75}>很强（75%）</option>
            </select>
          </label>
        </div>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        {loading ? (
          <div className="skeleton" style={{ height: 500 }} data-testid="skeleton" />
        ) : !graph || graph.nodes.length === 0 ? (
          <div className="empty" data-testid="empty-state">
            <div className="emoji">🕸️</div>
            <div className="empty-title">还没有可成图的知识</div>
            <p>多录入几条知识，AI 会按语义把它们连成关系网。</p>
          </div>
        ) : (
          <div className="graph-canvas">
            <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="知识关系图谱" data-testid="graph-svg">
              {graph.edges.map((e, i) => {
                const a = pos.get(e.source);
                const b = pos.get(e.target);
                if (!a || !b) return null;
                const active = hover === e.source || hover === e.target;
                return (
                  <line
                    key={i}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={active ? 'var(--accent)' : 'var(--border-strong)'}
                    strokeWidth={active ? 2 : 1}
                    strokeOpacity={active ? 0.9 : 0.35 + (e.weight / 100) * 0.3}
                  />
                );
              })}
              {graph.nodes.map((nd) => {
                const p = pos.get(nd.id);
                if (!p) return null;
                const r = nodeRadius(nd);
                const active = hover === nd.id;
                return (
                  <g
                    key={nd.id}
                    transform={`translate(${p.x},${p.y})`}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHover(nd.id)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => navigate(`/k/${nd.id}`)}
                    data-testid="graph-node"
                    role="button"
                    aria-label={nd.title}
                  >
                    <circle r={r} fill={active ? 'var(--accent)' : 'var(--accent-soft)'} stroke="var(--accent)" strokeWidth={1.5} />
                    {(active || graph.nodes.length <= 40) && (
                      <text x={r + 4} y={4} fontSize={12} fill="var(--text-body)" style={{ pointerEvents: 'none' }}>
                        {nd.title.length > 16 ? nd.title.slice(0, 16) + '…' : nd.title}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="graph-legend page-sub">圆越大表示关联越多 · 连线越深表示语义越相近 · 点击节点查看详情</div>
          </div>
        )}
      </div>
    </>
  );
}
