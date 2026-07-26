<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLibraryStore } from '../stores/library.js'
import { usePlayerStore } from '../stores/player.js'
import { useImport } from '../composables/useImport.js'
import { getDirName, getBaseName } from '../utils/path.js'
import SongTable from '../components/song/SongTable.vue'
import EmptyGuide from '../components/common/EmptyGuide.vue'

const route = useRoute()
const router = useRouter()
const library = useLibraryStore()
const player = usePlayerStore()
const { openImport } = useImport()

const query = ref('')

const isFolderDetail = computed(() => route.name === 'folder-detail')
const folderPath = computed(() => (isFolderDetail.value ? route.query.folder || '' : ''))

const title = computed(() => {
  if (route.name === 'album-detail') return route.params.name
  if (route.name === 'artist-detail') return route.params.name
  if (isFolderDetail.value) return getBaseName(folderPath.value) || '文件夹'
  return '所有歌曲'
})

const baseSongs = computed(() => {
  if (route.name === 'album-detail') {
    return library.songs.filter((s) => (s.album || '未知专辑') === route.params.name)
  }
  if (route.name === 'artist-detail') {
    return library.songs.filter((s) => (s.artist || '未知艺术家') === route.params.name)
  }
  if (isFolderDetail.value) {
    const fp = folderPath.value
    if (!fp) return []
    return library.songs.filter((s) => getDirName(s.fileRelPath) === fp)
  }
  return library.songs
})

const songs = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return baseSongs.value
  return baseSongs.value.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      s.album.toLowerCase().includes(q)
  )
})

function playAll() {
  if (songs.value.length) player.playSongs(songs.value, 0)
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 头部 -->
    <div class="px-6 pt-3">
      <div class="flex items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-2">
          <el-button
            v-if="isFolderDetail"
            text
            circle
            title="返回文件夹列表"
            @click="router.push('/folders')"
          >
            <el-icon><ArrowLeft /></el-icon>
          </el-button>
          <div class="min-w-0">
            <h1 class="truncate text-2xl font-bold">{{ title }}</h1>
            <p
              class="mt-1 truncate text-sm text-neutral-400"
              :title="isFolderDetail ? folderPath : undefined"
            >
              {{ isFolderDetail ? folderPath : `${baseSongs.length} 首歌曲` }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <el-input
            v-model="query"
            placeholder="搜索"
            clearable
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button type="primary" :disabled="!songs.length" @click="playAll">
            <template #icon><el-icon><VideoPlay /></el-icon></template>
            播放全部
          </el-button>
        </div>
      </div>
    </div>

    <!-- 空媒体库引导 -->
    <EmptyGuide
      v-if="library.total === 0"
      icon="Headset"
      title="媒体库是空的"
      description="导入本地音乐文件夹开始享受音乐"
      @import="openImport"
    />

    <!-- 歌曲表格（el-table-v2 虚拟滚动，容器需固定高度） -->
    <div v-else class="min-h-0 flex-1 overflow-hidden px-6 py-4">
      <SongTable :songs="songs" />
    </div>
  </div>
</template>
