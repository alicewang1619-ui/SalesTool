/**
 * 知识列表（首页 /）。复刻 mvp_知识管理_知识列表.html：
 * page-head + 来源筛选 chips + 知识卡片流 + 空库引导 + 骨架 + 无限滚动「没有更多了」。
 * 数据全部来自真实后端 /api/knowledge（分页）。
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SearchTopbar } from '../components/SearchTopbar.tsx';
import { api } from '../api/client.ts';
import type { Knowledge, SourceType } from '../api/types.ts';
import { SOURCE_META } from '../api/types.ts';
import { relativeTime } from '../lib/format.ts';

type ChipKey = 'all' | 'recent' | SourceType;
const CHIPS: { key: ChipKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'recent', label: '最近添加' },
  { key: 'link', label: '公众号' },
  { key: 'paste', label: 'AI 对话' },
  { key: 'note', label: '心得' },
  { key: 'file', label: '文件' },
];
const PAGE_SIZE = 12;

function KnowledgeCard({ k }: { k: Knowledge }) {
  const meta = SOURCE_META[k.source_type];
  const organizing = k.organize_status === 'pending' || k.organize_status === 'processing';
  const summaryText = k.summary
    ? k.summary
    : organizing
      ? 'AI 正在整理标签和摘要…'
      : k.content.slice(0, 120);
  return (
    <Link className="card" to={`/k/${k.id}`} data-testid="knowledge-card">
      <div className="card-title">{k.title}</div>
      <div className="card-summary">{summaryText}</div>
      <div className="card-meta">
        {k.tags.map((t) => (
          <span className="tag" key={t}>{t}</span>
        ))}
        <span className="dotsep">·</span>
        <span className="source">{meta.emoji} {meta.label}</span>
        <span className="dotsep">·</span>
        <span className="source">{relativeTime(k.created_at)}</span>
      </div>
    </Link>
  );
}

export function KnowledgeListPage() {
  const navigate = useNavigate();
  const [chip, setChip] = useState<ChipKey>('all');
  const [items, setItems] = useState<Knowledge[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const sentinel = useRef<HTMLDivElement>(null);

  const sourceParam = chip === 'all' || chip === 'recent' ? undefined : chip;

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError('');
      try {
        const res = await api.listKnowledge({ page: nextPage, pageSize: PAGE_SIZE, source: sourceParam });
        setTotal(res.total);
        setItems((prev) => (replace ? res.items : [...prev, ...res.items]));
        setPage(nextPage);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [sourceParam],
  );

  // chip 切换重新加载第一页
  useEffect(() => {
    void load(1, true);
    // eslint 关注 load 依赖 sourceParam，已随 chip 变化
  }, [load]);

  const hasMore = items.length < total;

  // 无限滚动：sentinel 进入视口时加载下一页
  useEffect(() => {
    if (!hasMore || loading) return;
    const el = sentinel.current;
    if (!el) return;
    const ob = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loadingMore) void load(page + 1, false);
    });
    ob.observe(el);
    return () => ob.disconnect();
  }, [hasMore, loading, loadingMore, page, load]);

  return (
    <>
    <SearchTopbar />
    <div className="content">
      <div className="page-head">
        <div>
          <div className="page-title">全部知识</div>
          <div className="page-sub">最近添加优先 · 共 {total} 条</div>
        </div>
      </div>

      <div className="toolbar" role="tablist" aria-label="来源筛选">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            className={`chip${chip === c.key ? ' active' : ''}`}
            aria-pressed={chip === c.key}
            onClick={() => setChip(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}（请确认后端已启动）</div>}

      {loading ? (
        <div className="cards">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="skeleton skeleton-card" key={i} data-testid="skeleton" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="empty" data-testid="empty-state">
          <div className="emoji">📚</div>
          <div className="empty-title">
            {chip === 'all' || chip === 'recent' ? '知识库还是空的' : '该来源下暂无知识'}
          </div>
          <p style={{ marginBottom: 'var(--sp-5)' }}>
            把公众号文章、AI 对话、心得或文件丢进来，AI 会自动整理、随时可搜可问。
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/new')}>＋ 新增第一条知识</button>
        </div>
      ) : (
        <>
          <div className="cards">
            {items.map((k) => (
              <KnowledgeCard k={k} key={k.id} />
            ))}
          </div>
          <div ref={sentinel} style={{ height: 1 }} />
          <div className="page-sub" style={{ textAlign: 'center', padding: 'var(--sp-5)' }}>
            {loadingMore ? '加载中…' : hasMore ? (
              <button className="btn btn-ghost btn-sm" onClick={() => load(page + 1, false)}>加载更多</button>
            ) : (
              '没有更多了'
            )}
          </div>
        </>
      )}
    </div>
    </>
  );
}
