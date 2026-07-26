<script setup>
import { computed, ref, watch } from 'vue'
import { coverUrl } from '../../api/index.js'

const props = defineProps({
  song: { type: Object, default: null },
  size: { type: [Number, String], default: 48 },
  rounded: { type: String, default: 'md' }, // sm | md | lg | full
})

const failed = ref(false)
const src = computed(() => {
  if (!props.song) return ''
  // 优先使用内嵌的 base64 封面（新扫描数据），无需再请求后端
  if (props.song.cover) return props.song.cover
  // 兼容旧数据：IndexedDB 中未存 cover 字段的旧歌曲回退到后端请求
  return props.song.hasCover ? coverUrl(props.song.fileRelPath) : ''
})

watch(
  () => props.song && props.song.id,
  () => {
    failed.value = false
  }
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
