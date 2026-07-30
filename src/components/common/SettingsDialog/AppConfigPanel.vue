<script setup>
import { ref, watch } from 'vue'
import { getAppConfig, saveAppConfig as saveAppConfigApi } from '@/api/index.js'

const props = defineProps({ open: Boolean })

// 应用配置草稿（LRCLIB 地址等，持久化到本地文件）
const appConfigDraft = ref({ lrclibBase: '' })
const appConfigSaving = ref(false)

/** 加载应用配置到草稿（后端缺省时返回默认值） */
async function loadAppConfig() {
  try {
    const config = await getAppConfig()
    appConfigDraft.value = { lrclibBase: config.lrclibBase || '' }
  } catch {
    appConfigDraft.value = { lrclibBase: '' }
  }
}

/** 保存应用配置到本地文件 */
async function onSaveAppConfig() {
  appConfigSaving.value = true
  try {
    await saveAppConfigApi({ lrclibBase: appConfigDraft.value.lrclibBase.trim() })
    ElMessage.success('应用配置已保存')
  } catch (e) {
    ElMessage.error('保存配置失败：' + (e?.message || e))
  } finally {
    appConfigSaving.value = false
  }
}

// 抽屉打开时加载配置
watch(() => props.open, (v) => {
  if (v) loadAppConfig()
})
</script>

<template>
  <!-- 应用配置 -->
  <el-collapse-item name="appconfig" title="应用配置">
    <div class="space-y-4">
      <div>
        <div class="text-sm font-medium">LRCLIB 地址</div>
        <div class="mt-0.5 mb-2 text-xs text-neutral-400">
          在线歌词匹配服务的 API 地址，留空使用默认值
        </div>
        <el-input
          v-model="appConfigDraft.lrclibBase"
          placeholder="https://lrclib.net/api"
          clearable
        />
      </div>
      <div class="flex justify-end">
        <el-button
          type="primary"
          size="small"
          :loading="appConfigSaving"
          @click="onSaveAppConfig"
        >
          保存
        </el-button>
      </div>
    </div>
  </el-collapse-item>
</template>
