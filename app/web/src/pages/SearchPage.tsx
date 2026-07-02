/**
 * 检索结果（/search?q=）。复刻 mvp_检索_检索结果.html：
 * result-head（命中数 + query + 排序说明）+ ai-note（引导问答）+ 相关度卡片（命中片段高亮）。
 * 数据来自真实后端 /api/search（query embedding → 向量检索）。
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SearchTopbar } from '../components/SearchTopbar.tsx';
import { api, ApiError } from '../api/client.ts';
import type { SearchHit } from '../api/types.ts';
import { SOURCE_META } from '../api/types.ts';

function Highlight({ text, query }: { text: string; query: string }) {
  const terms = query.trim().split(/\s+/).filter((t) => t.length >= 1);
  if (terms.length === 0) return <>{text}</>;
  const esc = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const parts = text.split(new RegExp(`(${esc})`, 'gi'));
  return (
    <>
      {parts.map((p, i) =>
        terms.some((t) => t.toLowerCase() === p.toLowerCase()) ? (
          <span className="hl" key={i}>{p}</span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!q) {
      setLoading(false);
      setHits([]);
      return;
    }
    let alive = true;
    setLoading(true);
    setError('');
    api
      .search(q)
      .then((res) => {
        if (alive) setHits(res.hits);
      })
      .catch((err) => {
        if (alive) setError(err instanceof ApiError ? err.message : String(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [q]);

  return (
    <>
    <SearchTopbar />
    <div className="content">
      <div className="result-head">
        <h1>
          {loading ? (
            '正在语义检索…'
          ) : (
            <>找到 {hits.length} 条与 <span className="q">“{q}”</span> 语义相关的知识</>
          )}
        </h1>
        <div className="meta">按相关度排序 · 语义检索（非关键词匹配）</div>
      </div>

      <div className="ai-note">
        <span className="ai-ic">✨</span>
        <div>
          想直接得到答案而不是翻列表？试试 <Link to={`/ask?q=${encodeURIComponent(q)}`}>用「问答」直接提问</Link>，AI 会基于你的库总结并标来源。
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          检索失败：{error}
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 'var(--sp-3)' }}
            onClick={() => location.reload()}
          >
            重试
          </button>
        </div>
      )}

      {loading ? (
        <div className="cards">
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="skeleton skeleton-card" key={i} data-testid="skeleton" />
          ))}
        </div>
      ) : !error && hits.length === 0 ? (
        <div className="empty" data-testid="empty-state">
          <div className="emoji">🔍</div>
          <div className="empty-title">没找到相关知识</div>
          <p style={{ marginBottom: 'var(--sp-5)' }}>换个说法再搜，或者直接提问、先录入一条相关知识。</p>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'center' }}>
            <Link className="btn btn-ghost btn-sm" to={`/ask?q=${encodeURIComponent(q)}`}>去问答</Link>
            <Link className="btn btn-primary btn-sm" to="/new">去录入</Link>
          </div>
        </div>
      ) : (
        <div className="cards">
          {hits.map((h) => {
            const meta = SOURCE_META[h.source_type];
            return (
              <Link className="card" to={`/k/${h.id}`} key={h.id} data-testid="result-card">
                <div className="card-top">
                  <div className="card-title">{h.title}</div>
                  <span className="relevance">相关度 {h.relevance}%</span>
                </div>
                <div className="card-summary">
                  <Highlight text={h.snippet || h.summary} query={q} />
                </div>
                <div className="card-meta">
                  {h.tags.map((t) => (
                    <span className="tag tag-muted" key={t}>{t}</span>
                  ))}
                  <span className="dotsep">·</span>
                  <span className="source">{meta.emoji} {meta.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
}
