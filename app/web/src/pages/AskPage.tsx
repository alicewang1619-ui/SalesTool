/**
 * 智能问答（/ask）。左侧多会话列表（新建/切换/重命名/删除，本地持久化）+ 右侧对话流。
 * 每个会话独立保留历史问答与多轮上下文；答案支持 Markdown/LaTeX/代码块与可点来源角标。
 * 数据来自真实后端 /ask（RAG）；模型标识来自 /settings/model。
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client.ts';
import type { AnswerResult } from '../api/types.ts';
import { MarkdownView } from '../lib/MarkdownView.tsx';

interface UserMsg { role: 'user'; text: string }
interface AiMsg {
  role: 'ai';
  status: 'thinking' | 'answer' | 'no-context' | 'error';
  answer?: AnswerResult;
  errorText?: string;
}
type Msg = UserMsg | AiMsg;

interface Conversation {
  id: string;
  title: string;
  msgs: Msg[];
  updatedAt: number;
}

const SESSIONS_KEY = 'zkb-ask-sessions';
/** 旧的单对话 key（issue #10）——首次加载迁移成一个会话。 */
const LEGACY_KEY = 'zkb-ask-conversation';
const DEFAULT_TITLE = '新对话';

function genId(): string {
  return (crypto as { randomUUID?: () => string }).randomUUID?.() ?? `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function makeSession(): Conversation {
  return { id: genId(), title: DEFAULT_TITLE, msgs: [], updatedAt: Date.now() };
}
/** 丢弃未完成的「思考中」气泡（持久化/恢复时不保留中间态）。 */
function settled(msgs: Msg[]): Msg[] {
  return msgs.filter((m) => m.role === 'user' || (m.role === 'ai' && m.status !== 'thinking'));
}
function firstQuestion(msgs: Msg[]): string | null {
  const u = msgs.find((m) => m.role === 'user') as UserMsg | undefined;
  return u ? u.text.slice(0, 20) : null;
}

/** 渲染答案：Markdown + LaTeX 公式（复用 MarkdownView），并把 [n] 渲染为可点击来源角标。 */
function renderAnswer(text: string, sources: AnswerResult['sources']) {
  const byIndex = new Map(sources.map((s) => [s.index, s]));
  return (
    <MarkdownView
      content={text}
      renderCitation={(n) => {
        const src = byIndex.get(n);
        return src ? (
          <Link className="cite" to={`/k/${src.knowledge_id}`} data-testid="cite">
            {n}
          </Link>
        ) : (
          <span className="cite">{n}</span>
        );
      }}
    />
  );
}

/**
 * 从本地存储恢复多会话（含旧单对话迁移）。
 * 关键：在 useState 惰性初始化里同步完成，而不是用 useEffect——否则持久化 effect 会先用
 * 初始空态覆盖已存历史，随后（尤其 StrictMode 双调用）再读到空的，导致「切换页面后历史丢失」（issue #17）。
 */
function loadInitial(): { sessions: Conversation[]; activeId: string } {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { sessions?: Conversation[]; activeId?: string };
      const cleaned = (parsed.sessions ?? [])
        .map((s) => ({ ...s, msgs: settled(s.msgs ?? []) }))
        .filter((s) => s.msgs.length > 0);
      if (cleaned.length) {
        const activeId = cleaned.some((s) => s.id === parsed.activeId) ? parsed.activeId! : cleaned[0].id;
        return { sessions: cleaned, activeId };
      }
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const m = settled(JSON.parse(legacy) as Msg[]);
      localStorage.removeItem(LEGACY_KEY);
      if (m.length) {
        const s: Conversation = { id: genId(), title: firstQuestion(m) ?? DEFAULT_TITLE, msgs: m, updatedAt: Date.now() };
        return { sessions: [s], activeId: s.id };
      }
    }
  } catch {
    /* 忽略损坏的历史 */
  }
  const s = makeSession();
  return { sessions: [s], activeId: s.id };
}

export function AskPage() {
  const [params] = useSearchParams();
  // 惰性初始化恢复历史，只计算一次（用 ref 保证 sessions/activeId 来自同一次读取）。
  const initialRef = useRef<{ sessions: Conversation[]; activeId: string }>(undefined);
  if (!initialRef.current) initialRef.current = loadInitial();
  const [sessions, setSessions] = useState<Conversation[]>(initialRef.current.sessions);
  const [activeId, setActiveId] = useState<string>(initialRef.current.activeId);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState('加载中…');
  const chatRef = useRef<HTMLDivElement>(null);

  const active = useMemo(() => sessions.find((s) => s.id === activeId) ?? sessions[0], [sessions, activeId]);
  const msgs = active?.msgs ?? [];

  useEffect(() => {
    api
      .getModel()
      .then((m) => setModel(m.provider === 'local' ? `⚡ 本地 Ollama · ${m.chatModel}` : `☁️ 云端 · ${m.chatModel}`))
      .catch(() => setModel('模型未知'));
  }, []);

  // 从检索页「去问答」带入的预填问题
  useEffect(() => {
    const q = params.get('q');
    if (q) setInput(q);
  }, [params]);

  // 持久化：丢弃「思考中」；不保留除当前外的空会话。
  useEffect(() => {
    const persistable = sessions
      .filter((s) => s.msgs.length > 0 || s.id === activeId)
      .map((s) => ({ ...s, msgs: settled(s.msgs) }));
    localStorage.setItem(SESSIONS_KEY, JSON.stringify({ sessions: persistable, activeId }));
  }, [sessions, activeId]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [msgs]);

  function startNewSession() {
    if (active && active.msgs.length === 0) return; // 当前已是空白新对话
    const s = makeSession();
    setSessions((prev) => [s, ...prev.filter((p) => p.msgs.length > 0)]);
    setActiveId(s.id);
    setInput('');
  }

  function deleteSession(id: string) {
    setSessions((prev) => {
      const rest = prev.filter((s) => s.id !== id);
      const next = rest.length ? rest : [makeSession()];
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  }

  function renameSession(id: string) {
    const cur = sessions.find((s) => s.id === id);
    const name = window.prompt('重命名对话', cur?.title ?? '')?.trim();
    if (!name) return;
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title: name.slice(0, 30) } : s)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    const sid = activeId; // 提问所在会话，即使中途切换也写回它
    // 多轮历史（issue #10）：取当前会话已完成问答对最近若干条。
    type Turn = { role: 'user' | 'assistant'; content: string };
    const history: Turn[] = msgs
      .flatMap((mm): Turn[] => {
        if (mm.role === 'user') return [{ role: 'user', content: mm.text }];
        if (mm.role === 'ai' && mm.status === 'answer' && mm.answer) return [{ role: 'assistant', content: mm.answer.answer }];
        return [];
      })
      .slice(-6);

    const patch = (fn: (m: Msg[]) => Msg[], title?: string) =>
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sid
            ? { ...s, title: title && s.title === DEFAULT_TITLE ? title : s.title, msgs: fn(s.msgs), updatedAt: Date.now() }
            : s,
        ),
      );

    setInput('');
    setBusy(true);
    patch((m) => [...m, { role: 'user', text: question }, { role: 'ai', status: 'thinking' }], question.slice(0, 20));
    try {
      const res = await api.ask(question, history);
      patch((m) => {
        const next = [...m];
        next[next.length - 1] = res.hasContext ? { role: 'ai', status: 'answer', answer: res } : { role: 'ai', status: 'no-context' };
        return next;
      });
    } catch (err) {
      const e2 = err instanceof ApiError ? err : null;
      patch((m) => {
        const next = [...m];
        next[next.length - 1] = { role: 'ai', status: 'error', errorText: e2?.message ?? String(err) };
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ask-layout">
      <aside className="ask-sessions" aria-label="对话列表">
        <button className="btn btn-sm btn-primary new-conv" onClick={startNewSession} data-testid="new-chat">＋ 新对话</button>
        <div className="conv-list">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`conv-item${s.id === activeId ? ' active' : ''}`}
              onClick={() => setActiveId(s.id)}
              data-testid="conv-item"
            >
              <span className="conv-title">{s.title || DEFAULT_TITLE}</span>
              <span className="conv-actions">
                <button className="conv-btn" title="重命名" onClick={(e) => { e.stopPropagation(); renameSession(s.id); }} data-testid="conv-rename">✏️</button>
                <button className="conv-btn" title="删除" onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }} data-testid="conv-delete">🗑️</button>
              </span>
            </div>
          ))}
        </div>
      </aside>

      <div className="ask-main">
        <header className="topbar ask-topbar">
          <h1 className="topbar-title">问答</h1>
          <span className="model" data-testid="model-badge">{model}</span>
        </header>

        <div className="chat" ref={chatRef}>
          <div className="thread">
            {msgs.length === 0 && (
              <div className="ask-empty" data-testid="ask-empty">
                <div className="emoji">💬</div>
                <p>基于你的整个知识库提问，AI 会检索相关知识并给出带来源的答案。</p>
              </div>
            )}
            {msgs.map((m, i) =>
              m.role === 'user' ? (
                <div className="msg user" key={i}>
                  <div className="avatar">🧑</div>
                  <div className="bubble">{m.text}</div>
                </div>
              ) : (
                <div className="msg ai" key={i}>
                  <div className="avatar">✨</div>
                  <div className="bubble">
                    {m.status === 'thinking' && (
                      <div className="thinking" data-testid="thinking">
                        正在从你的库里检索
                        <span className="dots"><span /><span /><span /></span>
                      </div>
                    )}
                    {m.status === 'answer' && m.answer && (
                      <div className="answer" data-testid="answer">
                        {renderAnswer(m.answer.answer, m.answer.sources)}
                        {m.answer.sources.length > 0 && (
                          <div className="sources">
                            <div className="lab">📎 答案来源（引用最相关的 {m.answer.sources.length} 条知识）</div>
                            {m.answer.sources.map((s) => (
                              <Link className="src-item" to={`/k/${s.knowledge_id}`} key={s.index} data-testid="source-item">
                                <span className="num">{s.index}</span>
                                <span className="t">{s.title}</span>
                                <span className="arrow">↗</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {m.status === 'no-context' && (
                      <div className="answer" data-testid="no-context">
                        <p>库里没有找到相关内容。换个问法，或先去<Link className="src-link" to="/new">录入相关知识</Link>。</p>
                      </div>
                    )}
                    {m.status === 'error' && (
                      <div className="answer" data-testid="ask-error">
                        <p>无法获取答案：{m.errorText}</p>
                        <p>本地模型可能未启动，去<Link className="src-link" to="/settings">设置</Link>启用或切换云端后重试。</p>
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="composer">
          <form className="composer-inner" onSubmit={submit}>
            <input
              type="text"
              aria-label="提问"
              placeholder="基于你的知识库提问，比如「分布式锁哪种最可靠」"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className="send" type="submit" aria-label="发送" disabled={busy || !input.trim()}>↑</button>
          </form>
        </div>
      </div>
    </div>
  );
}
