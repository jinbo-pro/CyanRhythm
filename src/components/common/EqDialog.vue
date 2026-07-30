<script setup>
import { ref, computed, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings.js'
import { EQ_LABELS, EQ_PRESETS } from '@/composables/useEqualizer.js'

const visible = defineModel({ type: Boolean, default: false })
const settings = useSettingsStore()

// 本地副本：滑块拖动时即时更新视觉，同时同步到 store
const localGains = ref([...settings.eqGains])
const eqOn = ref(settings.eqEnabled)

// 弹窗打开时从 store 同步最新状态
watch(visible, (open) => {
  if (open) {
    localGains.value = [...settings.eqGains]
    eqOn.value = settings.eqEnabled
  }
})

function onEnableChange(val) {
  settings.setEqEnabled(val)
}

function onGainInput(index, val) {
  localGains.value[index] = val
  settings.setEqGain(index, val)
}

function applyPreset(key) {
  const preset = EQ_PRESETS[key]
  if (!preset) return
  localGains.value = [...preset.gains]
  settings.setEqGains(preset.gains)
}

function resetToFlat() {
  localGains.value = [...EQ_PRESETS.flat.gains]
  settings.setEqGains(EQ_PRESETS.flat.gains)
}

const presetEntries = Object.entries(EQ_PRESETS).map(([key, val]) => ({
  key,
  name: val.name,
}))

// 检测当前增益是否匹配某个预设
const matchedPreset = computed(() => {
  return (
    Object.entries(EQ_PRESETS).find(([, p]) =>
      p.gains.every((g, i) => g === localGains.value[i])
    )?.[0] || ''
  )
})

function formatGain(db) {
  return db > 0 ? `+${db}` : `${db}`
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="EQ 均衡器"
    width="600px"
    :close-on-click-modal="true"
    append-to-body
    class="eq-dialog"
  >
    <!-- 顶部：开关状态 -->
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <el-switch v-model="eqOn" @change="onEnableChange" />
        <span class="text-sm" :class="eqOn ? 'text-green-500' : 'text-neutral-400'">
          {{ eqOn ? '已启用' : '已关闭' }}
        </span>
      </div>
      <span class="text-xs text-neutral-400">拖动滑块调节各频段增益（±12 dB）</span>
    </div>

    <!-- 预设按钮 -->
    <div class="mb-5 flex flex-wrap gap-2">
      <el-button
        v-for="p in presetEntries"
        :key="p.key"
        size="small"
        :type="matchedPreset === p.key ? 'primary' : 'default'"
        :disabled="!eqOn"
        @click="applyPreset(p.key)"
      >
        {{ p.name }}
      </el-button>
    </div>

    <!-- 滑块区域 -->
    <div class="eq-sliders" :class="{ 'is-disabled': !eqOn }">
      <!-- 0 dB 参考线 -->
      <div class="eq-zero-line"></div>

      <div v-for="(label, i) in EQ_LABELS" :key="i" class="eq-band">
        <span class="eq-value" :class="{ 'text-green-500': localGains[i] > 0, 'text-red-400': localGains[i] < 0 }">
          {{ formatGain(localGains[i]) }}
        </span>
        <el-slider
          :model-value="localGains[i]"
          vertical
          :min="-12"
          :max="12"
          :step="1"
          height="160px"
          :show-tooltip="false"
          :disabled="!eqOn"
          @input="(val) => onGainInput(i, val)"
        />
        <span class="eq-label">{{ label }}</span>
      </div>
    </div>

    <template #footer>
      <el-button :disabled="!eqOn" @click="resetToFlat">重置平坦</el-button>
      <el-button type="primary" @click="visible = false">完成</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
/* 滑块容器 */
.eq-sliders {
  position: relative;
  display: flex;
  justify-content: space-between;
  padding: 12px 16px 16px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
}

/* 0 dB 参考线：定位在滑块垂直中心（滑块高 160px + 值标签约 28px ≈ 顶部偏移） */
.eq-zero-line {
  position: absolute;
  left: 16px;
  right: 16px;
  top: 120px; /* 12px(padding) + 20px(值标签) + 8px(gap) + 80px(滑块中点) */
  height: 1px;
  background: var(--el-border-color);
  opacity: 0.5;
  pointer-events: none;
}

.eq-sliders.is-disabled {
  opacity: 0.45;
}

/* 单个频段列 */
.eq-band {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.eq-value {
  height: 20px;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

.eq-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

/* el-slider 竖直模式下宽度收紧 */
.eq-band :deep(.el-slider) {
  width: 24px;
}

.eq-band :deep(.el-slider__runway) {
  margin: 9px;
}
</style>
