import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

// jsdom 无 IntersectionObserver：提供惰性桩，组件无限滚动逻辑不报错（测试走「加载更多」按钮路径）。
class IOStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
vi.stubGlobal('IntersectionObserver', IOStub);

// scrollIntoView / scrollTo 在 jsdom 中缺失
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}

// 部分 jsdom 环境 localStorage 不完整：提供内存实现。
if (typeof localStorage === 'undefined' || typeof localStorage.clear !== 'function') {
  const store = new Map<string, string>();
  const mem: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    removeItem: (k: string) => store.delete(k) as unknown as void,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
  };
  vi.stubGlobal('localStorage', mem);
}
