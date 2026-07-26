<script setup>
import { ref, nextTick, watch, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { usePlaylistStore } from '../../stores/playlist.js'

/**
 * 单例“添加到播放列表”弹层。
 * 之前每行都渲染一个 el-dropdown，歌曲多时会产生大量 popper 实例拖慢渲染；
 * 现在整个表格只渲染这一个组件，通过 virtual-ref 定位到被点击的按钮。
 */
const playlistStore = usePlaylistStore()

const visible = ref(false)
const triggerRef = ref(null)
const contentRef = ref(null)
const currentSong = ref(null)

/** 由行内按钮调用：open(song, buttonEl) */
function open(song, triggerEl) {
  currentSong.value = song
  triggerRef.value = triggerEl
  if (visible.value) {
    // 切换触发元素时先关再开，强制 popper 重新定位
    visible.value = false
    nextTick(() => {
      visible.value = true
    })
  } else {
    visible.value = true
  }
}

function close() {
  visible.value = false
  currentSong.value = null
}

async function addTo(playlistId) {
  if (!currentSong.value) return
  await playlistStore.addSong(playlistId, currentSong.value.id)
  ElMessage.success('已添加到播放列表')
  close()
}

/** 点击弹层外部或滚动时关闭 */
function onDocClick(e) {
  if (contentRef.value && contentRef.value.contains(e.target)) return
  close()
}
function onScroll() {
  close()
}

watch(visible, (v) => {
  if (v) {
    document.addEventListener('click', onDocClick, true)
    window.addEventListener('scroll', onScroll, true)
  } else {
    document.removeEventListener('click', onDocClick, true)
    window.removeEventListener('scroll', onScroll, true)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick, true)
  window.removeEventListener('scroll', onScroll, true)
})

defineExpose({ open })
</script>

<template>
  <el-popover
    :visible="visible"
    :virtual-ref="triggerRef"
    virtual-triggering
    placement="bottom-end"
    :width="180"
    :show-arrow="false"
    popper-class="!p-1"
  >
    <div ref="contentRef">
      <div class="px-2 py-1 text-xs text-neutral-400">添加到播放列表</div>
      <div
        v-for="pl in playlistStore.playlists"
        :key="pl.id"
        class="cursor-pointer truncate rounded px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
        @click="addTo(pl.id)"
      >
        {{ pl.name }}
      </div>
      <div
        v-if="playlistStore.playlists.length === 0"
        class="px-2 py-1.5 text-sm text-neutral-400"
      >
        暂无播放列表
      </div>
    </div>
  </el-popover>
</template>
