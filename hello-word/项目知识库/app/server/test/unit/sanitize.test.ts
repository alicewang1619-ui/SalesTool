import { describe, it, expect } from 'vitest';
import { sanitizeContent, containsExecutableScript } from '../../src/services/sanitize.ts';

describe('U-ING-08 / S-SEC-03 脚本清洗', () => {
  it('移除 <script> 标签及内容', () => {
    const input = '正文前<script>alert(1)</script>正文后';
    const out = sanitizeContent(input);
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('正文前');
    expect(out).toContain('正文后');
  });

  it('移除内联事件处理器属性', () => {
    const out = sanitizeContent('<img src=x onerror="steal()">');
    expect(out).not.toMatch(/onerror/i);
    expect(containsExecutableScript(out)).toBe(false);
  });

  it('中和 javascript: 协议', () => {
    const out = sanitizeContent('<a href="javascript:evil()">点我</a>');
    expect(out).not.toMatch(/javascript:/i);
  });

  it('普通中文正文与 Markdown 保留不变', () => {
    const md = '# 标题\n\n这是**重点**，列表：\n- 一\n- 二';
    expect(sanitizeContent(md)).toBe(md);
  });

  it('containsExecutableScript 正确识别残留脚本', () => {
    expect(containsExecutableScript('<script>x</script>')).toBe(true);
    expect(containsExecutableScript('纯文本')).toBe(false);
  });
});
