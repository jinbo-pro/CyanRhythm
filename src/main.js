import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import './style.css'
import App from './App.vue'
import { router } from './router/index.js'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useSettingsStore } from './stores/settings.js'
import { useLibraryStore } from './stores/library.js'
import { usePlaylistStore } from './stores/playlist.js'
import { useStatsStore } from './stores/stats.js'
import { usePlayerStore } from './stores/player.js'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// 全局注册所有 Element Plus 图标（<el-icon><Plus /></el-icon>）
// 注：UI 组件已通过 unplugin-vue-components 按需自动引入，无需 app.use(ElementPlus)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 禁用 WebView 原生右键菜单（打包后不再弹出 Reload/Inspect 等）
// dev 模式下保留，方便开发调试
document.addEventListener('contextmenu', (e) => {
  if (!import.meta.env.DEV) e.preventDefault()
})

app.mount('#app')

// 应用启动后初始化持久化数据
// 优化：settings 先加载（应用主题避免闪烁）→ 立即显示窗口 → 其余数据并行加载
;(async () => {
  try {
    // 1. 优先加载设置并应用主题（避免窗口出现时的主题闪烁）
    const settings = useSettingsStore(pinia)
    await settings.load()

    // 2. 主题就绪后立即显示窗口（UI 已挂载，数据将在后台并行加载并响应式填充）
    try {
      const win = getCurrentWindow()
      await win.show()
      await win.setFocus()
    } catch {
      // 非 Tauri 环境（纯浏览器调试）忽略
    }

    // 3. 并行加载无依赖关系的持久化数据（原先串行，现改为并行加速启动）
    const library = useLibraryStore(pinia)
    const playlist = usePlaylistStore(pinia)
    const stats = useStatsStore(pinia)
    await Promise.all([
      library.load(), // 从 IndexedDB 恢复歌曲列表
      playlist.load(),
      stats.load(),
    ])

    // 4. 恢复上次播放状态（依赖 library 数据，必须在 library.load 之后）
    const player = usePlayerStore(pinia)
    await player.restoreLast()
  } catch (e) {
    console.error('[app] 初始化失败:', e)
    // 确保即使初始化出错也能显示窗口
    try { await getCurrentWindow().show() } catch {}
  }
})()
