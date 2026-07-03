// 把一份 .md 文本解析成结构化文档：标题 + 引言 + 若干小节 + 分级目录(toc)。
// 小节按「标题关键字」交由题型注册表判定类型；解析失败一律回退为普通 markdown。

import { QUESTION_TYPES } from './registry.js';
import { renderWithToc } from './md.js';

export function parseDoc(raw, filename) {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');

  let title = filename.replace(/\.md$/, '');
  const headerLines = []; // # 标题之后、第一个 ## 之前的内容（引言）
  const rawSections = [];
  let cur = null;

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*)$/);
    const h1 = !h2 && line.match(/^#\s+(.*)$/);
    if (h1) {
      title = h1[1].trim();
      continue;
    }
    if (h2) {
      cur = { heading: h2[1].trim(), lines: [] };
      rawSections.push(cur);
    } else if (cur) {
      cur.lines.push(line);
    } else {
      headerLines.push(line);
    }
  }

  const sections = rawSections.map((s, i) => classify(s, `sec-${i}`));

  // 分级目录：每个小节标题(level 2) + 讲解型小节内部的 ### / #### 子标题。
  const toc = [];
  for (const sec of sections) {
    toc.push({ id: sec.id, level: 2, text: sec.heading });
    for (const e of sec.subToc) toc.push(e);
  }

  return {
    title,
    filename,
    intro: headerLines.join('\n').trim(),
    sections,
    toc,
  };
}

function classify(section, id) {
  const h = section.heading;
  const def = QUESTION_TYPES.find((d) => d.match(h));

  if (def) {
    const items = def.parse(section.lines) || [];
    // 命中题型但没解析出题目（例如只是一张速查表）→ 回退普通 markdown
    if (items.length > 0) {
      return { id, heading: h, type: def.type, items, html: '', subToc: [] };
    }
  }

  const md = section.lines.join('\n').trim();
  const { html, toc } = renderWithToc(md, id);
  return { id, heading: h, type: 'markdown', items: [], html, subToc: toc };
}
