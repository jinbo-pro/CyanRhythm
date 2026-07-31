<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { buildWaveform } from '@/composables/useWaveform.js'

/**
 * 波形可视化进度条（B 站风格高低潮波形热力图）
 *
 * - 波形高度代表瞬时响度（RMS），直观区分低潮 / 副歌高潮
 * - 已播放 / 未播放区域底色区分，白色游标标记当前播放位置
 * - 点击 / 拖拽波形任意位置可跳转播放
 * - 波形数据预渲染并缓存到 IndexedDB，首次打开可能需解码，之后即时呈现
 */
const props = defineProps({
  song: { type: Object, default: null },
  currentTime: { type: Number, default: 0 },
  duration: { type: Number, default: 0 },
})
const emit = defineEmits(['seek'])

const canvasRef = ref(null)
const peaks = ref(null) // Float32Array 响度数据
const loading = ref(false)
const loadError = ref('')

let ctx = null
let resizeObserver = null
let rafId = 0
let cssW = 0
let cssH = 0
let dragging = false

/** 渲染配色（适配深色背景的播放详情页） */
const COLORS = {
  played: 'rgba(255, 255, 255, 0.85)',
  unplayed: 'rgba(255, 255, 255, 0.22)',
  cursor: 'rgba(255, 255, 255, 0.95)',
}

/** 歌曲切换：解码 / 读缓存获取波形 */
watch(
  () => props.song?.id,
  async (songId) => {
    if (!props.song) {
      peaks.value = null
      return
    }
    loading.value = true
    loadError.value = ''
    try {
      const { peaks: data } = await buildWaveform(props.song)
      // 防止切换过快导致结果错位
      if (props.song?.id === songId) peaks.value = data
    } catch (e) {
      console.error('[WaveformBar] 波形生成失败:', e)
      loadError.value = e?.message || '波形生成失败'
      peaks.value = null
    } finally {
      if (props.song?.id === songId) loading.value = false
    }
  },
  { immediate: true }
)

/**
 * 持续重绘循环：与 AudioVisualizer 一致采用 RAF。
 * 保证加载骨架动画流畅、游标随播放进度实时跟随，无需依赖 watch 触发时机。
 */
function startLoop() {
  const tick = () => {
    render()
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

onMounted(async () => {
  await nextTick()
  if (canvasRef.value) {
    ctx = canvasRef.value.getContext('2d')
    resize()
    bindResize()
    startLoop()
  }
})

onBeforeUnmount(() => {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

/** 按容器尺寸重设 canvas（含 dpr 缩放） */
function resize() {
  const canvas = canvasRef.value
  if (!canvas) return
  const parent = canvas.parentElement
  const dpr = window.devicePixelRatio || 1
  cssW = parent.clientWidth || 0
  cssH = parent.clientHeight || 0
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
  canvas.style.width = cssW + 'px'
  canvas.style.height = cssH + 'px'
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function bindResize() {
  const canvas = canvasRef.value
  if (!canvas) return
  resizeObserver = new ResizeObserver(() => resize())
  resizeObserver.observe(canvas.parentElement)
}

/** 绘制波形热力图 */
function render() {
  if (!ctx || cssW <= 0) return
  ctx.clearRect(0, 0, cssW, cssH)

  const cy = cssH / 2
  const maxH = Math.max(4, cssH - 4)
  const progress = props.duration > 0 ? Math.min(1, props.currentTime / props.duration) : 0
  const progressX = progress * cssW

  // 加载中：绘制骨架占位
  if (loading.value) {
    drawSkeleton(cy)
    return
  }

  const data = peaks.value
  // 无数据（生成失败等）：绘制可拖拽的平直线
  if (!data || !data.length) {
    ctx.strokeStyle = COLORS.unplayed
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0, cy)
    ctx.lineTo(cssW, cy)
    ctx.stroke()
  } else {
    // 屏幕可见柱数：每柱占 stride 像素（含间距）
    const stride = 3
    const barW = 2
    const visibleBars = Math.max(1, Math.floor(cssW / stride))
    const bucketsPerBar = data.length / visibleBars

    ctx.lineWidth = barW
    ctx.lineCap = 'round'

    for (let i = 0; i < visibleBars; i++) {
      // 聚合该柱覆盖的桶：取最大响度
      const bStart = Math.floor(i * bucketsPerBar)
      const bEnd = Math.floor((i + 1) * bucketsPerBar)
      let val = 0
      for (let b = bStart; b < bEnd; b++) if (data[b] > val) val = data[b]
      const barH = Math.max(2, val * maxH)
      const x = i * stride + barW / 2
      ctx.strokeStyle = x <= progressX ? COLORS.played : COLORS.unplayed
      ctx.beginPath()
      ctx.moveTo(x, cy - barH / 2)
      ctx.lineTo(x, cy + barH / 2)
      ctx.stroke()
    }
  }

  // 白色游标
  ctx.fillStyle = COLORS.cursor
  ctx.fillRect(progressX - 1, 0, 2, cssH)
}

/** 加载骨架：缓慢起伏的稀疏柱 */
function drawSkeleton(cy) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  const stride = 5
  const t = Date.now() / 600
  for (let x = stride / 2; x < cssW; x += stride) {
    const h = (Math.sin(x * 0.3 + t) * 0.5 + 0.5) * (cssH * 0.3) + 2
    ctx.beginPath()
    ctx.moveTo(x, cy - h / 2)
    ctx.lineTo(x, cy + h / 2)
    ctx.stroke()
  }
}

// ===== 拖拽 / 点击跳转 =====

/** 根据指针横坐标换算播放时间并触发跳转 */
function seekFromEvent(e) {
  const canvas = canvasRef.value
  if (!canvas || !props.duration) return
  const rect = canvas.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
  emit('seek', ratio * props.duration)
}

function onPointerDown(e) {
  if (!props.song) return
  dragging = true
  canvasRef.value.setPointerCapture?.(e.pointerId)
  seekFromEvent(e)
}
function onPointerMove(e) {
  if (!dragging) return
  seekFromEvent(e)
}
function onPointerUp(e) {
  if (!dragging) return
  dragging = false
  canvasRef.value?.releasePointerCapture?.(e.pointerId)
}
</script>

<template>
  <div
    class="waveform-bar relative h-10 w-full cursor-pointer select-none"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <canvas ref="canvasRef" class="block h-full w-full"></canvas>
    <span
      v-if="loadError && !loading"
      class="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-white/40"
    >
      波形不可用
    </span>
  </div>
</template>

<style scoped>
.waveform-bar {
  touch-action: none; /* 阻止触摸滚动，确保拖拽跳转流畅 */
}
</style>
