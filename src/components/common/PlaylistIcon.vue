<script setup>
import { computed } from 'vue'
import { generateIdenticon } from '@/utils/identicon.js'

/**
 * 统一播放列表图标组件
 * 支持三种渲染：
 *   1. 内置列表（builtin）→ 红色星标
 *   2. icon.type === 'pixel' → identicon.js 像素头像（SVG，同步生成）
 *   3. icon.type === 'color' → 纯色圆角方块
 *   4. 无 icon → 默认 List 图标
 */
const props = defineProps({
  playlist: { type: Object, required: true },
  size: { type: Number, default: 16 },
})

const icon = computed(() => props.playlist.icon)

// cyrb53 是同步哈希，computed 可直接返回
const identiconData = computed(() => {
  if (!icon.value || icon.value.type !== 'pixel' || !icon.value.value) return null
  return generateIdenticon(icon.value.value)
})

const isColor = computed(
  () => icon.value?.type === 'color' && typeof icon.value.value === 'string'
)
</script>

<template>
  <!-- 内置列表：红色星标 -->
  <el-icon
    v-if="playlist.builtin"
    :size="size"
    class="shrink-0 !text-red-500"
  >
    <StarFilled />
  </el-icon>

  <!-- 像素图标 -->
  <img
    v-else-if="identiconData"
    :src="identiconData"
    :style="{ width: size + 'px', height: size + 'px' }"
    class="shrink-0 rounded"
    alt=""
    draggable="false"
  />

  <!-- 纯色图标 -->
  <span
    v-else-if="isColor"
    :style="{ width: size + 'px', height: size + 'px', backgroundColor: icon.value }"
    class="shrink-0 rounded"
  />

  <!-- 默认列表图标 -->
  <el-icon v-else :size="size" class="shrink-0 text-neutral-400">
    <List />
  </el-icon>
</template>
