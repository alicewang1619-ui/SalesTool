import { describe, it, expect } from 'vitest';
import { toRelevance, cosine } from '../../src/util.ts';

describe('toRelevance 相关度映射（issue #5：配合图谱中心化）', () => {
  it('把 [-1,1] 线性映射到 [0,100]', () => {
    expect(toRelevance(0)).toBe(50);
    expect(toRelevance(1)).toBe(100);
    expect(toRelevance(-1)).toBe(0);
    expect(toRelevance(1.5)).toBe(100); // 越界钳制
    expect(toRelevance(-1.5)).toBe(0);
  });

  it('中心化后：无关（负余弦）落到 <50%、相关（正余弦）在 55%+', () => {
    expect(toRelevance(-0.83)).toBeLessThan(50); // 无关文本中心化后为负
    expect(toRelevance(0.53)).toBeGreaterThan(55); // 相关文本中心化后为正
  });
});

describe('cosine', () => {
  it('同向为 1、正交为 0', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it('维度不一致抛错', () => {
    expect(() => cosine([1, 0], [1])).toThrow();
  });
});
