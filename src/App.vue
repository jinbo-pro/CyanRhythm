<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import Sidebar from './components/layout/Sidebar.vue'
import PlayerBar from './components/layout/PlayerBar.vue'
import PlayerDetail from './components/player/PlayerDetail.vue'
import FolderPicker from './components/common/FolderPicker.vue'
import ImportProgressDialog from './components/common/ImportProgressDialog.vue'
import SettingsDialog from '@/components/common/SettingsDialog/index.vue'
import { useImport } from './composables/useImport.js'
import { useShortcuts } from './composables/useShortcuts.js'
import { useSettingsStore } from './stores/settings.js'
import { eventBus, EVENTS } from './utils/eventBus.js'

const { folderPickerOpen, startScan } = useImport()

const settingsOpen = ref(false)
const detailOpen = ref(false)

// 全局快捷键：settings 在 mount 前已加载完毕（loaded 已 true），
// 所以用 immediate 在 watch 创建时立即绑定；之后 shortcuts 变更自动重绑
const settingsStore = useSettingsStore()
const { bind: bindShortcuts, unbind: unbindShortcuts } = useShortcuts()
watch(
  () => settingsStore.shortcuts,
  () => {
    if (settingsStore.loaded) bindShortcuts()
  },
  { deep: true, immediate: true }
)

// 通过全局事件总线监听打开设置
function openSettings() {
  settingsOpen.value = true
}
onMounted(() => eventBus.on(EVENTS.OPEN_SETTINGS, openSettings))
onBeforeUnmount(() => {
  eventBus.off(EVENTS.OPEN_SETTINGS, openSettings)
  unbindShortcuts()
})
</script>

<template>
  <div
    class="flex h-screen w-screen overflow-hidden bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
  >
    <Sidebar />

    <div class="flex min-w-0 flex-1 flex-col">
      <!-- 主内容区 -->
      <main class="min-h-0 flex-1 overflow-hidden">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>

      <!-- 底部常驻播放栏 -->
      <PlayerBar @open-detail="detailOpen = true" />
    </div>

    <!-- 播放详情全屏叠层 -->
    <transition name="detail">
      <PlayerDetail v-if="detailOpen" v-model="detailOpen" />
    </transition>

    <!-- 文件夹选择弹窗 -->
    <FolderPicker v-model="folderPickerOpen" @select="startScan" />

    <!-- 导入进度弹窗 -->
    <ImportProgressDialog />

    <!-- 设置弹窗 -->
    <SettingsDialog v-model="settingsOpen" />
  </div>
</template>
