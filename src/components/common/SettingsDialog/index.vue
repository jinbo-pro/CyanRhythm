<script setup>
import { ref } from 'vue'
import GeneralPanel from './GeneralPanel.vue'
import AppConfigPanel from './AppConfigPanel.vue'
import ShortcutsPanel from './ShortcutsPanel.vue'
import SyncPanel from './SyncPanel.vue'
import DangerPanel from './DangerPanel.vue'
import AboutPanel from './AboutPanel.vue'

const visible = defineModel({ type: Boolean, default: false })

// ===== 折叠面板默认展开项 =====
const activeNames = ref(['general'])
</script>

<template>
  <el-drawer
    v-model="visible"
    title="设置"
    direction="ltr"
    size="420px"
    :close-on-click-modal="false"
    append-to-body
  >
    <el-collapse v-model="activeNames" class="settings-collapse">
      <GeneralPanel @close="visible = false" />
      <AppConfigPanel :open="visible" />
      <ShortcutsPanel :open="visible" />
      <SyncPanel :open="visible" />
      <DangerPanel />
      <AboutPanel />
    </el-collapse>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-drawer>
</template>

<style scoped>
.settings-collapse :deep(.el-collapse-item__header) {
  font-size: 14px;
  font-weight: 600;
}

.settings-collapse :deep(.el-collapse-item__content) {
  padding-bottom: 16px;
}
</style>
