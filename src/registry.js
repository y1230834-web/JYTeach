// ============================================================================
// 题型注册表（架构的可扩展核心）
// ----------------------------------------------------------------------------
// 每一种交互题型在这里注册一次，描述三件事：
//   - type   : 内部类型名（与 components.jsx 里的渲染组件一一对应）
//   - match  : 用小节标题（## 后面的文字）判断该小节是否属于此题型
//   - parse  : 把该小节的若干行文本解析成「题目对象数组」
//
// 解析原则：任何一种 parse 失败 / 解析不出题目时，小节会自动回退为普通 markdown
// 直接渲染（见 parser.js）。所以"标题命中了关键字但其实是张表格"不会出错。
//
// 想新增题型（比如"连线题""排序题"）：在 QUESTION_TYPES 里加一项，并在
// components.jsx 的 RENDERERS 里加同名组件即可，其余代码无需改动。
// ============================================================================

// 标准答案括号：题干里 （**……**） 的内容即正确答案。
// 兼容全角（）与半角()。
const ANSWER_PAREN = /[（(]\s*\*\*([^*]+?)\*\*\s*[)）]/;

// 题首编号：`12.` / `12、` / `12．`
const NUM_HEAD = /^\s*(\d+)\s*[.、．]\s*(.+)$/;

// 解析行：`- 解析：……` / `* 解析:……`（可缩进）
const EXPLAIN_LINE = /^\s*[-*]\s*解析\s*[:：]\s*(.+)$/;

function matchExplain(line) {
  const m = line.match(EXPLAIN_LINE);
  return m ? m[1].trim() : null;
}

const IMPORTANT_RE = /(?:【重点】|\[重点\]|重点题)/;

function pullImportant(text) {
  const important = IMPORTANT_RE.test(text);
  const clean = text.replace(IMPORTANT_RE, '').replace(/\s{2,}/g, ' ').trim();
  return { text: clean, important };
}

// ---------------------------------------------------------------------------
// 判断题： `1. 题干（**√**）`，下一行可选 `- 解析：……`
// ---------------------------------------------------------------------------
function parseJudgment(lines) {
  const items = [];
  for (const line of lines) {
    const head = line.match(NUM_HEAD);
    const ans = line.match(/[（(]\s*\*\*\s*([√×对错TFtf正误])\s*\*\*\s*[)）]/);
    if (head && ans) {
      const raw = ans[1];
      const answer = /[√对T t正]/i.test(raw) ? '√' : '×';
      const rawStem = head[2].replace(/[（(]\s*\*\*\s*[√×对错TFtf正误]\s*\*\*\s*[)）]\s*$/, '').trim();
      const { text: stem, important } = pullImportant(rawStem);
      items.push({ num: head[1], stem, answer, explain: '', important });
      continue;
    }
    const ex = matchExplain(line);
    if (ex && items.length) {
      const last = items[items.length - 1];
      last.explain += (last.explain ? '\n' : '') + ex;
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// 选择题（单选 / 多选 / 不定项）：
//   1. 题干……（**ABD**）          ← 正确答案字母写在括号里加粗
//      A 选项一  B 选项二  C 选项三  D 选项四   ← 选项行，可多于 4 项
//      - 解析：……（可选）
// 选项也可分多行写，每行一个：
//      A 选项一
//      B 选项二
// ---------------------------------------------------------------------------
function parseChoice(lines) {
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i].match(NUM_HEAD);
    const ans = lines[i].match(/[（(]\s*\*\*([A-Za-z]+)\*\*\s*[)）]/);
    if (!head || !ans) continue;

    const answer = ans[1].toUpperCase().split('').sort().join('');
    const rawStem = head[2].replace(/[（(]\s*\*\*[A-Za-z]+\*\*\s*[)）]/, '（____）').trim();
    const { text: stem, important } = pullImportant(rawStem);

    // 收集选项：从下一非空行起，连续的「以选项字母开头」的行
    const options = [];
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    while (j < lines.length) {
      const t = lines[j];
      if (t.trim() === '') { j++; continue; }
      if (matchExplain(t)) break;
      if (NUM_HEAD.test(t)) break; // 到了下一题
      const got = parseOptionLine(t);
      if (got.length === 0) break;
      options.push(...got);
      // 若该行只含单个选项，继续往下；若一行含多个选项，也已全部收入
      j++;
      // 若下一行又是新题号或解析，循环条件会处理
    }
    if (options.length === 0) continue;

    // 解析（可选）
    let explain = '';
    while (j < lines.length && lines[j].trim() === '') j++;
    const ex = j < lines.length ? matchExplain(lines[j]) : null;
    if (ex) explain = ex;

    const multi = answer.length > 1;
    items.push({ num: head[1], stem, answer, options, explain, multi, important });
    i = j - 1;
  }
  return items;
}

// 把一行拆成若干选项。支持：
//   "A 选一 B 选二 **C 选三** D 选四"  （一行多个）
//   "A. 选一"                          （一行一个，允许 A. / A、 / A )）
function parseOptionLine(line) {
  const clean = line.replace(/\*\*/g, '').trim();
  // 一行一个选项（带分隔符）
  const single = clean.match(/^([A-Za-z])\s*[.、．)）]\s*(.+)$/);
  if (single) return [{ label: single[1].toUpperCase(), text: single[2].trim() }];
  // 一行多个：用 A–Z 作为切分标记（选项正文为中文/数字，不含孤立大写字母）
  const opts = [];
  const re = /([A-Z])[ 　\t.、．)）]*((?:(?![A-Z][ 　\t.、．)）]).)*)/g;
  let m;
  while ((m = re.exec(clean))) {
    const text = m[2].trim();
    if (text) opts.push({ label: m[1].toUpperCase(), text });
  }
  return opts;
}

