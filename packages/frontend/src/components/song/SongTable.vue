<script setup lang="jsx">
import { computed, ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { ElButton, ElIcon } from 'element-plus'
import { Microphone, Histogram, Delete, Plus, StarFilled, Star } from '@element-plus/icons-vue'
import AlbumCover from '../common/AlbumCover.vue'
import AddToPlaylistPopover from './AddToPlaylistPopover.vue'
import { usePlayerStore } from '../../stores/player.js'
import { useSettingsStore } from '../../stores/settings.js'
import { usePlaylistStore } from '../../stores/playlist.js'
import { formatTime } from '../../composables/usePlayer.js'

const props = defineProps({
  songs: { type: Array, default: () => [] },
  removable: { type: Boolean, default: false },
})

const settings = useSettingsStore()

const emit = defineEmits(['remove'])

const player = usePlayerStore()
const playlistStore = usePlaylistStore()

/** 单例弹层，替代每行一个 el-dropdown */
const addMenuRef = ref(null)

const isCurrent = (song) => player.currentSong && player.currentSong.id === song.id

function rowClass({ rowData }) {
  return isCurrent(rowData) ? 'current-song' : ''
}

// 行点击防抖（250ms）：规避虚拟滚动下的误触与快速双击切歌
const handleRowClick = useDebounceFn(({ rowData }) => {
  if (isCurrent(rowData)) {
    // 当前歌曲：正在播放则暂停，处于暂停则继续播放
    player.isPlaying ? player.pause() : player.play()
  } else {
    // 非当前歌曲：切到该歌曲并开始播放
    const index = props.songs.findIndex((s) => s.id === rowData.id)
    if (index >= 0) player.playSongs(props.songs, index)
  }
}, 250)

const rowEventHandlers = {
  onClick: handleRowClick,
}

/** el-table-v2 列定义（JSX 渲染，虚拟滚动下只渲染可视区行） */
const columns = computed(() => {
  // 引用收藏列表的 songIds，使本 computed 依赖收藏状态：
  // 收藏/取消后 columns 重算，行内爱心图标即时刷新
  const favSongIds = playlistStore.favorites ? playlistStore.favorites.songIds : []
  const cols = []

  // 序号 / 播放指示
  if (settings.showIndex) {
    cols.push({
      key: 'index',
      width: 56,
      align: 'center',
      headerCellRenderer: () => (
        <ElIcon><Histogram /></ElIcon>
      ),
      cellRenderer: ({ rowData, rowIndex }) =>
        isCurrent(rowData) && player.isPlaying ? (
          <ElIcon color="#2c7be5" size={14}><Microphone /></ElIcon>
        ) : (
          <span class="text-neutral-400">{rowIndex + 1}</span>
        ),
    })
  }

  // 标题（封面 + 歌名 / 艺术家）
  cols.push({
    key: 'title',
    title: '标题',
    width: 220,
    flexGrow: 2,
    cellRenderer: ({ rowData }) => (
      <div class="flex w-full min-w-0 items-center gap-3">
        {settings.showCover ? <AlbumCover song={rowData} size={36} rounded="md" /> : null}
        <div class="min-w-0">
          <div class="truncate font-medium">{rowData.title}</div>
          <div class="truncate text-xs text-neutral-400">{rowData.artist}</div>
        </div>
      </div>
    ),
  })

  // 专辑
  if (settings.showAlbum) {
    cols.push({
      key: 'album',
      dataKey: 'album',
      title: '专辑',
      width: 160,
      flexGrow: 1,
      cellRenderer: ({ cellData }) => <span class="truncate">{cellData}</span>,
    })
  }

  // 时长
  cols.push({
    key: 'duration',
    title: '时长',
    width: 80,
    align: 'right',
    cellRenderer: ({ rowData }) => (
      <span class="tabular-nums text-neutral-400">{formatTime(rowData.duration)}</span>
    ),
  })

  // 收藏：点击爱心切换“我的收藏”（实心=已收藏，空心=未收藏）
  cols.push({
    key: 'favorite',
    width: 40,
    align: 'center',
    cellRenderer: ({ rowData }) => {
      const active = favSongIds.includes(rowData.id)
      return (
        <ElButton
          text
          size="small"
          class={active ? '!text-red-500' : '!text-neutral-500 hover:!text-red-500'}
          title={active ? '取消收藏' : '添加到我的收藏'}
          onClick={(e) => {
            e.stopPropagation()
            playlistStore.toggleFavorite(rowData.id)
          }}
        >
        {
          active ? (     
            <ElIcon><StarFilled /></ElIcon>
          ) : (
            <ElIcon><Star /></ElIcon>
          )
        }
        </ElButton>
      )
    },
  })

  // 操作：移除 / 添加到播放列表（弹层为表格级单例）
  cols.push({
    key: 'actions',
    width: 56,
    align: 'center',
    cellRenderer: ({ rowData }) =>
      props.removable ? (
        <ElButton
          size="small"
          text
          type="danger"
          onClick={(e) => {
            e.stopPropagation()
            emit('remove', rowData)
          }}
        >
          <ElIcon><Delete /></ElIcon>
        </ElButton>
      ) : (
        <ElButton
          size="small"
          text
          onClick={(e) => {
            e.stopPropagation()
            addMenuRef.value && addMenuRef.value.open(rowData, e.currentTarget)
          }}
        >
          <ElIcon><Plus /></ElIcon>
        </ElButton>
      ),
  })

  return cols
})
</script>

<template>
  <div class="h-full w-full">
    <el-auto-resizer>
      <template #default="{ height, width }">
        <el-table-v2
          :columns="columns"
          :data="songs"
          :width="width"
          :height="height"
          :row-height="54"
          :row-class="rowClass"
          :row-event-handlers="rowEventHandlers"
        >
          <template #empty>
            <div class="flex h-full items-center justify-center">
              <el-empty description="暂无歌曲" :image-size="80" />
            </div>
          </template>
        </el-table-v2>
      </template>
    </el-auto-resizer>

    <!-- 单例“添加到播放列表”弹层 -->
    <AddToPlaylistPopover ref="addMenuRef" />
  </div>
</template>

<style scoped>
:deep(.current-song) {
  color: #2c7be5;
}
:deep(.current-song .font-medium) {
  color: #2c7be5;
}
</style>
