/**
 * 知识编辑（/k/:id/edit）。复刻 mvp_知识管理_知识编辑.html：
 * 返回顶栏 + 标题/AI摘要/标签/正文 表单 + 保存/取消/删除（二次确认）。
 * 保存走 PATCH /knowledge/:id（内容变更后端重建 embedding）+ PATCH tags；删除走软删入回收站。
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BackTopbar } from '../components/BackTopbar.tsx';
import { ConfirmModal } from '../components/ConfirmModal.tsx';
import { api, ApiError } from '../api/client.ts';
import type { Knowledge } from '../api/types.ts';
import { useToast } from '../components/Toast.tsx';

export function EditPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [orig, setOrig] = useState<Knowledge | null>(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .getKnowledge(id)
      .then((k) => {
        if (!alive) return;
        setOrig(k);
        setTitle(k.title);
        setSummary(k.summary);
        setContent(k.content);
        setTags(k.tags);
      })
      .catch((err) => alive && setError(err instanceof ApiError ? err.message : String(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  const dirty =
    !!orig &&
    (title !== orig.title || summary !== orig.summary || content !== orig.content || tags.join('|') !== orig.tags.join('|'));

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function addTag() {
    const name = tagDraft.trim();
    if (name) setTags((prev) => Array.from(new Set([...prev, name])));
    setTagDraft('');
    setAddingTag(false);
  }

  async function save() {
    if (!orig || saving) return;
    if (!content.trim()) {
      toast.show('正文不能为空', 'danger');
      return;
    }
    setSaving(true);
    try {
      await api.updateKnowledge(orig.id, { title, summary, content });
      if (tags.join('|') !== orig.tags.join('|')) await api.setTags(orig.id, tags);
      toast.show('已保存', 'success');
      navigate(`/k/${orig.id}`);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : '保存失败', 'danger');
      setSaving(false);
    }
  }

  function cancel() {
    if (dirty && !window.confirm('有未保存的修改，确定放弃吗？')) return;
    navigate(orig ? `/k/${orig.id}` : '/');
  }

  async function doDelete() {
    if (!orig) return;
    try {
      await api.deleteKnowledge(orig.id);
      toast.show('已移入回收站', 'success');
      navigate('/');
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : '删除失败', 'danger');
    }
  }

  if (loading) {
    return (
      <>
        <BackTopbar title="编辑知识" />
        <div className="content"><div className="skeleton" style={{ height: 320 }} data-testid="skeleton" /></div>
      </>
    );
  }
  if (error || !orig) {
    return (
      <>
        <BackTopbar title="编辑知识" backTo="/" />
        <div className="content"><div className="empty"><div className="emoji">🚫</div><div className="empty-title">{error || '知识不存在'}</div></div></div>
      </>
    );
  }

  return (
    <>
      <BackTopbar title="编辑知识" backTo={`/k/${orig.id}`} />
      <div className="content">
        <div className="field">
          <label htmlFor="edit-title">标题</label>
          <input id="edit-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="edit-summary">AI 摘要（可改）</label>
          <textarea id="edit-summary" className="textarea summary-ta" value={summary} onChange={(e) => setSummary(e.target.value)} />
        </div>
        <div className="field">
          <label>标签</label>
          <div className="tags-edit">
            {tags.map((t) => (
              <span className="tag" key={t}>
                {t}
                <span className="x" role="button" aria-label={`移除标签 ${t}`} onClick={() => setTags((prev) => prev.filter((x) => x !== t))}>×</span>
              </span>
            ))}
            {addingTag ? (
              <input
                className="input"
                aria-label="新标签"
                autoFocus
                style={{ width: 120, height: 30 }}
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onBlur={addTag}
                onKeyDown={(e) => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') setAddingTag(false); }}
              />
            ) : (
              <button className="tag-add" onClick={() => setAddingTag(true)}>＋ 加标签</button>
            )}
          </div>
        </div>
        <div className="field">
          <label htmlFor="edit-content">正文（Markdown）</label>
          <textarea id="edit-content" className="textarea textarea-mono" value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</button>
          <button className="btn btn-ghost" onClick={cancel}>取消</button>
          <button className="btn btn-danger btn-danger-end" onClick={() => setConfirmDel(true)}>🗑️ 删除这条知识</button>
        </div>
      </div>

      {confirmDel && (
        <ConfirmModal
          title="删除这条知识？"
          body={`《${orig.title}》将被移到回收站，可在「设置 → 回收站」中恢复。`}
          confirmLabel="移到回收站"
          danger
          onCancel={() => setConfirmDel(false)}
          onConfirm={doDelete}
        />
      )}
    </>
  );
}
