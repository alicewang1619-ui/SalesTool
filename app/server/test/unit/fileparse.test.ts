import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFile, detectKind, ParseError } from '../../src/services/fileparse.ts';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const read = (f: string) => fs.readFileSync(path.join(dir, f));

describe('U-ING-04 PDF 文本抽取', () => {
  it('从 PDF 抽取出可读文本', async () => {
    const r = await parseFile('sample.pdf', read('sample.pdf'));
    expect(r.content).toContain('Cache penetration');
    expect(r.title).toBe('sample');
  });
});

describe('U-ING-05 Word 文本抽取', () => {
  it('从 docx 抽取出中文文本', async () => {
    const r = await parseFile('sample.docx', read('sample.docx'));
    expect(r.content).toContain('分布式锁');
    expect(r.content).toContain('布隆过滤器');
  });
});

describe('U-ING-06 Markdown 解析', () => {
  it('Markdown 原文入库', async () => {
    const r = await parseFile('sample.md', read('sample.md'));
    expect(r.content).toContain('# Markdown 测试');
    expect(r.content).toContain('缓存击穿');
  });

  it('GBK 编码的 .md 正确解码为中文而非乱码（issue #6）', async () => {
    // “# 缓存击穿\n\n用互斥锁解决热点 key 失效。” 的 GBK 字节
    const gbk = Buffer.from('2320bbbab4e6bbf7b4a90a0ad3c3bba5b3e2cbf8bde2bef6c8c8b5e3206b657920caa7d0a7a1a3', 'hex');
    const r = await parseFile('gbk.md', gbk);
    expect(r.content).toContain('缓存击穿');
    expect(r.content).toContain('互斥锁');
    expect(r.content).not.toMatch(/�/); // 无替换字符（乱码标志）
  });

  it('带 UTF-8 BOM 的 .md 去掉 BOM 正确解码', async () => {
    const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('# 标题\n正文中文', 'utf8')]);
    const r = await parseFile('bom.md', bom);
    expect(r.content.startsWith('﻿')).toBe(false);
    expect(r.content).toContain('# 标题');
    expect(r.content).toContain('正文中文');
  });
});

describe('U-ING-07 损坏文件容错', () => {
  it('损坏 PDF 抛 ParseError 而非崩溃', async () => {
    await expect(parseFile('corrupt.pdf', read('corrupt.pdf'))).rejects.toBeInstanceOf(ParseError);
  });

  it('空文件抛 ParseError', async () => {
    await expect(parseFile('empty.md', Buffer.alloc(0))).rejects.toBeInstanceOf(ParseError);
  });

  it('不支持的扩展名抛 ParseError', () => {
    expect(() => detectKind('a.exe')).toThrow(ParseError);
  });
});
