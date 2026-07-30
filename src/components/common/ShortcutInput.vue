<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { keyEventToCombo, formatCombo } from '../../composables/useShortcuts.js'

const props = defineProps({
  // Tauri global-shortcut 格式字符串（如 'Space'、'Control+Right'）
  modelValue: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

// 是否处于录制态（等待用户按键）
const recording = ref(false)

function startRecord() {
  recording.value = true
  // 进入录制态后立即在 document 上监听一次 keydown
  document.addEventListener('keydown', onKey, true)
}

function stopRecord() {
  recording.value = false
  document.removeEventListener('keydown', onKey, true)
}

function onKey(e) {
  // Esc：取消录制，不改变现有值
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    stopRecord()
    return
  }
  const combo = keyEventToCombo(e)
  // 纯修饰键按下时不结束录制，继续等待主键
  if (!combo) return
  e.preventDefault()
  e.stopPropagation()
  emit('update:modelValue', combo)
  stopRecord()
}

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey, true)
})
</script>

<template>
  <button
    type="button"
    class="inline-flex min-w-[96px] items-center justify-center rounded-md border px-3 py-1.5 text-sm transition-colors"
    :class="
      recording
        ? 'border-itunes-blue text-itunes-blue'
        : 'border-neutral-300 text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-neutral-600'
    "
    @click="recording ? stopRecord() : startRecord()"
  >
    <template v-if="recording">
      <span class="animate-pulse">按下快捷键…</span>
    </template>
    <template v-else>
      {{ formatCombo(modelValue) }}
    </template>
  </button>
</template>
