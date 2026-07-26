import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import viteSvgLoader from 'vite-svg-loader'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 加载 .env.local 等环境文件，读取后端端口
  const env = loadEnv(mode, process.cwd(), '')
  const backendPort = env.VITE_BACKEND_PORT || 18080

  return {
    plugins: [
      tailwindcss(),
      vue(),
      vueJsx(),
      // 自定义 SVG 图标默认以组件形式引入：import Icon from './x.svg'
      viteSvgLoader({ defaultImport: 'component' }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      // 将 /api 请求代理到后端服务（端口由 resolve-port 脚本动态写入 .env.local）
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
