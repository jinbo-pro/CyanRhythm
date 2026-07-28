<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { usePlayerStore } from '../../stores/player.js'
import { useSettingsStore, PLAY_MODES, PLAY_MODE_INFO } from '../../stores/settings.js'
import { AudioVisualizer } from './AudioVisualizer.js'
import { connectAudioNode } from '../../composables/useAudioAnalyser.js'
import { coverUrl } from '../../api/index.js'
import { formatTime } from '../../composables/usePlayer.js'
import PlayModeIcon from '../common/PlayModeIcon.vue'
import LyricsPanel from './LyricsPanel.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const player = usePlayerStore()
const settings = useSettingsStore()

const canvasRef = ref(null)
let visualizer = null

const hasSong = computed(() => !!player.currentSong)

// 封面源：优先使用内嵌 base64，旧数据无 cover 则异步从音频文件提取
const coverSrc = ref('')
watch(
  () => player.currentSong?.id,
  async () => {
    if (!player.currentSong) {
      coverSrc.value = ''
      return
    }
    if (player.currentSong.cover) {
      coverSrc.value = player.currentSong.cover
      return
    }
    if (player.currentSong.hasCover) {
      try {
        coverSrc.value = (await coverUrl(player.currentSong.fileRelPath)) || ''
      } catch {
        coverSrc.value = ''
      }
    } else {
      coverSrc.value = ''
    }
  },
  { immediate: true }
)

const modeLabel = computed(() => PLAY_MODE_INFO[settings.playMode]?.label)
const volumeValue = computed(() => (settings.muted ? 0 : settings.volume))

function close() {
  emit('update:modelValue', false)
}

/** ESC 键关闭 */
function onKeydown(e) {
  if (e.key === 'Escape') close()
}

function onSeek(val) {
  player.seekTo(val)
}
function onVolume(val) {
  settings.setVolume(val)
  player.syncVolume()
}
function toggleMute() {
  settings.toggleMute()
  player.syncMute()
}
function cycleMode() {
  settings.cyclePlayMode()
}

/** 将当前 Howl 的 audio 元素接入 WebAudio 分析器 */
function connectAnalyser() {
  const node = player.getCurrentAudioNode()
  if (node) connectAudioNode(node)
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  await nextTick()
  if (canvasRef.value) {
    visualizer = new AudioVisualizer(canvasRef.value, {
      discRadius: 110,
      maxBarLen: 65,
      barCount: 64,
    })
    try {
      await visualizer.init()
      visualizer.updateCover(coverSrc.value)
      visualizer.setPlaying(player.isPlaying)
    } catch (e) {
      console.error('[PlayerDetail] 可视化初始化失败:', e)
    }
  }
  connectAnalyser()
})

// 歌曲切换：重新连接分析器（新 Howl 产生新 audio 元素）
watch(
  () => player.currentSong?.id,
  () => {
    nextTick(() => connectAnalyser())
  }
)

// 封面加载完成后更新可视化封面（coverSrc 为异步加载）
watch(coverSrc, (val) => {
  if (visualizer) visualizer.updateCover(val)
})

// 播放/暂停状态变化：控制唱片旋转
watch(
  () => player.isPlaying,
  (val) => {
    if (visualizer) visualizer.setPlaying(val)
  }
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (visualizer) {
    visualizer.destroy()
    visualizer = null
  }
})
</script>

