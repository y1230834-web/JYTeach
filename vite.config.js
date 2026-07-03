import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 复习资料放在项目内的 courses/ 文件夹（每个子文件夹 = 一门课）。
// 全部内容在 build 时内联进 dist/，产物是纯静态站点，可直接托管。
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true },
});
