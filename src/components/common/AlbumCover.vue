<script setup>
import { ref, watch, computed } from 'vue'
import { coverUrl } from '../../api/index.js'

const props = defineProps({
  song: { type: Object, default: null },
  size: { type: [Number, String], default: 48 },
  rounded: { type: String, default: 'md' }, // sm | md | lg | full
})

const failed = ref(false)
const fallbackSrc = ref('')

// 优先使用内嵌的 base64 封面（新扫描数据），
// 旧数据无 cover 字段则异步从音频文件提取
const src = computed(() => {
  if (!props.song) return ''
  if (props.song.cover) return props.song.cover
  return fallbackSrc.value
})

// 歌曲切换时重置状态并异步加载封面（仅旧数据需要）
watch(
  () => props.song && props.song.id,
  async (newId) => {
    failed.value = false
    fallbackSrc.value = ''
    if (!props.song || props.song.cover || !props.song.hasCover) return
    try {
      fallbackSrc.value = (await coverUrl(props.song.fileRelPath)) || ''
    } catch {
      fallbackSrc.value = ''
    }
  },
  { immediate: true }
)

const radiusClass = computed(
  () =>
    ({
      sm: 'rounded',
      md: 'rounded-md',
      lg: 'rounded-lg',
      full: 'rounded-full',
    }[props.rounded] || 'rounded-md')
)
</script>

<template>
  <div
    class="flex items-center justify-center overflow-hidden bg-neutral-200 text-neutral-400 dark:bg-neutral-700 dark:text-neutral-500"
    :class="radiusClass"
    :style="{ width: typeof size === 'number' ? size + 'px' : size, height: typeof size === 'number' ? size + 'px' : size }"
  >
    <img
      v-if="src && !failed"
      :src="src"
      alt="cover"
      class="h-full w-full object-cover"
      loading="lazy"
      @error="failed = true"
    />
    <el-icon v-else :size="Number(size) * 0.45"><Headset /></el-icon>
  </div>
</template>
