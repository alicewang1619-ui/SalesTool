/** 返回顶栏（录入/详情/编辑页）：← 返回 + 页面标题。 */
import { useNavigate } from 'react-router-dom';

export function BackTopbar({ title, backTo }: { title: string; backTo?: string }) {
  const navigate = useNavigate();
  return (
    <header className="topbar topbar-back">
      <button className="back" onClick={() => (backTo ? navigate(backTo) : navigate(-1))} aria-label="返回">
        ← 返回
      </button>
      <h1 className="topbar-title">{title}</h1>
    </header>
  );
}
