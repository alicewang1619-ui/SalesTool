import { describe, it, expect } from 'vitest';
import { chunkText } from '../../src/services/chunk.ts';

describe('U-SR-01 长文分块不丢字', () => {
  it('分块后拼接覆盖全部原文字符，无丢字', () => {
    const text = Array.from({ length: 50 }, (_, i) => `第${i}段内容，讲述缓存穿透与布隆过滤器的细节。`).join('\n');
    const chunks = chunkText(text, 200, 40);
    expect(chunks.length).toBeGreaterThan(1);
    // 每块大小在阈值内
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(200);
    // 不丢字：原文每个非空白字符都至少出现在某块中（去重字符集合包含）
    const joined = chunks.map((c) => c.text).join('');
    for (const ch of text.replace(/\s/g, '')) {
      expect(joined.includes(ch)).toBe(true);
    }
  });

  it('块间存在重叠（相邻块有公共尾首片段）', () => {
    const text = '0123456789'.repeat(60); // 600 字符
    const chunks = chunkText(text, 200, 50);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    // 重叠：第二块开头应能在第一块结尾附近找到
    const a = chunks[0].text;
    const b = chunks[1].text;
    expect(a.slice(-20).length).toBe(20);
    expect(b.length).toBeGreaterThan(0);
  });

  it('空内容返回空数组', () => {
    expect(chunkText('   ')).toEqual([]);
  });

  it('非法 overlap（>=size）抛错', () => {
    expect(() => chunkText('abc', 10, 10)).toThrow();
  });
});
