<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useLibraryStore } from '../stores/library.js'
import { usePlayerStore } from '../stores/player.js'
import { useImport } from '../composables/useImport.js'
import EmptyGuide from '../components/common/EmptyGuide.vue'

const router = useRouter()
const library = useLibraryStore()
const player = usePlayerStore()
const { openImport } = useImport()

/** 按文件夹名排序，便于查找 */
const folders = computed(() =>
  [...library.folders].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
)

function openFolder(folder) {
  router.push({ name: 'folder-detail', query: { folder: folder.path } })
}

function playFolder(folder) {
  if (folder.songs.length) player.playSongs(folder.songs, 0)
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="px-6 pt-3">
      <h1 class="text-2xl font-bold">文件夹</h1>
      <p class="mt-1 text-sm text-neutral-400">{{ folders.length }} 个文件夹</p>
    </div>

    <!-- 空状态 -->
    <EmptyGuide
      v-if="library.total === 0"
      icon="Folder"
      title="还没有文件夹"
      description="导入本地音乐文件夹后此处将按目录结构分类"
      @import="openImport"
    />

    <!-- 文件夹列表 -->
    <div v-else class="flex-1 overflow-y-auto p-6">
      <div class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
        <el-card
          v-for="folder in folders"
          :key="folder.path"
          shadow="hover"
          body-class="!p-3"
          class="group !cursor-pointer !border-neutral-200 dark:!border-neutral-800"
          @click="openFolder(folder)"
        >
          <div class="flex items-center gap-3">
            <div
              class="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400/80 to-orange-500/80 text-white"
            >
              <el-icon :size="22"><Folder /></el-icon>
              <button
                class="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-itunes-blue text-white opacity-0 shadow transition group-hover:opacity-100 hover:bg-itunes-blue-dark"
                title="播放此文件夹"
                @click.stop="playFolder(folder)"
              >
                <el-icon :size="13"><VideoPlay /></el-icon>
              </button>
            </div>
            <div class="min-w-0">
              <div class="truncate text-sm font-medium">{{ folder.name }}</div>
              <div class="truncate text-xs text-neutral-400">
                {{ folder.songs.length }} 首
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>
