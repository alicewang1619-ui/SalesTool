import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  extractDoi,
  extractArxivId,
  parseCrossref,
  parseArxivAtom,
  metaToArticle,
  fetchAcademicMeta,
} from '../../src/services/academic.ts';

describe('学术元数据：URL 解析（issue #9 延伸）', () => {
  it('从 science.org 提取 DOI', () => {
    expect(extractDoi('https://www.science.org/doi/10.1126/sciadv.aec3209?sessionid=1')).toBe('10.1126/sciadv.aec3209');
    expect(extractDoi('https://doi.org/10.1038/s41586-020-2649-2')).toBe('10.1038/s41586-020-2649-2');
    expect(extractDoi('https://example.com/blog/post')).toBeNull();
  });
  it('提取 arXiv id（含版本号）', () => {
    expect(extractArxivId('https://arxiv.org/abs/2401.12345')).toBe('2401.12345');
    expect(extractArxivId('http://arxiv.org/pdf/2111.06377v2')).toBe('2111.06377');
    expect(extractArxivId('https://example.com')).toBeNull();
  });
});

describe('学术元数据：响应解析', () => {
  it('解析 Crossref，去掉 JATS 标签', () => {
    const meta = parseCrossref({
      message: {
        title: ['Masked Autoencoders Are Scalable Vision Learners'],
        author: [{ given: 'Kaiming', family: 'He' }, { given: 'Xinlei', family: 'Chen' }],
        abstract: '<jats:p>This paper shows that <jats:italic>masked autoencoders</jats:italic> (MAE) are scalable.</jats:p>',
        'container-title': ['CVPR'],
        published: { 'date-parts': [[2022, 6]] },
        DOI: '10.1109/cvpr.2022.01553',
      },
    });
    expect(meta?.title).toContain('Masked Autoencoders');
    expect(meta?.authors).toEqual(['Kaiming He', 'Xinlei Chen']);
    expect(meta?.abstract).toBe('This paper shows that masked autoencoders (MAE) are scalable.');
    expect(meta?.venue).toBe('CVPR');
    expect(meta?.year).toBe('2022');
  });
  it('缺 title 返回 null', () => {
    expect(parseCrossref({ message: { author: [] } })).toBeNull();
  });
  it('解析 arXiv Atom', () => {
    const xml = `<feed><entry>
      <title>Deep Residual Learning</title>
      <summary>We present a residual learning framework.</summary>
      <published>2015-12-10T00:00:00Z</published>
      <author><name>Kaiming He</name></author>
      <author><name>Xiangyu Zhang</name></author>
    </entry></feed>`;
    const meta = parseArxivAtom(xml);
    expect(meta?.title).toBe('Deep Residual Learning');
    expect(meta?.abstract).toContain('residual learning framework');
    expect(meta?.authors).toEqual(['Kaiming He', 'Xiangyu Zhang']);
    expect(meta?.venue).toBe('arXiv');
    expect(meta?.year).toBe('2015');
  });
});

describe('学术元数据：Markdown 组装', () => {
  it('标题+作者+来源+摘要', () => {
    const { title, content } = metaToArticle(
      { title: 'MAE', authors: ['He'], abstract: '掩码自编码。', venue: 'CVPR', year: '2022', doi: '10.x/y' },
      'https://x.test/doi/10.x/y',
    );
    expect(title).toBe('MAE');
    expect(content).toContain('# MAE');
    expect(content).toContain('**作者**：He');
    expect(content).toContain('**来源**：CVPR · 2022');
    expect(content).toContain('掩码自编码。');
    expect(content).toContain('原文链接：https://x.test/doi/10.x/y');
  });
});

describe('学术元数据：网络抓取（issue #9：付费墙论文改取元数据）', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('DOI 链接经 Crossref 拿到元数据（付费墙也能入库）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ message: { title: ['Sci Paper'], author: [{ given: 'A', family: 'B' }], abstract: '<jats:p>摘要内容。</jats:p>' } }),
          { status: 200 },
        ),
      ),
    );
    const meta = await fetchAcademicMeta('https://www.science.org/doi/10.1126/sciadv.aec3209');
    expect(meta?.title).toBe('Sci Paper');
    expect(meta?.abstract).toBe('摘要内容。');
  });
  it('非学术 URL 返回 null（交给普通抓取）', async () => {
    const meta = await fetchAcademicMeta('https://example.com/blog');
    expect(meta).toBeNull();
  });
});
