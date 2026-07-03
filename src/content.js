// 扫描 courses/ 下的每一个子文件夹（= 一门课），把其中的 .md 解析成结构化文档。
// 新增一门课：在 courses/ 下放一个新子文件夹，里面按格式放 .md 即可，无需改代码。
import { parseDoc } from './parser.js';

const modules = import.meta.glob('../courses/*/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const CN = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

// 文件 / 课程的排序权重：数字前缀优先，其次"第N章"，其余排最后。
function sortKey(name) {
  const d = name.match(/^(\d+)/);
  if (d) return parseInt(d[1], 10);
  const c = name.match(/第([一二三四五六七八九十]+)章/);
  if (c) return 100 + (CN[c[1]] || 0);
  return 1000;
}

// 去掉排序前缀 / 后缀，得到展示用名称。
export function labelOf(name) {
  return name
    .replace(/\.md$/, '')
    .replace(/_押题与解析$/, '')
    .replace(/^\d+[_\-.\s]*/, '')
    .replace(/[_\-]/g, ' ')
    .trim();
}

function bySortKey(a, b) {
  return sortKey(a) - sortKey(b) || a.localeCompare(b, 'zh');
}

// 按子文件夹分组
const grouped = new Map(); // courseDir -> [{ filename, raw }]
for (const [path, raw] of Object.entries(modules)) {
  const parts = path.split('/'); // ['..','courses','<课程>','<文件>.md']
  const idx = parts.indexOf('courses');
  const course = parts[idx + 1];
  const filename = parts[parts.length - 1];
  if (!grouped.has(course)) grouped.set(course, []);
  grouped.get(course).push({ filename, raw });
}

export const courses = [...grouped.entries()]
  .sort((a, b) => bySortKey(a[0], b[0]))
  .map(([dir, files]) => ({
    dir,
    label: labelOf(dir),
    docs: files
      .sort((a, b) => bySortKey(a.filename, b.filename))
      .map((f) => parseDoc(f.raw, f.filename)),
  }));
