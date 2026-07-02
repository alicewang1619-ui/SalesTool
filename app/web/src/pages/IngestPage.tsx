/**
 * 内容录入（/new）。复刻 mvp_录入_内容录入.html：
 * 返回顶栏 + 四 Tab（贴链接/粘贴文本/写一条/上传文件）+ 各自面板 + 抓取/解析/整理状态 + 失败回退 + 保存/取消。
 * 全部走真实后端：/ingest/link、/ingest/file、/knowledge。
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackTopbar } from '../components/BackTopbar.tsx';
import { api, ApiError } from '../api/client.ts';
import { useToast } from '../components/Toast.tsx';

type Tab = 0 | 1 | 2 | 3;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const DRAFT_KEY = 'zkb-draft-note';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading'; text: string }
  | { kind: 'ok'; text: string }
  | { kind: 'fail'; text: string };

export function IngestPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(0);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  // 链接
  const [url, setUrl] = useState('');
  // 粘贴
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteBody, setPasteBody] = useState('');
  // 写一条（草稿）
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  // 恢复草稿（C-ING-05）
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const d = JSON.parse(saved) as { title: string; body: string };
        setNoteTitle(d.title ?? '');
        setNoteBody(d.body ?? '');
      } catch {
        /* 忽略损坏草稿 */
      }
    }
  }, []);

  // 自动存草稿
  useEffect(() => {
    if (noteTitle || noteBody) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: noteTitle, body: noteBody }));
    }
  }, [noteTitle, noteBody]);

  const dirty =
    !!url || !!pasteTitle || !!pasteBody || !!noteTitle || !!noteBody;

  // 离开未保存拦截（浏览器级）
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty && !createdId) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, createdId]);

  const switchTab = (t: Tab) => {
    setTab(t);
    setStatus({ kind: 'idle' });
  };

  async function fetchLink() {
    if (submitting) return;
    const u = url.trim();
    if (!u) {
      toast.show('请输入链接', 'danger');
      return;
    }
    setSubmitting(true);
    setStatus({ kind: 'loading', text: '正在抓取正文…' });
    try {
      const res = await api.ingestLink(u);
      setCreatedId(res.id);
      setStatus({ kind: 'ok', text: `✅ 已抓取《${res.title}》，AI 正在自动打标签和摘要…` });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setStatus({ kind: 'fail', text: `⚠️ 这个链接抓不到正文（${msg}）。` });
    } finally {
      setSubmitting(false);
    }
  }

  async function savePasteOrNote(source: 'paste' | 'note') {
    if (submitting) return;
    const title = source === 'paste' ? pasteTitle : noteTitle;
    const body = source === 'paste' ? pasteBody : noteBody;
    if (!body.trim()) {
      toast.show('正文不能为空', 'danger');
      return;
    }
    setSubmitting(true);
    setStatus({ kind: 'loading', text: '正在入库…' });
    try {
      const res = await api.createKnowledge({ title: title.trim() || undefined, content: body, source_type: source });
      if (source === 'note') localStorage.removeItem(DRAFT_KEY);
      setStatus({ kind: 'ok', text: 'AI 正在打标签和摘要…' });
      navigate(`/k/${res.id}`);
    } catch (err) {
      setStatus({ kind: 'fail', text: err instanceof ApiError ? err.message : String(err) });
      setSubmitting(false);
    }
  }

  async function onFile(file: File) {
    if (submitting) return;
    if (file.size > MAX_FILE_BYTES) {
      setStatus({ kind: 'fail', text: `⚠️ 文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），上限 25MB。` });
      return;
    }
    setSubmitting(true);
    setStatus({ kind: 'loading', text: `正在解析《${file.name}》…` });
    try {
      const base64 = await fileToBase64(file);
      const res = await api.ingestFile(file.name, base64);
      setCreatedId(res.id);
      setStatus({ kind: 'ok', text: `✅ 已解析《${res.title}》，AI 正在打标签和摘要…` });
    } catch (err) {
      setStatus({ kind: 'fail', text: err instanceof ApiError ? err.message : String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  function commitCreated() {
    if (createdId) navigate(`/k/${createdId}`);
  }

  function cancel() {
    if (dirty && !createdId && !window.confirm('有未保存的内容，确定离开吗？')) return;
    navigate('/');
  }

  const TABS = ['🔗 贴链接', '📋 粘贴文本', '✍️ 写一条', '📄 上传文件'];

  return (
    <>
      <BackTopbar title="新增知识" backTo="/" />
      <div className="content">
        <div className="tabs" role="tablist">
          {TABS.map((t, i) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === i}
              className={`tab${tab === i ? ' active' : ''}`}
              onClick={() => switchTab(i as Tab)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab 0 贴链接 */}
        {tab === 0 && (
          <div className="panel active" role="tabpanel">
            <div className="field">
              <label htmlFor="ingest-url">文章链接</label>
              <div className="hint">支持微信公众号、各类网页文章；点抓取后自动提取正文。抓不到时可一键切到「粘贴文本」。</div>
              <div className="row">
                <input
                  id="ingest-url"
                  className="input"
                  placeholder="https://mp.weixin.qq.com/s/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <button className="btn btn-primary" onClick={fetchLink} disabled={submitting}>
                  {submitting && status.kind === 'loading' ? '抓取中…' : '抓取'}
                </button>
              </div>
            </div>
            <StatusBar
              status={status}
              onFallback={() => {
                setStatus({ kind: 'idle' });
                setTab(1);
              }}
            />
            <div className="actions">
              <button className="btn btn-primary" onClick={commitCreated} disabled={!createdId}>保存入库</button>
              <button className="btn btn-ghost" onClick={cancel}>取消</button>
            </div>
          </div>
        )}

        {/* Tab 1 粘贴文本 */}
        {tab === 1 && (
          <div className="panel active" role="tabpanel">
            <div className="field">
              <label htmlFor="paste-title">标题</label>
              <input id="paste-title" className="input" placeholder="给这条知识起个标题（留空将由 AI 自动生成）" value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="paste-body">正文 / AI 对话记录</label>
              <div className="hint">直接粘贴文章正文，或从 ChatGPT/Claude 复制整段对话。</div>
              <textarea id="paste-body" className="textarea" placeholder="粘贴内容…" value={pasteBody} onChange={(e) => setPasteBody(e.target.value)} />
            </div>
            <StatusBar status={status} />
            <div className="actions">
              <button className="btn btn-primary" onClick={() => savePasteOrNote('paste')} disabled={submitting}>保存入库</button>
              <button className="btn btn-ghost" onClick={cancel}>取消</button>
            </div>
          </div>
        )}

        {/* Tab 2 写一条 */}
        {tab === 2 && (
          <div className="panel active" role="tabpanel">
            <div className="field">
              <label htmlFor="note-title">标题</label>
              <input id="note-title" className="input" placeholder="心得标题" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="note-body">正文（Markdown）</label>
              <div className="hint">随手记录你的想法和心得，支持 Markdown。输入即自动保存草稿。</div>
              <textarea id="note-body" className="textarea" placeholder={'# 我的心得\n\n今天想明白了一件事……'} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
            </div>
            <StatusBar status={status} />
            <div className="actions">
              <button className="btn btn-primary" onClick={() => savePasteOrNote('note')} disabled={submitting}>保存入库</button>
              <button className="btn btn-ghost" onClick={cancel}>取消</button>
            </div>
          </div>
        )}

        {/* Tab 3 上传文件 */}
        {tab === 3 && (
          <div className="panel active" role="tabpanel">
            <div
              className="upload"
              role="button"
              tabIndex={0}
              onClick={() => fileInput.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.current?.click(); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) void onFile(f);
              }}
            >
              <div className="big">📄</div>
              <div style={{ fontWeight: 'var(--fw-medium)', color: 'var(--text-body)' }}>点击或拖拽文件到此处</div>
              <div className="hint" style={{ marginTop: 8 }}>支持 PDF / Word / Markdown，解析文本后入库</div>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.docx,.doc,.md,.markdown,.txt"
              aria-label="上传文件"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
            <StatusBar status={status} />
            <div className="actions">
              <button className="btn btn-primary" onClick={commitCreated} disabled={!createdId}>保存入库</button>
              <button className="btn btn-ghost" onClick={cancel}>取消</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function StatusBar({ status, onFallback }: { status: Status; onFallback?: () => void }) {
  if (status.kind === 'idle') return null;
  if (status.kind === 'loading') {
    return (
      <div className="status loading" role="status">
        <span className="spinner" />
        {status.text}
      </div>
    );
  }
  if (status.kind === 'ok') {
    return <div className="status ok" role="status">{status.text}</div>;
  }
  return (
    <div className="status fail" role="alert">
      {status.text}
      {onFallback && (
        <button className="link" onClick={onFallback}>改用「粘贴文本」 →</button>
      )}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}
