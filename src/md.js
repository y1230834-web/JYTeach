// 统一的 markdown 渲染工具：集中配置 marked，并提供「带锚点 id 的渲染」。
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

export { marked };

// 渲染一段 markdown，并给其中的 ### / #### … 标题注入顺序锚点 id。
// 返回 { html, toc }；toc 为该段内的子标题目录（供左侧分级导航使用）。
//   prefix：本小节的 id 前缀（如 'sec-3'），子标题 id 形如 'sec-3-h-0'。
export function renderWithToc(md, prefix) {
  const text = (md || '').replace(/^﻿/, '');
  const tokens = marked.lexer(text);
  const heads = tokens.filter((t) => t.type === 'heading');

  let k = 0;
  const html = marked
    .parse(text)
    .replace(/<h([1-6])([^>]*)>/g, (_m, lvl, attrs) => {
      const id = `${prefix}-h-${k}`;
      k++;
      return `<h${lvl}${attrs} id="${id}">`;
    })
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, '</table></div>');

  const toc = heads.map((h, i) => ({
    id: `${prefix}-h-${i}`,
    level: h.depth,
    text: h.text,
  }));

  return { html, toc };
}
