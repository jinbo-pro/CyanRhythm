<script setup>
import { clearAllData } from '@/db/index.js'

/**
 * 清空所有数据（二次确认）
 * 清空 IndexedDB 全部 store 后刷新页面
 */
async function onClear() {
  try {
    await ElMessageBox.confirm(
      '此操作将清空所有歌曲、播放列表、配置和播放进度，且不可恢复，确定继续？',
      '清空所有数据',
      {
        type: 'error',
        confirmButtonText: '确认清空',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
      }
    )
    await clearAllData()
    ElMessage.success('已清空所有数据，即将刷新页面...')
    setTimeout(() => location.reload(), 800)
  } catch (e) {
    if (e !== 'cancel' && e?.toString() !== 'cancel') {
      ElMessage.error('清空失败：' + (e?.message || e))
    }
  }
}
</script>

<template>
  <!-- 危险操作 -->
  <el-collapse-item name="danger" title="危险操作">
    <div class="flex items-center justify-between gap-4">
      <div class="min-w-0">
        <div class="text-sm font-medium">清空所有数据</div>
        <div class="mt-0.5 text-xs text-neutral-400">
          删除所有歌曲、播放列表、配置和播放进度，然后刷新页面
        </div>
      </div>
      <el-button type="danger" plain size="small" @click="onClear">
        <template #icon><el-icon><Delete /></el-icon></template>
        清空
      </el-button>
    </div>
  </el-collapse-item>
</template>
