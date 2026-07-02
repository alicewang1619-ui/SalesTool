/** 搜索顶栏（列表/检索/标签/问答/设置页共用）：全局搜索框 + 新增知识。 */
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export function SearchTopbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');

  useEffect(() => {
    if (location.pathname === '/search') {
      setQ(new URLSearchParams(location.search).get('q') ?? '');
    }
  }, [location.pathname, location.search]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <header className="topbar">
      <form className="search" onSubmit={onSearch} role="search">
        <span className="si">🔍</span>
        <input
          type="text"
          aria-label="全局搜索"
          placeholder="用大白话搜，比如「上次那篇讲缓存击穿的」"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>
      <button className="btn btn-primary" onClick={() => navigate('/new')}>
        <span>＋</span>新增知识
      </button>
    </header>
  );
}
