/** 轻量 Toast：成功/错误反馈。通过 context 暴露 useToast。 */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ToastKind = 'default' | 'success' | 'danger';
interface ToastItem { id: number; msg: string; kind: ToastKind; }
interface ToastApi { show: (msg: string, kind?: ToastKind) => void; }

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((msg: string, kind: ToastKind = 'default') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, msg, kind }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'default' ? '' : `toast-${t.kind}`}`}>{t.msg}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast 必须在 ToastProvider 内使用');
  return ctx;
}
