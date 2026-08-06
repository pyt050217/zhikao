import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // GitHub Pages 部署在 https://用户名.github.io/zhikao/ 子路径下
  base: process.env.GITHUB_PAGES === 'true' ? '/zhikao/' : '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    // 后端已改为 Vercel serverless functions，无独立后端服务。
    // 本地完整调试请用 `vercel dev`（自动代理 /api 到边缘函数）。
    // 直接 `npm run dev` 时 /api 请求会失败，但出题/题库功能会自动回退到本地题库。
  }
})
