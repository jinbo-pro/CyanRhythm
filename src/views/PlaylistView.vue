<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlaylistStore } from '../stores/playlist.js'
import { useLibraryStore } from '../stores/library.js'
import { usePlayerStore } from '../stores/player.js'
import SongTable from '../components/song/SongTable.vue'

const route = useRoute()
const router = useRouter()
const playlistStore = usePlaylistStore()
const library = useLibraryStore()
const player = usePlayerStore()

const playlist = computed(() => playlistStore.getPlaylist(route.params.id))

const songs = computed(() => {
  if (!playlist.value) return []
  return playlist.value.songIds
    .map((id) => library.getSongById(id))
    .filter(Boolean)
})

function playAll() {
  if (songs.value.length) player.playSongs(songs.value, 0)
}

async function removeSong(song) {
  await playlistStore.removeSong(playlist.value.id, song.id)
}

async function removePlaylist() {
  if (!playlist.value) return
  await ElMessageBox.confirm(
    `确定删除播放列表「${playlist.value.name}」？`,
    '删除确认',
    { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
  )
  await playlistStore.remove(playlist.value.id)
  router.push('/songs')
}
</script>

<template>
  <div class="flex h-full flex-col">
    <template v-if="playlist">
      <div class="px-6 pt-3">
        <div class="flex items-center gap-4">
          <div
            class="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-itunes-blue/70 to-purple-500/70 text-white shadow-lg"
          >
            <el-icon :size="48">
              <el-icon v-if="playlist.builtin" class="!text-red-500"><StarFilled /></el-icon>
              <List v-else />
            </el-icon>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-medium uppercase tracking-wide text-neutral-400">播放列表</p>
            <h1 class="truncate text-2xl font-bold">{{ playlist.name }}</h1>
            <p class="mt-1 text-sm text-neutral-400">{{ songs.length }} 首歌曲</p>
            <div class="mt-3 flex gap-2">
              <el-button type="primary" :disabled="!songs.length" @click="playAll">
                <template #icon><el-icon><VideoPlay /></el-icon></template>
                播放全部
              </el-button>
              <el-button v-if="!playlist.builtin" @click="removePlaylist">
                <template #icon><el-icon><Delete /></el-icon></template>
                删除列表
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- el-table-v2 虚拟滚动，容器需固定高度 -->
      <div class="min-h-0 flex-1 overflow-hidden px-6 py-4">
        <SongTable :songs="songs" removable @remove="removeSong" />
      </div>
    </template>

    <el-empty v-else description="播放列表不存在" :image-size="120" class="flex-1 justify-center">
      <el-button type="primary" @click="router.push('/songs')">返回歌曲库</el-button>
    </el-empty>
  </div>
</template>
