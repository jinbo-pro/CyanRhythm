<script setup>
import { PLAY_MODES } from '../../stores/settings.js'
import IconSequence from '../../assets/icons/play-sequence.svg'
import IconLoop from '../../assets/icons/play-loop.svg'
import IconShuffle from '../../assets/icons/play-shuffle.svg'

defineProps({
  mode: { type: String, required: true },
})

// 播放模式 → 图标组件映射
const ICON_MAP = {
  [PLAY_MODES.SEQUENCE]: IconSequence,
  [PLAY_MODES.LOOP]: IconLoop,
  [PLAY_MODES.SHUFFLE]: IconShuffle,
}
</script>

<template>
  <component :is="ICON_MAP[mode]" />
</template>
