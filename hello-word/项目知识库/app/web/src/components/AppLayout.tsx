/** 全站骨架：左侧固定导航 + 主内容（Outlet）。顶栏由各页自带（搜索顶栏 / 返回顶栏）。 */
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../api/client.ts';

const NAV = [
  { to: '/', label: '全部知识', icon: '📚', end: true },
  { to: '/tags', label: '标签', icon: '🏷️', end: false },
  { to: '/graph', label: '图谱', icon: '🕸️', end: false },
  { to: '/ask', label: '问答', icon: '💬', end: false },
  { to: '/settings', label: '设置', icon: '⚙️', end: false },
];

export function AppLayout() {
  const location = useLocation();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    api.stats().then((s) => setCount(s.knowledge)).catch(() => setCount(null));
  }, [location.key]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand"><span className="dot" /><span>项目知识库</span></div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="ic">{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
        <div className="sidebar-foot">
          本地优先 · 数据全在本机
          <br />
          {count === null ? '· · ·' : `共 ${count} 条知识`}
        </div>
      </aside>
      <div className="main">
        <Outlet />
      </div>
    </div>
  );
}
