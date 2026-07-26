<script setup>
import { computed } from 'vue'
import { useImport } from '../../composables/useImport.js'

const {
  progressOpen,
  stage,
  scanPath,
  total,
  doneCount,
  failedCount,
  successCount,
  discoveredFiles,
  entries,
  errorMsg,
  isScanning,
  percentage,
  cancelScan,
  closeProgress,
} = useImport()

// 列表仅渲染最近 N 条，避免极端数量下渲染卡顿
const MAX_RENDER = 500

const statusText = computed(() => {
  switch (stage.value) {
    case 'scanning':
      return '正在扫描文件夹结构...'
    case 'parsing':
      return `正在解析音乐文件 ${doneCount.value} / ${total.value}`
    case 'done':
      return `导入完成，共 ${successCount.value} 首歌曲`
    case 'error':
      return '导入失败'
    default:
      return ''
  }
})

const progressStatus = computed(() => {
  if (stage.value === 'done') return 'success'
  if (stage.value === 'error') return 'exception'
  return '' // 默认主题色
})

// 展示用列表：有解析记录则展示记录（带状态图标），否则展示已发现的文件清单（待解析）
const listItems = computed(() => {
  if (entries.value.length) {
    return entries.value.slice(0, MAX_RENDER).map((e) => ({
      file: e.file,
      ok: e.ok,
      pending: false,
    }))
  }
  return discoveredFiles.value.slice(0, MAX_RENDER).map((f) => ({
    file: f,
    ok: null,
    pending: true,
  }))
})

const overLimit = computed(
  () => entries.value.length > MAX_RENDER || discoveredFiles.value.length > MAX_RENDER
)
</script>

<template>
  <el-dialog
    :model-value="progressOpen"
    title="导入音乐"
    width="560px"
    :close-on-click-modal="false"
    :show-close="!isScanning"
    :close-on-press-escape="!isScanning"
    append-to-body
    @update:model-value="(v) => { if (!v) closeProgress() }"
  >
    <!-- 状态行 -->
    <div class="space-y-3">
      <div class="flex items-center gap-2 text-sm">
        <el-icon v-if="isScanning" class="is-loading text-itunes-blue"><Loading /></el-icon>
        <el-icon v-else-if="stage === 'done'" class="text-green-500"><CircleCheck /></el-icon>
        <el-icon v-else-if="stage === 'error'" class="text-red-500"><CircleClose /></el-icon>
        <span class="font-medium">{{ statusText }}</span>
        <span v-if="failedCount > 0" class="text-xs text-amber-500">
          {{ failedCount }} 个解析失败
        </span>
      </div>

      <!-- 进度条 -->
      <el-progress
        v-if="total > 0 || stage === 'done' || stage === 'error'"
        :percentage="percentage"
        :status="progressStatus"
        :stroke-width="8"
      />

      <!-- 错误详情 -->
      <div
        v-if="stage === 'error'"
        class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
      >
        {{ errorMsg }}
      </div>

      <!-- 扫描路径 -->
      <div class="truncate text-xs text-neutral-400">
        目录：<span class="text-neutral-600 dark:text-neutral-300">{{ scanPath || '-' }}</span>
      </div>
    </div>

    <!-- 文件列表 -->
    <div class="mt-4">
      <div class="mb-1 flex items-center justify-between text-xs text-neutral-400">
        <span>{{ entries.length ? '解析记录' : '扫描到的文件' }}</span>
        <span v-if="overLimit">文件较多，仅显示最近 {{ MAX_RENDER }} 条</span>
      </div>
      <div
        class="h-[38vh] overflow-y-auto rounded-lg border border-neutral-100 dark:border-neutral-700"
      >
        <div
          v-if="listItems.length === 0"
          class="flex h-full items-center justify-center text-sm text-neutral-400"
        >
          <el-empty :description="isScanning ? '正在扫描目录...' : '暂无文件'" :image-size="72" />
        </div>
        <div
          v-for="(item, i) in listItems"
          :key="i"
          class="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
        >
          <el-icon v-if="item.pending" :size="14" class="is-loading text-neutral-300">
            <Loading />
          </el-icon>
          <el-icon v-else-if="item.ok" :size="14" class="shrink-0 text-green-500">
            <CircleCheck />
          </el-icon>
          <el-icon v-else :size="14" class="shrink-0 text-red-400">
            <CircleClose />
          </el-icon>
          <span
            class="min-w-0 flex-1 truncate"
            :class="item.ok === false ? 'text-neutral-400 line-through' : ''"
          >
            {{ item.file }}
          </span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs text-neutral-400">
          <template v-if="stage === 'done'">
            成功 {{ successCount }} 首<span v-if="failedCount"> · 失败 {{ failedCount }}</span>
          </template>
          <template v-else-if="isScanning">
            已处理 {{ doneCount }} / {{ total || '?' }}
          </template>
        </span>
        <div class="flex gap-2">
          <el-button v-if="isScanning" @click="cancelScan">取消扫描</el-button>
          <el-button v-else type="primary" @click="closeProgress">
            {{ stage === 'error' ? '关闭' : '完成' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>
