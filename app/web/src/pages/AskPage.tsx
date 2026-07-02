/**
 * 智能问答（/ask）。复刻 mvp_问答_智能问答.html：
 * 顶栏（标题 + 当前模型标识）+ 对话消息流（用户问 / AI 答含行内引用角标 + 来源列表）+ 思考态 + 底部输入框。
 * 数据来自真实后端 /ask（RAG）；模型标识来自 /settings/model。
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
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

/** 对话历史持久化 key（issue #10）。 */
const CHAT_KEY = 'zkb-ask-conversation';

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

export function AskPage() {
  const [params] = useSearchParams();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState('加载中…');
  const chatRef = useRef<HTMLDivElement>(null);

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

  // 恢复上次对话（issue #10：刷新/离开再回来保留历史问答）。丢弃未完成的「思考中」气泡。
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAT_KEY);
      if (!saved) return;
      const restored = (JSON.parse(saved) as Msg[]).filter(
        (mm) => mm.role === 'user' || (mm.role === 'ai' && mm.status !== 'thinking'),
      );
      if (restored.length) setMsgs(restored);
    } catch {
      /* 忽略损坏的历史 */
    }
  }, []);

  // 持久化对话（仅落已完成的消息，避免把「思考中」存进去）。
  useEffect(() => {
    const settled = msgs.filter((mm) => mm.role === 'user' || (mm.role === 'ai' && mm.status !== 'thinking'));
    if (settled.length) localStorage.setItem(CHAT_KEY, JSON.stringify(settled));
    else localStorage.removeItem(CHAT_KEY);
  }, [msgs]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [msgs]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    // 用当前对话构造多轮历史（只取已完成的问答对，最近若干条），供后端理解指代（issue #10）。
    type Turn = { role: 'user' | 'assistant'; content: string };
    const history: Turn[] = msgs
      .flatMap((mm): Turn[] => {
        if (mm.role === 'user') return [{ role: 'user', content: mm.text }];
        if (mm.role === 'ai' && mm.status === 'answer' && mm.answer) {
          return [{ role: 'assistant', content: mm.answer.answer }];
        }
        return [];
      })
      .slice(-6);
    setInput('');
    setBusy(true);
    setMsgs((prev) => [...prev, { role: 'user', text: question }, { role: 'ai', status: 'thinking' }]);
    try {
      const res = await api.ask(question, history);
      setMsgs((prev) => {
        const next = [...prev];
        next[next.length - 1] = res.hasContext
          ? { role: 'ai', status: 'answer', answer: res }
          : { role: 'ai', status: 'no-context' };
        return next;
      });
    } catch (err) {
      const e2 = err instanceof ApiError ? err : null;
      setMsgs((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: 'ai', status: 'error', errorText: e2?.message ?? String(err) };
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ask-main">
      <header className="topbar ask-topbar">
        <h1 className="topbar-title">问答</h1>
        <span className="model" data-testid="model-badge">{model}</span>
        {msgs.length > 0 && (
          <button
            className="btn btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={() => {
              setMsgs([]);
              localStorage.removeItem(CHAT_KEY);
            }}
            data-testid="new-chat"
          >
            🗑️ 新对话
          </button>
        )}
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
  );
}
