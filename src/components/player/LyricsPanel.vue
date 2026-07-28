<script setup>
import { ref, watch, nextTick } from 'vue'
import { useLyrics } from '../../composables/useLyrics.js'

const {
  lines,
  plainText,
  loading,
  source,
  hasSynced,
  hasAnyLyrics,
  activeIndex,
  offset,
  adjustOffset,
} = useLyrics()

const viewportRef = ref(null)
const innerRef = ref(null)
const itemRefs = ref([])

// 来源标签映射
const SOURCE_LABELS = {
  embedded: '内嵌歌词',
  file: '本地文件',
  online: '在线匹配',
  none: '',
}

// 当前行变化 → 平滑滚动居中
watch(
  activeIndex,
  async (idx) => {
    await nextTick()
    if (idx < 0 || !itemRefs.value[idx] || !viewportRef.value) return
    const item = itemRefs.value[idx]
    const viewport = viewportRef.value
    // 计算使当前行居中所需的 scrollTop
    const target =
      item.offsetTop - viewport.clientHeight / 2 + item.clientHeight / 2
    viewport.scrollTo({ top: target, behavior: 'smooth' })
  },
  { flush: 'post' }
)

// 歌词切换时重置滚动位置
watch(
  () => lines.value,
  () => {
    nextTick(() => {
      if (viewportRef.value) viewportRef.value.scrollTop = 0
    })
  }
)

// 偏移显示（秒）
const offsetDisplay = (ms) => {
  const sec = ms / 1000
  return sec > 0 ? `+${sec.toFixed(1)}s` : `${sec.toFixed(1)}s`
}

/** 根据距当前行的距离返回高亮等级（越近越亮） */
function lineClass(idx) {
  const dist = Math.abs(idx - activeIndex.value)
  if (dist === 0) return 'lyric-active'
  if (dist === 1) return 'lyric-near'
  if (dist === 2) return 'lyric-mid'
  return 'lyric-far'
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 歌词区 -->
    <div
      ref="viewportRef"
      class="lyrics-viewport flex-1 overflow-hidden px-2"
    >
      <!-- 加载中 -->
      <div
        v-if="loading"
        class="flex h-full flex-col items-center justify-center gap-2"
      >
        <el-icon :size="32" class="animate-spin text-white/30"><Loading /></el-icon>
        <p class="text-sm text-white/40">歌词加载中…</p>
      </div>

      <!-- 无歌词 -->
      <div
        v-else-if="!hasAnyLyrics"
        class="flex h-full flex-col items-center justify-center gap-2 p-10"
      >
        <el-icon :size="56" class="mb-3 text-white/20"><Reading /></el-icon>
        <p class="text-lg font-medium text-white/50">暂无歌词</p>
        <p class="text-[13px] text-white/30">未找到匹配的歌词来源</p>
      </div>

      <!-- 同步歌词 -->
      <div
        v-else-if="hasSynced"
        ref="innerRef"
        class="flex flex-col items-center py-[40%]"
      >
        <p
          v-for="(line, idx) in lines"
          :key="idx"
          :ref="
            (el) => {
              if (el) itemRefs[idx] = el
            }
          "
          class="lyric-line max-w-full cursor-pointer px-2 text-center leading-[2.2]"
          :class="lineClass(idx)"
          @click="$emit('seek', line.time)"
        >
          {{ line.text || '♪' }}
        </p>
      </div>

      <!-- 纯文本歌词 -->
      <div v-else class="h-full overflow-y-auto py-8">
        <pre class="whitespace-pre-wrap px-6 text-center text-[15px] leading-[2] text-white/60">{{ plainText }}</pre>
      </div>
    </div>

    <!-- 底部：来源标签 + 偏移控制 -->
    <div
      v-if="hasAnyLyrics && !loading"
      class="flex h-10 shrink-0 items-center justify-between border-t border-white/10 px-4"
    >
      <span class="text-[11px] text-white/30">{{ SOURCE_LABELS[source] || '' }}</span>
      <div v-if="hasSynced" class="flex items-center gap-2">
        <el-button
          text
          size="small"
          class="!text-white/50 hover:!text-white"
          @click="adjustOffset(-500)"
        >
          <el-icon><Minus /></el-icon>
        </el-button>
        <span class="w-12 text-center text-xs tabular-nums text-white/50">
          {{ offsetDisplay(offset) }}
        </span>
        <el-button
          text
          size="small"
          class="!text-white/50 hover:!text-white"
          @click="adjustOffset(500)"
        >
          <el-icon><Plus /></el-icon>
        </el-button>
        <el-button
          v-if="offset !== 0"
          text
          size="small"
          class="!text-white/40 hover:!text-white"
          @click="adjustOffset(-offset)"
        >
          重置
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 隐藏滚动条但保留滚动功能 */
.lyrics-viewport::-webkit-scrollbar {
  width: 0;
}

/* 歌词行通用样式 */
.lyric-line {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.25);
  transition: color 0.45s ease, font-size 0.45s ease, transform 0.45s ease,
    text-shadow 0.45s ease, opacity 0.45s ease;
}

/* 当前播放行 */
.lyric-active {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  transform: scale(1.06);
  text-shadow: 0 0 24px rgba(255, 255, 255, 0.35);
}

/* 紧邻当前行 */
.lyric-near {
  color: rgba(255, 255, 255, 0.78);
}

/* 中等距离 */
.lyric-mid {
  color: rgba(255, 255, 255, 0.45);
}

/* 远处行 */
.lyric-far {
  color: rgba(255, 255, 255, 0.22);
}

/* 非当前行 hover 提亮 */
.lyric-near:hover,
.lyric-mid:hover,
.lyric-far:hover {
  color: rgba(255, 255, 255, 0.65);
}
</style>
