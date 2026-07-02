import { describe, it, expect } from 'vitest';
import { organize, OrganizeError } from '../../src/services/organize.ts';
import { StubProvider } from '../helpers.ts';

const providerReturning = (chat: string) =>
  new StubProvider({ chatFn: () => chat });

describe('U-AT-01 生成标签', () => {
  it('正常 JSON 返回 ≥1 个标签', async () => {
    const p = providerReturning(JSON.stringify({ tags: ['Redis', '缓存'], summary: '讲缓存。' }));
    const r = await organize(p, '一篇讲 Redis 缓存穿透的文章正文。');
    expect(r.tags.length).toBeGreaterThanOrEqual(1);
    expect(r.tags).toContain('Redis');
  });
});

describe('U-AT-02 生成摘要', () => {
  it('正常 JSON 返回摘要文本', async () => {
    const p = providerReturning(JSON.stringify({ tags: ['分布式'], summary: '分布式锁的实现要点。' }));
    const r = await organize(p, '分布式锁文章正文。');
    expect(r.summary).toBe('分布式锁的实现要点。');
  });

  it('容忍 ```json 包裹', async () => {
    const p = providerReturning('```json\n{"tags":["A"],"summary":"S"}\n```');
    const r = await organize(p, '正文');
    expect(r.tags).toEqual(['A']);
    expect(r.summary).toBe('S');
  });
});

describe('U-AT-03 异常格式容错', () => {
  it('非法 JSON 抛 OrganizeError（可重试，不写脏数据）', async () => {
    const p = providerReturning('这不是 JSON，模型乱答了一通');
    await expect(organize(p, '正文')).rejects.toBeInstanceOf(OrganizeError);
  });

  it('空内容抛 OrganizeError', async () => {
    const p = providerReturning('{}');
    await expect(organize(p, '   ')).rejects.toBeInstanceOf(OrganizeError);
  });

  it('JSON 缺 tags 时回退「未分类」保证 ≥1 标签', async () => {
    const p = providerReturning(JSON.stringify({ summary: '只有摘要' }));
    const r = await organize(p, '正文');
    expect(r.tags).toEqual(['未分类']);
    expect(r.summary).toBe('只有摘要');
  });
});

describe('U-AT-05 超短内容处理', () => {
  it('一句话内容也能产出标签/摘要不报错', async () => {
    const p = providerReturning(JSON.stringify({ tags: ['短文'], summary: '一句话。' }));
    const r = await organize(p, '缓存穿透。');
    expect(r.tags.length).toBeGreaterThanOrEqual(1);
  });
});
