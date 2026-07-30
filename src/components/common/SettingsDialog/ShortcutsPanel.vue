<script setup>
import { ref, watch } from 'vue'
import {
  useSettingsStore,
  SHORTCUT_ACTIONS,
  SHORTCUT_LABELS,
  DEFAULT_SHORTCUTS,
} from '@/stores/settings.js'
import ShortcutInput from '@/components/common/ShortcutInput.vue'

const props = defineProps({ open: Boolean })

const settings = useSettingsStore()

// 快捷键配置
const shortcutActions = Object.values(SHORTCUT_ACTIONS)
const shortcutLabels = SHORTCUT_LABELS

// 快捷键草稿：暂存用户修改，点击「保存」后才批量应用到 store
const draftShortcuts = ref({ ...settings.shortcuts })

/** 草稿内冲突检测后更新草稿（不立即写入 store） */
function onShortcutChange(action, combo) {
  const conflict = shortcutActions.find(
    (a) => a !== action && draftShortcuts.value[a] === combo
  )
  if (conflict) {
    ElMessage.warning(`该快捷键已用于「${shortcutLabels[conflict]}」，请换一个`)
    return
  }
  draftShortcuts.value = { ...draftShortcuts.value, [action]: combo }
}

/** 将草稿批量保存到 store 并应用 */
function saveShortcuts() {
  settings.applyShortcuts(draftShortcuts.value)
  ElMessage.success('快捷键已保存')
}

/** 重置草稿为默认值（不立即写入 store） */
function resetDraftShortcuts() {
  draftShortcuts.value = { ...DEFAULT_SHORTCUTS }
}

// 抽屉打开时同步草稿为当前 store 值
watch(() => props.open, (v) => {
  if (v) draftShortcuts.value = { ...settings.shortcuts }
})
</script>

<template>
  <!-- 快捷键 -->
  <el-collapse-item name="shortcuts" title="快捷键">
    <div class="mb-3 flex items-center justify-end">
      <el-button text size="small" @click="resetDraftShortcuts">重置默认</el-button>
    </div>
    <div class="space-y-3">
      <div
        v-for="action in shortcutActions"
        :key="action"
        class="flex items-center justify-between gap-4"
      >
        <div class="min-w-0">
          <div class="text-sm font-medium">{{ shortcutLabels[action] }}</div>
        </div>
        <ShortcutInput
          :model-value="draftShortcuts[action]"
          @update:model-value="onShortcutChange(action, $event)"
        />
      </div>
    </div>
    <div class="mt-4 flex justify-end">
      <el-button type="primary" size="small" @click="saveShortcuts">保存</el-button>
    </div>
  </el-collapse-item>
</template>
