import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MarkdownView } from './MarkdownView.tsx';

describe('MarkdownView 数学公式渲染（issue #7）', () => {
  it('块级 $$…$$ 渲染为 KaTeX，不再显示原始 $$ 源码', async () => {
    const { container } = render(
      <MarkdownView content={'核心公式：\n\n$$\n\\hat{y} = \\sigma(wx + b)\n$$\n\n完'} />,
    );
    // KaTeX 按需异步加载：等待渲染完成。块级用 displayMode（.katex-display）
    await waitFor(() => expect(container.querySelector('.math-block .katex-display')).not.toBeNull());
    // 不残留原始定界符
    expect(container.textContent).not.toContain('$$');
  });

  it('行内 $…$ 渲染为 KaTeX', async () => {
    const { container } = render(<MarkdownView content={'给定输入 $x$ 与权重 $w$ 计算。'} />);
    await waitFor(() => expect(container.querySelectorAll('.math-inline .katex').length).toBe(2));
    expect(container.textContent).not.toContain('$x$');
  });

  it('普通 Markdown（标题/加粗/列表）仍正常渲染', () => {
    const { container } = render(
      <MarkdownView content={'# 标题\n\n**粗体** 与 `代码`\n\n- 项一\n- 项二'} />,
    );
    expect(container.querySelector('h2')?.textContent).toBe('标题');
    expect(container.querySelector('strong')?.textContent).toBe('粗体');
    expect(container.querySelector('code')?.textContent).toBe('代码');
    expect(container.querySelectorAll('.md-ul li').length).toBe(2);
  });

  it('普通文本里的孤立 $ 不误判为公式', () => {
    const { container } = render(<MarkdownView content={'价格是 5 元，不是 $ 符号问题'} />);
    expect(container.querySelector('.katex')).toBeNull();
    expect(container.textContent).toContain('价格是 5 元');
  });
});