// ---------------------------------------------------------------------------
// 填空题：
//   1. 中华人民共和国成立于 ____ 年，首都是 ____。（**1949｜北京**）
//      - 解析：……（可选）
// 题干用 ____（≥2 个下划线）表示空位；答案写在末尾括号里，多个空用 ｜ / | / ；分隔。
// ---------------------------------------------------------------------------
function parseFill(lines) {
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i].match(NUM_HEAD);
    const ans = lines[i].match(ANSWER_PAREN);
    if (!head || !ans) continue;
    if (!/_{2,}/.test(head[2])) continue; // 没有空位不算填空题

    const answers = ans[1].split(/[｜|；;]/).map((s) => s.trim()).filter(Boolean);
    const rawStem = head[2].replace(ANSWER_PAREN, '').trim();
    const { text: stem, important } = pullImportant(rawStem);
    const blanks = (stem.match(/_{2,}/g) || []).length || answers.length;

    let explain = '';
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    const ex = j < lines.length ? matchExplain(lines[j]) : null;
    if (ex) { explain = ex; i = j; }

    items.push({ num: head[1], stem, answers, blanks, explain, important });
  }
  return items;
}

// ---------------------------------------------------------------------------
// 主观题（名词解释 / 简答 / 论述 / 问答）：
//   **5. 政府具有哪些特征？**
//   - ① ……
//   - ② ……
// 整行加粗的 `**编号. 问题**` 作为题目；其后到下一个 `**…` 行均为参考答案。
// ---------------------------------------------------------------------------
function parseSubjective(lines) {
  const items = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^\s*\*\*(.+?)\*\*(.*)$/);
    if (m) {
      if (cur) items.push(cur);
      cur = { title: m[1].trim(), bodyLines: [] };
      if (m[2].trim()) cur.bodyLines.push(m[2].trim());
    } else if (cur) {
      cur.bodyLines.push(line);
    }
  }
  if (cur) items.push(cur);

  return items.map((it) => {
    // 正文遇到独立水平分割线即截断（小节分隔 / 页脚）
    const body = it.bodyLines.join('\n').split(/\n[ \t]*-{3,}[ \t]*(?:\n|$)/)[0];
    const { text: title, important } = pullImportant(it.title);
    return { title, answerMd: body.trim().replace(/^[:：]\s*/, ''), important };
  });
}

// ---------------------------------------------------------------------------
// 注册表：顺序即优先级（靠前的先匹配）。
// ---------------------------------------------------------------------------
export const QUESTION_TYPES = [
  { type: 'judgment', match: (h) => /判断/.test(h), parse: parseJudgment },
  { type: 'choice', match: (h) => /选择|单选|多选|不定项/.test(h), parse: parseChoice },
  { type: 'fill', match: (h) => /填空/.test(h), parse: parseFill },
  { type: 'subjective', match: (h) => /名词解释|简答|论述|问答|思考题/.test(h), parse: parseSubjective },
];
