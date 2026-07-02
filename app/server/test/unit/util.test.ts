import { describe, it, expect } from 'vitest';
import { toRelevance, cosine, lexicalScore } from '../../src/util.ts';

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

describe('lexicalScore 字面命中（issue #13）', () => {
  const title = '掩码图像建模 MAE';
  const text = 'MAE 用编码器重建被掩码的图像块，是自监督表示学习方法。';
  it('短缩写命中标题得高分', () => {
    expect(lexicalScore('MAE', title, text)).toBeGreaterThanOrEqual(0.6);
    expect(lexicalScore('mae', title, text)).toBeGreaterThanOrEqual(0.6); // 大小写不敏感
  });
  it('字面标题子串命中得高分', () => {
    expect(lexicalScore('掩码图像建模', title, text)).toBeGreaterThanOrEqual(0.6);
  });
  it('完全无关得 0', () => {
    expect(lexicalScore('红烧肉做法', title, text)).toBe(0);
  });
  it('空 query 得 0', () => {
    expect(lexicalScore('  ', title, text)).toBe(0);
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
