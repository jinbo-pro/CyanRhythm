<script setup>
import { computed } from 'vue'
import { usePlayerStore } from '../../stores/player.js'
import { useSettingsStore, PLAY_MODES, PLAY_MODE_INFO } from '../../stores/settings.js'
import AlbumCover from '../common/AlbumCover.vue'
import PlayModeIcon from '../common/PlayModeIcon.vue'
import { formatTime } from '../../composables/usePlayer.js'

const emit = defineEmits(['open-detail'])

const player = usePlayerStore()
const settings = useSettingsStore()

const hasSong = computed(() => !!player.currentSong)

const modeLabel = computed(() => PLAY_MODE_INFO[settings.playMode]?.label)

const volumeValue = computed(() => (settings.muted ? 0 : settings.volume))

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
</script>

<template>
  <footer
    class="flex h-20 shrink-0 items-center gap-4 border-t border-neutral-200 bg-white/90 px-4 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90"
  >
    <!-- 当前歌曲信息（可点击展开播放详情） -->
    <div
      class="flex w-60 shrink-0 cursor-pointer items-center gap-3 rounded-lg p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
      :class="{ 'cursor-default': !hasSong }"
      @click="hasSong && emit('open-detail')"
    >
      <AlbumCover :song="player.currentSong" :size="52" rounded="md" />
      <div v-if="hasSong" class="min-w-0">
        <div class="truncate text-sm font-medium">{{ player.currentSong.title }}</div>
        <div class="truncate text-xs text-neutral-400">{{ player.currentSong.artist }}</div>
      </div>
      <div v-else class="text-sm text-neutral-400">未播放</div>
    </div>

    <!-- 中间：控制 + 进度 -->
    <div class="flex flex-1 flex-col items-center gap-1">
      <div class="flex items-center gap-5">
        <el-tooltip :content="modeLabel" placement="top">
          <el-button
            text
            circle
            :type="settings.playMode === PLAY_MODES.LOOP ? 'primary' : 'default'"
            @click="cycleMode"
          >
            <el-icon :size="18"><PlayModeIcon :mode="settings.playMode" /></el-icon>
          </el-button>
        </el-tooltip>

        <el-tooltip content="上一曲" placement="top">
          <el-button text circle :disabled="!hasSong" @click="player.prev()">
            <el-icon :size="22"><DArrowLeft /></el-icon>
          </el-button>
        </el-tooltip>

        <el-button
          type="primary"
          circle
          size="large"
          :disabled="!hasSong"
          @click="player.toggle()"
        >
          <el-icon :size="20">
            <VideoPause v-if="player.isPlaying" />
            <VideoPlay v-else />
          </el-icon>
        </el-button>

        <el-tooltip content="下一曲" placement="top">
          <el-button text circle :disabled="!hasSong" @click="player.next()">
            <el-icon :size="22"><DArrowRight /></el-icon>
          </el-button>
        </el-tooltip>

        <div class="w-[18px]"></div>
      </div>

      <!-- 进度条 -->
      <div class="flex w-full max-w-2xl items-center gap-2">
        <span class="w-10 text-right text-xs tabular-nums text-neutral-400">
          {{ formatTime(player.seek) }}
        </span>
        <el-slider
          class="flex-1 player-slider"
          :model-value="player.seek"
          :min="0"
          :max="player.duration || 0"
          :step="0.1"
          :disabled="!hasSong"
          :show-tooltip="false"
          @input="onSeek"
        />
        <span class="w-10 text-xs tabular-nums text-neutral-400">
          {{ formatTime(player.duration) }}
        </span>
      </div>
    </div>

    <!-- 右侧：音量 -->
    <div class="flex w-60 shrink-0 items-center justify-end gap-2">
      <el-tooltip :content="settings.muted ? '取消静音' : '静音'" placement="top">
        <el-button text circle @click="toggleMute">
          <el-icon :size="18">
            <Mute v-if="settings.muted || volumeValue === 0" />
            <Bell v-else />
          </el-icon>
        </el-button>
      </el-tooltip>
      <el-slider
        class="w-28 player-slider"
        :model-value="volumeValue"
        :min="0"
        :max="1"
        :step="0.01"
        :show-tooltip="false"
        @input="onVolume"
      />
    </div>
  </footer>
</template>

<style scoped></style>
