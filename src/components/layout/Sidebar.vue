<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import PlaylistEditor from '../common/PlaylistEditor.vue'
import PlaylistIcon from '../common/PlaylistIcon.vue'
import EqDialog from '../common/EqDialog.vue'
import { usePlaylistStore } from '@/stores/playlist.js'
import { useSettingsStore } from '@/stores/settings.js'
import { useTheme } from '@/composables/useTheme.js'
import { useImport } from '@/composables/useImport.js'
import { eventBus, EVENTS } from '@/utils/eventBus.js'

const playlistStore = usePlaylistStore()
const settingsStore = useSettingsStore()
const router = useRouter()
const { isDark, toggle } = useTheme()
const { openManager, isScanning } = useImport()

// 弹窗状态
const editorOpen = ref(false)
const editingPlaylist = ref(null) // null = 新建模式；对象 = 编辑模式
const eqOpen = ref(false) // EQ 均衡器弹窗

const navItems = [
  { to: '/songs', name: 'songs', label: '歌曲', icon: 'Headset' },
  { to: '/albums', name: 'albums', label: '专辑', icon: 'Memo' },
  { to: '/artists', name: 'artists', label: '歌手', icon: 'User' },
  { to: '/folders', name: 'folders', label: '文件夹', icon: 'Folder' },
]

function openCreate() {
  editingPlaylist.value = null
  editorOpen.value = true
}

function openEdit(pl) {
  editingPlaylist.value = pl
  editorOpen.value = true
}

async function onSubmit({ name, sort, icon }) {
  if (editingPlaylist.value) {
    await playlistStore.update(editingPlaylist.value.id, { name, sort, icon })
  } else {
    const pl = await playlistStore.create(name, sort, icon)
    router.push(`/playlist/${pl.id}`)
  }
}

async function removePlaylist(pl) {
  await ElMessageBox.confirm(`确定删除播放列表「${pl.name}」？`, '删除确认', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  })
  await playlistStore.remove(pl.id)
  if (router.currentRoute.value.params.id === pl.id) router.push('/songs')
}

function songCount(pl) {
  return pl.songIds.length
}
</script>

<template>
  <aside
    class="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
  >
    <!-- 媒体库 -->
    <div class="px-3 py-4">
      <div class="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        媒体库
      </div>
      <RouterLink
        v-for="item in navItems"
        :key="item.name"
        :to="item.to"
        class="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-200/70 dark:text-neutral-200 dark:hover:bg-neutral-800"
        active-class="bg-itunes-blue/15 text-itunes-blue dark:bg-itunes-blue/20"
      >
        <el-icon :size="17"><component :is="item.icon" /></el-icon>
        <span>{{ item.label }}</span>
      </RouterLink>
    </div>

    <!-- 播放列表 -->
    <div class="flex min-h-0 flex-1 flex-col px-3 pb-3">
      <div class="flex items-center justify-between px-2 pb-1">
        <span class="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          播放列表
        </span>
        <el-button text circle size="small" title="新建播放列表" @click="openCreate">
          <el-icon :size="15"><Plus /></el-icon>
        </el-button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto">
        <div v-if="playlistStore.playlists.length === 0" class="px-2 py-3 text-xs text-neutral-400">
          点击 + 新建播放列表
        </div>

        <div
          v-for="pl in playlistStore.playlists"
          :key="pl.id"
          :data-playlist-id="pl.id"
          class="group flex items-center rounded-md hover:bg-neutral-200/70 dark:hover:bg-neutral-800"
        >
          <RouterLink
            :to="`/playlist/${pl.id}`"
            class="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5 text-sm text-neutral-700 dark:text-neutral-200"
            active-class="text-itunes-blue"
          >
            <PlaylistIcon :playlist="pl" :size="16" />
            <span class="truncate">{{ pl.name }}</span>
          </RouterLink>

          <div class="flex shrink-0 items-center pr-1">
            <span class="text-xs text-neutral-400 group-hover:hidden">{{ songCount(pl) }}</span>
            <template v-if="!pl.builtin">
              <el-button
                text
                size="small"
                class="!hidden !p-1 group-hover:!inline-flex"
                title="编辑"
                @click.stop="openEdit(pl)"
              >
                <el-icon :size="13"><Edit /></el-icon>
              </el-button>
              <el-button
                text
                size="small"
                class="!hidden !p-1 group-hover:!inline-flex"
                title="删除"
                @click.stop="removePlaylist(pl)"
              >
                <el-icon :size="13" color="#e5484d"><Delete /></el-icon>
              </el-button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="grid grid-cols-4 gap-3 place-items-center border-t border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <el-tooltip content="EQ 均衡器" placement="top">
        <el-button text circle @click="eqOpen = true">
          <el-icon :size="18" :color="settingsStore.eqEnabled ? '#34c759' : undefined"><Histogram /></el-icon>
        </el-button>
      </el-tooltip>
      <el-tooltip :content="isDark ? '切换到浅色' : '切换到深色'" placement="top">
        <el-button text circle @click="toggle">
          <el-icon :size="18"><Sunny v-if="isDark" /><Moon v-else /></el-icon>
        </el-button>
      </el-tooltip>
      <el-tooltip :content="isScanning ? '扫描中...' : '导入音乐'" placement="top">
        <el-button text circle :loading="isScanning" :disabled="isScanning" @click="openManager">
          <el-icon :size="18" v-if="!isScanning"><FolderAdd /></el-icon>
        </el-button>
      </el-tooltip>
      <el-tooltip content="设置" placement="top">
        <el-button text circle @click="eventBus.emit(EVENTS.OPEN_SETTINGS)">
          <el-icon :size="18"><Setting /></el-icon>
        </el-button>
      </el-tooltip>
    </div>

    <!-- 新建/编辑播放列表弹窗 -->
    <PlaylistEditor v-model="editorOpen" :playlist="editingPlaylist" @submit="onSubmit" />

    <!-- EQ 均衡器弹窗 -->
    <EqDialog v-model="eqOpen" />
  </aside>
</template>
