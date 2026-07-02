/**
 * 知识详情（/k/:id）。复刻 mvp_知识管理_知识详情.html：
 * 返回+编辑+删除顶栏 + 两栏（文章正文/可编辑AI摘要/标签行 + 右栏相关推荐/同标签）。
 * 数据来自真实后端 /knowledge/:id、/knowledge/:id/related、/tags。
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client.ts';
import type { Knowledge, RelatedItem, TagCount } from '../api/types.ts';
import { SOURCE_META } from '../api/types.ts';
import { relativeTime } from '../lib/format.ts';
import { MarkdownView } from '../lib/MarkdownView.tsx';
import { useToast } from '../components/Toast.tsx';
import { ConfirmModal } from '../components/ConfirmModal.tsx';

export function DetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [k, setK] = useState<Knowledge | null>(null);
  const [related, setRelated] = useState<RelatedItem[]>([]);
  const [tagCounts, setTagCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getKnowledge(id);
      setK(data);
      const [rel, tags] = await Promise.all([api.related(id).catch(() => ({ items: [] })), api.listTags().catch(() => ({ items: [] as TagCount[] }))]);
      setRelated(rel.items);
      setTagCounts(new Map(tags.items.map((t) => [t.name, t.count])));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // 整理进行中时轮询刷新，标签/摘要就绪即停（真实异步整理反馈）。
  const organizing = k?.organize_status === 'pending' || k?.organize_status === 'processing';
  useEffect(() => {
    if (!organizing || !id) return;
    const timer = setInterval(async () => {
      try {
        const fresh = await api.getKnowledge(id);
        setK(fresh);
        if (fresh.organize_status === 'done' || fresh.organize_status === 'failed') {
          const rel = await api.related(id).catch(() => ({ items: [] }));
          setRelated(rel.items);
        }
      } catch {
        /* 轮询失败下次再试 */
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [organizing, id]);

  async function saveSummary() {
    if (!k) return;
    try {
      const updated = await api.updateKnowledge(k.id, { summary: summaryDraft });
      setK(updated);
      setEditingSummary(false);
      toast.show('摘要已更新', 'success');
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : '更新失败', 'danger');
    }
  }

  async function commitTags(nextTags: string[]) {
    if (!k) return;
    try {
      const updated = await api.setTags(k.id, nextTags);
      setK(updated);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : '标签更新失败', 'danger');
    }
  }

  async function addTag() {
    const name = tagDraft.trim();
    if (!name || !k) {
      setAddingTag(false);
      return;
    }
    await commitTags(Array.from(new Set([...k.tags, name])));
    setTagDraft('');
    setAddingTag(false);
  }

  async function removeTag(name: string) {
    if (!k) return;
    await commitTags(k.tags.filter((t) => t !== name));
  }

  async function doDelete() {
    if (!k) return;
    try {
      await api.deleteKnowledge(k.id);
      toast.show('已移入回收站，可在设置中恢复', 'success');
      navigate('/');
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : '删除失败', 'danger');
    }
  }

  if (loading) {
    return (
      <>
        <DetailTopbar onEdit={() => {}} onDelete={() => {}} disabled />
        <div className="wrap">
          <div className="article">
            <div className="skeleton" style={{ height: 32, width: '60%', marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 120 }} data-testid="skeleton" />
          </div>
          <div className="aside-col"><div className="skeleton" style={{ height: 160 }} /></div>
        </div>
      </>
    );
  }

  if (error || !k) {
    return (
      <>
        <DetailTopbar onEdit={() => {}} onDelete={() => {}} disabled />
        <div className="content">
          <div className="empty" data-testid="not-found">
            <div className="emoji">🚫</div>
            <div className="empty-title">{error || '知识不存在或已删除'}</div>
            <Link className="btn btn-primary btn-sm" to="/">返回全部知识</Link>
          </div>
        </div>
      </>
    );
  }

  const meta = SOURCE_META[k.source_type];

  return (
    <>
      <DetailTopbar onEdit={() => navigate(`/k/${k.id}/edit`)} onDelete={() => setConfirmDel(true)} />
      <div className="wrap">
        <article className="article">
          <h1>{k.title}</h1>
          <div className="article-meta">
            <span>{meta.emoji} 来源：</span>
            {k.source_url ? (
              <a className="src-link" href={k.source_url} target="_blank" rel="noreferrer">{meta.label}原文 ↗</a>
            ) : (
              <span>{meta.label}</span>
            )}
            <span>·</span>
            <span>{relativeTime(k.created_at)}添加</span>
            {k.organize_status === 'failed' && <><span>·</span><span style={{ color: 'var(--danger)' }}>整理失败</span></>}
          </div>

          <div className="summary-box">
            <div className="lab">
              <span>✨ AI 摘要</span>
              {!editingSummary && (
                <button
                  className="edit"
                  onClick={() => {
                    setSummaryDraft(k.summary);
                    setEditingSummary(true);
                  }}
                >
                  编辑
                </button>
              )}
            </div>
            {editingSummary ? (
              <div>
                <textarea className="textarea" aria-label="编辑摘要" value={summaryDraft} onChange={(e) => setSummaryDraft(e.target.value)} style={{ minHeight: 80, background: 'var(--bg-surface)' }} />
                <div className="actions" style={{ marginTop: 'var(--sp-2)' }}>
                  <button className="btn btn-primary btn-sm" onClick={saveSummary}>保存摘要</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingSummary(false)}>取消</button>
                </div>
              </div>
            ) : (
              <p>{k.summary || (organizing ? 'AI 正在生成摘要…' : '（暂无摘要）')}</p>
            )}
          </div>

          <div className="body">
            <MarkdownView content={k.content} />
          </div>

          <div className="tags-row" data-testid="tags-row">
            {k.tags.map((t) => (
              <span className="tag" key={t}>
                <Link to={`/tags/${encodeURIComponent(t)}`}>{t}</Link>
                <span className="rm" role="button" aria-label={`移除标签 ${t}`} onClick={() => removeTag(t)}>×</span>
              </span>
            ))}
            {addingTag ? (
              <input
                className="input"
                aria-label="新标签"
                autoFocus
                style={{ width: 120, height: 28 }}
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onBlur={addTag}
                onKeyDown={(e) => { if (e.key === 'Enter') void addTag(); if (e.key === 'Escape') setAddingTag(false); }}
              />
            ) : (
              <button className="tag-add" onClick={() => setAddingTag(true)}>＋ 加标签</button>
            )}
          </div>
        </article>

        <div className="aside-col">
          <div className="side-panel">
            <div className="panel-title"><span className="accent-dot" />相关知识</div>
            {related.length === 0 ? (
              <p className="page-sub" data-testid="related-empty">继续添加知识，这里会出现更多关联。</p>
            ) : (
              related.map((r) => (
                <Link className="rel-item" to={`/k/${r.id}`} key={r.id} data-testid="related-item">
                  <div className="t">{r.title}</div>
                  <div className="r">相关度 {r.relevance}%</div>
                </Link>
              ))
            )}
          </div>
          <div className="side-panel">
            <div className="panel-title"><span className="accent-dot" />同标签</div>
            {k.tags.length === 0 ? (
              <p className="page-sub">暂无标签</p>
            ) : (
              k.tags.map((t) => (
                <Link className="rel-item" to={`/tags/${encodeURIComponent(t)}`} key={t}>
                  <div className="t">🏷️ {t}{tagCounts.has(t) ? `（${tagCounts.get(t)} 条）` : ''}</div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {confirmDel && (
        <ConfirmModal
          title="删除这条知识？"
          body="删除后会移入回收站，可在「设置 → 回收站」中恢复。"
          confirmLabel="移入回收站"
          danger
          onCancel={() => setConfirmDel(false)}
          onConfirm={doDelete}
        />
      )}
    </>
  );
}

function DetailTopbar({ onEdit, onDelete, disabled }: { onEdit: () => void; onDelete: () => void; disabled?: boolean }) {
  const navigate = useNavigate();
  return (
    <header className="topbar topbar-detail">
      <button className="back" onClick={() => navigate('/')} aria-label="返回全部知识">← 全部知识</button>
      <div className="ops">
        <button className="btn btn-sm" onClick={onEdit} disabled={disabled}>✏️ 编辑</button>
        <button className="btn btn-sm btn-danger" onClick={onDelete} disabled={disabled}>🗑️ 删除</button>
      </div>
    </header>
  );
}
