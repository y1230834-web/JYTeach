// 错题集的持久化存储。
// 用浏览器 localStorage 保存，纯静态站点部署到公网后依然有效：
// 数据存在访问者自己的浏览器里，刷新 / 重新部署都不会丢。
// 注意：localStorage 是「按浏览器 / 按设备」隔离的，不会跨设备同步
// （要跨设备同步需要后端，本项目是纯前端，不含后端）。
import { useSyncExternalStore } from 'react';

const KEY = 'review-wrongset-v1';

let cache = read();
const listeners = new Set();

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function write(arr) {
  cache = arr;
  try {
    localStorage.setItem(KEY, JSON.stringify(arr));
  } catch {
    /* 隐私模式 / 容量满：忽略，至少本次会话内存里仍可用 */
  }
  listeners.forEach((l) => l());
}

// 跨标签页同步：另一个标签修改了错题集，这里也刷新。
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      cache = read();
      listeners.forEach((l) => l());
    }
  });
}

export function isMarked(id) {
  return cache.some((e) => e.id === id);
}
export function addEntry(entry) {
  if (isMarked(entry.id)) return;
  write([...cache, { ...entry, addedAt: Date.now() }]);
}
export function removeEntry(id) {
  write(cache.filter((e) => e.id !== id));
}
export function toggleEntry(entry) {
  isMarked(entry.id) ? removeEntry(entry.id) : addEntry(entry);
}
// 错题集按课程隔离，「清空」只清当前课程，不影响其他课程的错题。
export function clearCourse(courseDir) {
  write(cache.filter((e) => e.courseDir !== courseDir));
}

export function mergeEntries(entries) {
  const incoming = Array.isArray(entries)
    ? entries.filter((e) => e && typeof e.id === 'string' && typeof e.type === 'string' && e.q)
    : [];
  const byId = new Map(cache.map((e) => [e.id, e]));
  let changed = 0;
  for (const entry of incoming) {
    const prev = byId.get(entry.id);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(entry)) changed++;
    byId.set(entry.id, entry);
  }
  if (incoming.length) write([...byId.values()]);
  return { imported: incoming.length, changed };
}

// ---- React 绑定 ----
function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function useWrongSet() {
  return useSyncExternalStore(subscribe, () => cache);
}
export function useIsMarked(id) {
  return useSyncExternalStore(subscribe, () => isMarked(id));
}
