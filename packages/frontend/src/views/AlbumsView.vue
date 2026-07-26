<script setup>
import { useRouter } from 'vue-router'
import { useLibraryStore } from '../stores/library.js'
import { usePlayerStore } from '../stores/player.js'
import { useImport } from '../composables/useImport.js'
import AlbumCover from '../components/common/AlbumCover.vue'
import EmptyGuide from '../components/common/EmptyGuide.vue'

const router = useRouter()
const library = useLibraryStore()
const player = usePlayerStore()
const { openImport } = useImport()

function openAlbum(album) {
  router.push(`/albums/${album.name}`)
}

function playAlbum(album) {
  if (album.songs.length) player.playSongs(album.songs, 0)
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="px-6 pt-3">
      <h1 class="text-2xl font-bold">专辑</h1>
      <p class="mt-1 text-sm text-neutral-400">{{ library.albums.length }} 张专辑</p>
    </div>

    <!-- 空状态 -->
    <EmptyGuide
      v-if="library.total === 0"
      icon="CompactDisc"
      title="还没有专辑"
      description="导入本地音乐文件夹后此处将显示专辑封面墙"
      @import="openImport"
    />

    <!-- 专辑封面墙 -->
    <div v-else class="flex-1 overflow-y-auto p-6">
      <div class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-5">
        <div
          v-for="album in library.albums"
          :key="album.name"
          class="group cursor-pointer"
          @click="openAlbum(album)"
        >
          <div class="relative">
            <div class="shadow-md transition group-hover:shadow-lg">
              <AlbumCover :song="album.firstSong" :size="160" rounded="lg" />
            </div>
            <button
              class="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-itunes-blue text-white opacity-0 shadow-lg transition group-hover:opacity-100 hover:bg-itunes-blue-dark"
              title="播放此专辑"
              @click.stop="playAlbum(album)"
            >
              <el-icon :size="16"><VideoPlay /></el-icon>
            </button>
          </div>
          <div class="mt-2 truncate text-sm font-medium">{{ album.name }}</div>
          <div class="truncate text-xs text-neutral-400">{{ album.artist }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
