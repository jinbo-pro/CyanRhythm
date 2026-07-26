import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import './style.css'
import App from './App.vue'
import { router } from './router/index.js'
import { useSettingsStore } from './stores/settings.js'
import { useLibraryStore } from './stores/library.js'
import { usePlaylistStore } from './stores/playlist.js'
import { useStatsStore } from './stores/stats.js'
import { usePlayerStore } from './stores/player.js'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// 全局注册 Element Plus
app.use(ElementPlus)
// 全局注册所有 Element Plus 图标（<el-icon><Plus /></el-icon>）
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app')

// 应用启动后初始化持久化数据：配置、媒体库歌曲、播放列表、恢复上次播放
// 顺序很重要：library 必须在 player.restoreLast 之前加载，因为后者依赖库内歌曲数据
;(async () => {
  try {
    const settings = useSettingsStore(pinia)
    await settings.load() // 内部会 applyTheme()

    const library = useLibraryStore(pinia)
    await library.load() // 从 IndexedDB 恢复歌曲列表，刷新后不丢失

    const playlist = usePlaylistStore(pinia)
    await playlist.load()

    // 加载播放统计历史，确保后续播放埋点能正确累加到已有记录
    const stats = useStatsStore(pinia)
    await stats.load()

    const player = usePlayerStore(pinia)
    await player.restoreLast()
  } catch (e) {
    console.error('[app] 初始化失败:', e)
  }
})()
