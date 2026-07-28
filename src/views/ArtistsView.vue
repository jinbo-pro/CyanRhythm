<script setup>
import { useRouter } from 'vue-router'
import { useLibraryStore } from '../stores/library.js'
import { useImport } from '../composables/useImport.js'
import EmptyGuide from '../components/common/EmptyGuide.vue'

const router = useRouter()
const library = useLibraryStore()
const { openImport } = useImport()

function openArtist(name) {
  router.push(`/artists/${name}`)
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="px-6 pt-3">
      <h1 class="text-2xl font-bold">歌手</h1>
      <p class="mt-1 text-sm text-neutral-400">{{ library.artists.length }} 位歌手</p>
    </div>

    <!-- 空状态 -->
    <EmptyGuide
      v-if="library.total === 0"
      icon="User"
      title="还没有歌手"
      description="导入本地音乐文件夹后此处将按歌手分类"
      @import="openImport"
    />

    <!-- 歌手列表 -->
    <div v-else class="flex-1 overflow-y-auto p-6">
      <div class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        <el-card
          v-for="artist in library.artists"
          :key="artist.name"
          shadow="hover"
          body-class="!p-3"
          class="!cursor-pointer !border-neutral-200 dark:!border-neutral-800"
          @click="openArtist(artist.name)"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-itunes-blue/80 to-purple-500/80 text-lg font-semibold text-white"
            >
              {{ artist.name.charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0">
              <div class="truncate text-sm font-medium">{{ artist.name }}</div>
              <div class="text-xs text-neutral-400">
                {{ artist.albumCount }} 张专辑 · {{ artist.songs.length }} 首
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>
