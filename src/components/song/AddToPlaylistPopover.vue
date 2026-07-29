<script setup>
import { ref, nextTick, watch, onBeforeUnmount } from 'vue'
import { usePlaylistStore } from '../../stores/playlist.js'
import PlaylistIcon from '../common/PlaylistIcon.vue'

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

/** 当前歌曲是否已在某播放列表中 */
function isInPlaylist(plId) {
  if (!currentSong.value) return false
  const pl = playlistStore.getPlaylist(plId)
  return !!(pl && pl.songIds.includes(currentSong.value.id))
}

/**
 * "加入购物车"式飞行动画：小球从点击位置沿抛物线飞向侧边栏对应播放列表
 * @param {number} startX 点击位置 X
 * @param {number} startY 点击位置 Y
 * @param {HTMLElement} targetEl 目标列表元素
 */
function flyToCart(startX, startY, targetEl) {
  const rect = targetEl.getBoundingClientRect()
  const endX = rect.left + rect.width / 2
  const endY = rect.top + rect.height / 2

  const size = 14
  const ball = document.createElement('div')
  ball.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${size}px`,
    `height:${size}px`,
    'border-radius:50%',
    'background:linear-gradient(135deg,#4d9bff,#2c7be5)',
    'box-shadow:0 2px 10px rgba(44,123,229,0.6)',
    'pointer-events:none',
    'z-index:9999',
    'will-change:transform,opacity',
    `transform:translate(${startX - size / 2}px,${startY - size / 2}px) scale(1)`,
  ].join(';')
  document.body.appendChild(ball)

  const duration = 600
  const startTime = performance.now()
  // 抛物线控制点：取起止中点后向上抬升，制造弧线
  const dist = Math.hypot(endX - startX, endY - startY)
  const lift = Math.min(200, dist * 0.35 + 60)
  const cx = (startX + endX) / 2
  const cy = Math.min(startY, endY) - lift

  function tick(now) {
    const p = Math.min(1, (now - startTime) / duration)
    const t = 1 - Math.pow(1 - p, 2) // ease-out
    const mt = 1 - t
    // 二次贝塞尔曲线计算坐标
    const x = mt * mt * startX + 2 * mt * t * cx + t * t * endX
    const y = mt * mt * startY + 2 * mt * t * cy + t * t * endY
    const scale = 1 - 0.55 * t // 飞行过程中逐渐缩小
    const opacity = p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2 // 末段淡出
    ball.style.transform = `translate(${x - size / 2}px,${y - size / 2}px) scale(${scale})`
    ball.style.opacity = String(opacity)
    if (p < 1) {
      requestAnimationFrame(tick)
    } else {
      ball.remove()
      pulseTarget(targetEl)
    }
  }
  requestAnimationFrame(tick)
}

/** 小球到达后，目标列表短暂高亮脉冲反馈 */
function pulseTarget(el) {
  el.animate(
    [
      { boxShadow: '0 0 0 0 rgba(44,123,229,0.5)' },
      { boxShadow: '0 0 0 6px rgba(44,123,229,0.25)', offset: 0.4 },
      { boxShadow: '0 0 0 0 rgba(44,123,229,0)' },
    ],
    { duration: 500, easing: 'ease-out' }
  )
}

/** 选择播放列表：已存在则忽略，否则飞行动画 + 添加 */
function onSelect(pl, event) {
  if (!currentSong.value) return
  if (isInPlaylist(pl.id)) return
  const startX = event.clientX
  const startY = event.clientY
  const targetEl = document.querySelector(`[data-playlist-id="${pl.id}"]`)
  playlistStore.addSong(pl.id, currentSong.value.id)
  if (targetEl) {
    flyToCart(startX, startY, targetEl)
  } else {
    // 目标不在可视区（侧边栏被折叠等），回退为文字提示
    ElMessage.success('已添加到播放列表')
  }
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
        class="flex items-center justify-between rounded px-2 py-1.5 text-sm"
        :class="
          isInPlaylist(pl.id)
            ? 'cursor-not-allowed text-neutral-300 dark:text-neutral-600'
            : 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700'
        "
        @click="onSelect(pl, $event)"
      >
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <PlaylistIcon :playlist="pl" :size="16" />
          <span class="truncate">{{ pl.name }}</span>
        </div>
        <el-icon v-if="isInPlaylist(pl.id)" :size="12" class="shrink-0"><Check /></el-icon>
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
