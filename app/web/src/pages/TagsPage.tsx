/**
 * 标签浏览（/tags, /tags/:name）。复刻 mvp_标签_标签浏览.html：
 * 搜索顶栏 + 标签云（按知识数排序，前列更大）+ 选中标签下的知识卡片。
 * 数据来自真实后端 /tags（计数 GROUP BY）与 /tags/:name（聚合分页）。
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SearchTopbar } from '../components/SearchTopbar.tsx';
import { api, ApiError } from '../api/client.ts';
import type { Knowledge, TagCount } from '../api/types.ts';
import { SOURCE_META } from '../api/types.ts';

export function TagsPage() {
  const { name } = useParams();
  const navigate = useNavigate();
  const selected = name ? decodeURIComponent(name) : null;
  const [tags, setTags] = useState<TagCount[]>([]);
  const [items, setItems] = useState<Knowledge[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingTags, setLoadingTags] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listTags()
      .then((res) => {
        setTags(res.items);
        // 无选中且有标签时，默认选知识数最多的标签
        if (!selected && res.items.length > 0) {
          navigate(`/tags/${encodeURIComponent(res.items[0].name)}`, { replace: true });
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
      .finally(() => setLoadingTags(false));
    // 仅首次加载标签云（selected 仅用于首屏默认选择，无需重订阅）
  }, []);

  useEffect(() => {
    if (!selected) {
      setItems([]);
      setTotal(0);
      return;
    }
    let alive = true;
    setLoadingItems(true);
    api
      .byTag(selected, 1, 50)
      .then((res) => {
        if (!alive) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => alive && setError(err instanceof ApiError ? err.message : String(err)))
      .finally(() => alive && setLoadingItems(false));
    return () => {
      alive = false;
    };
  }, [selected]);

  const maxCount = tags.length > 0 ? tags[0].count : 0;

  return (
    <>
      <SearchTopbar />
      <div className="content">
        <div className="page-title">标签</div>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        {loadingTags ? (
          <div className="skeleton" style={{ height: 80 }} data-testid="skeleton" />
        ) : tags.length === 0 ? (
          <div className="empty" data-testid="empty-state">
            <div className="emoji">🏷️</div>
            <div className="empty-title">还没有标签</div>
            <p style={{ marginBottom: 'var(--sp-5)' }}>录入知识后，AI 会自动生成标签，这里就会出现标签云。</p>
            <Link className="btn btn-primary btn-sm" to="/new">去录入知识</Link>
          </div>
        ) : (
          <>
            <div className="section-lab">全部标签（{tags.length} 个 · 按知识数排序）</div>
            <div className="tag-cloud" role="group" aria-label="标签云">
              {tags.map((t) => (
                <button
                  key={t.name}
                  className={`tagc${t.name === selected ? ' active' : ''}${maxCount > 0 && t.count >= maxCount * 0.6 ? ' big' : ''}`}
                  aria-pressed={t.name === selected}
                  onClick={() => navigate(`/tags/${encodeURIComponent(t.name)}`)}
                  data-testid="tag-chip"
                >
                  {t.name} <span className="cnt">{t.count}</span>
                </button>
              ))}
            </div>

            {selected && (
              <>
                <div className="section-lab" data-testid="tag-section">
                  标签「{selected}」下的 {total} 条知识
                </div>
                {loadingItems ? (
                  <div className="cards">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div className="skeleton skeleton-card" key={i} />
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <div className="empty">该标签下暂无知识。</div>
                ) : (
                  <div className="cards">
                    {items.map((k) => {
                      const meta = SOURCE_META[k.source_type];
                      return (
                        <Link className="card" to={`/k/${k.id}`} key={k.id} data-testid="tag-knowledge-card">
                          <div className="card-title">{k.title}</div>
                          <div className="card-summary">{k.summary || k.content.slice(0, 100)}</div>
                          <div className="card-meta">
                            {k.tags.map((t) => (
                              <span className="tag" key={t}>{t}</span>
                            ))}
                            <span className="dotsep">·</span>
                            <span className="source">{meta.emoji} {meta.label}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