<template>
  <div class="fixed inset-0 z-[2000] flex flex-col overflow-hidden">
    <!-- 背景：模糊封面 + 暗色渐变 -->
    <div class="absolute inset-0 overflow-hidden">
      <img
        v-if="coverSrc"
        :src="coverSrc"
        class="absolute -top-[20%] -left-[20%] h-[140%] w-[140%] object-cover [filter:blur(80px)_saturate(1.8)_brightness(0.45)]"
        alt=""
      />
      <div
        class="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.65)_50%,rgba(0,0,0,0.75)_100%)]"
      ></div>
    </div>

    <!-- 顶栏 -->
    <header class="relative z-[2] flex h-14 shrink-0 items-center justify-between px-4">
      <el-button class="close-btn" text circle @click="close">
        <el-icon :size="22"><ArrowDownBold /></el-icon>
      </el-button>
      <div class="flex-1 text-center">
        <span class="text-[13px] tracking-[0.05em] text-white/50">正在播放</span>
      </div>
      <div class="w-[42px]"></div>
    </header>

    <!-- 主体 -->
    <main class="relative z-[2] flex min-h-0 flex-1">
      <!-- 左侧：可视化 + 歌曲信息 -->
      <section class="flex min-w-0 flex-1 flex-col items-center justify-center p-4">
        <div ref="canvasRef" class="flex min-h-[280px] w-full flex-1 items-center justify-center"></div>
        <div v-if="hasSong" class="mt-4 shrink-0 text-center">
          <h2
            class="m-0 max-w-[480px] overflow-hidden text-ellipsis whitespace-nowrap text-[22px] font-semibold text-white"
          >
            {{ player.currentSong.title }}
          </h2>
          <p class="mt-1 text-sm text-white/55">{{ player.currentSong.artist }}</p>
        </div>
      </section>

      <!-- 右侧：歌词 -->
      <aside
        class="hidden w-[340px] shrink-0 flex-col border-l border-white/10 bg-black/20 min-[900px]:flex"
      >
        <LyricsPanel @seek="onSeek" />
      </aside>
    </main>

    <!-- 底部控制栏 -->
    <footer
      class="relative z-[2] flex h-24 shrink-0 items-center gap-4 border-t border-white/10 bg-black/35 px-6 backdrop-blur-md"
    >
      <!-- 左：占位（与标题区对齐） -->
      <div class="w-[200px] shrink-0"></div>

      <!-- 中：播放控制 + 进度 -->
      <div class="flex flex-1 flex-col items-center gap-1.5">
        <div class="flex items-center gap-5">
          <el-tooltip :content="modeLabel" placement="top">
            <el-button
              text
              circle
              class="ctrl-btn"
              :class="{ 'is-active': settings.playMode === PLAY_MODES.LOOP }"
              :disabled="!hasSong"
              @click="cycleMode"
            >
              <el-icon :size="18"><PlayModeIcon :mode="settings.playMode" /></el-icon>
            </el-button>
          </el-tooltip>

          <el-tooltip content="上一曲" placement="top">
            <el-button text circle class="ctrl-btn" :disabled="!hasSong" @click="player.prev()">
              <el-icon :size="22"><DArrowLeft /></el-icon>
            </el-button>
          </el-tooltip>

          <el-button
            type="primary"
            circle
            :disabled="!hasSong"
            class="!h-12 !w-12"
            @click="player.toggle()"
          >
            <el-icon :size="22">
              <VideoPause v-if="player.isPlaying" />
              <VideoPlay v-else />
            </el-icon>
          </el-button>

          <el-tooltip content="下一曲" placement="top">
            <el-button text circle class="ctrl-btn" :disabled="!hasSong" @click="player.next()">
              <el-icon :size="22"><DArrowRight /></el-icon>
            </el-button>
          </el-tooltip>
        </div>

        <!-- 进度条 -->
        <div class="flex w-full max-w-[640px] items-center gap-3">
          <span class="w-10 shrink-0 text-center text-xs tabular-nums text-white/50">
            {{ formatTime(player.seek) }}
          </span>
          <el-slider
            class="detail-slider flex-1"
            :model-value="player.seek"
            :min="0"
            :max="player.duration || 0"
            :step="0.1"
            :disabled="!hasSong"
            :show-tooltip="false"
            @input="onSeek"
          />
          <span class="w-10 shrink-0 text-left text-xs tabular-nums text-white/50">
            {{ formatTime(player.duration) }}
          </span>
        </div>
      </div>

      <!-- 右：音量 -->
      <div class="flex w-[200px] shrink-0 items-center justify-end gap-2">
        <el-tooltip :content="settings.muted ? '取消静音' : '静音'" placement="top">
          <el-button text circle class="ctrl-btn" @click="toggleMute">
            <el-icon :size="18">
              <Mute v-if="settings.muted || volumeValue === 0" />
              <Bell v-else />
            </el-icon>
          </el-button>
        </el-tooltip>
        <el-slider
          class="detail-slider w-24"
          :model-value="volumeValue"
          :min="0"
          :max="1"
          :step="0.01"
          :show-tooltip="false"
          @input="onVolume"
        />
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* Element Plus 按钮颜色覆盖（需 !important 穿透组件内部样式） */
.close-btn {
  color: rgba(255, 255, 255, 0.8) !important;
}
.close-btn:hover {
  color: #fff !important;
}
.ctrl-btn {
  color: rgba(255, 255, 255, 0.7) !important;
}
.ctrl-btn:hover {
  color: #fff !important;
}
.ctrl-btn.is-active {
  color: var(--color-itunes-blue) !important;
}

/* 覆盖 el-slider 在深色背景下的样式 */
.detail-slider :deep(.el-slider__runway) {
  background: rgba(255, 255, 255, 0.15);
}
.detail-slider :deep(.el-slider__bar) {
  background: rgba(255, 255, 255, 0.6);
}
.detail-slider :deep(.el-slider__button) {
  border-color: rgba(255, 255, 255, 0.8);
  background: #fff;
}
</style>
