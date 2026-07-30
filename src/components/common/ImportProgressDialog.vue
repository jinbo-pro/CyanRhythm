<script setup lang="jsx">
import { computed, ref } from 'vue'
import { useImport } from '@/composables/useImport.js'
import { useLibraryStore } from '@/stores/library.js'
import { getBaseName } from '@/utils/path.js'
import { formatTime } from '@/composables/usePlayer.js'
import AlbumCover from './AlbumCover.vue'

const {
  progressOpen,
  stage,
  scanPath,
  scanDirs,
  total,
  doneCount,
  failedCount,
  successCount,
  discoveredFiles,
  entries,
  errorMsg,
  isScanning,
  percentage,
  openImport,
  updateScanDir,
  cancelScan,
  closeProgress,
} = useImport()

const library = useLibraryStore()

// 当前选中查看的目录（null = 查看全部已导入歌曲）
const selectedDir = ref(null)

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
  return ''
})

// 是否处于「扫描视图」：展示本次解析记录；否则展示已导入歌曲（管理视图）
const isScanView = computed(
  () => isScanning.value || stage.value === 'done' || stage.value === 'error'
)

// 虚拟表格数据：扫描时展示解析记录，空闲时展示已导入歌曲（可按目录过滤）
const tableData = computed(() => {
  if (isScanView.value) {
    if (entries.value.length) {
      return entries.value.map((e, i) => ({
        id: `entry-${i}-${e.file}`,
        file: e.file,
        ok: e.ok,
        pending: false,
      }))
    }
    return discoveredFiles.value.map((f, i) => ({
      id: `file-${i}-${f}`,
      file: f,
      ok: null,
      pending: true,
    }))
  }
  if (selectedDir.value) return library.songsByDir(selectedDir.value)
  return library.songs
})

// 虚拟表格列：扫描视图与歌曲视图分别定义
const tableColumns = computed(() => {
  if (isScanView.value) {
    // 解析记录列：状态图标 + 文件路径
    return [
      {
        key: 'status',
        width: 44,
        align: 'center',
        cellRenderer: ({ rowData }) =>
          rowData.pending ? (
            <ElIcon class="is-loading text-neutral-300" size={14}>
              <Loading />
            </ElIcon>
          ) : rowData.ok ? (
            <ElIcon class="text-green-500" size={14}>
              <CircleCheck />
            </ElIcon>
          ) : (
            <ElIcon class="text-red-400" size={14}>
              <CircleClose />
            </ElIcon>
          ),
      },
      {
        key: 'file',
        title: '文件路径',
        width: 200,
        flexGrow: 1,
        cellRenderer: ({ rowData }) => (
          <span
            class={`block truncate ${rowData.ok === false ? 'text-neutral-400 line-through' : ''}`}
            title={rowData.file}
          >
            {rowData.file}
          </span>
        ),
      },
    ]
  }
  // 歌曲列：序号 / 标题（封面+歌名+艺术家）/ 专辑 / 时长
  return [
    {
      key: 'index',
      width: 50,
      align: 'center',
      cellRenderer: ({ rowIndex }) => (
        <span class="text-neutral-400">{rowIndex + 1}</span>
      ),
    },
    {
      key: 'title',
      title: '标题',
      width: 220,
      flexGrow: 2,
      cellRenderer: ({ rowData }) => (
        <div class="flex w-full min-w-0 items-center gap-3">
          <AlbumCover song={rowData} size={36} rounded="md" />
          <div class="min-w-0">
            <div class="truncate font-medium">{rowData.title}</div>
            <div class="truncate text-xs text-neutral-400">{rowData.artist}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'album',
      dataKey: 'album',
      title: '专辑',
      width: 160,
      flexGrow: 1,
      cellRenderer: ({ cellData }) => (
        <span class="block truncate">{cellData}</span>
      ),
    },
    {
      key: 'duration',
      title: '时长',
      width: 80,
      align: 'right',
      cellRenderer: ({ rowData }) => (
        <span class="tabular-nums text-neutral-400">
          {formatTime(rowData.duration)}
        </span>
      ),
    },
  ]
})

// 某个目录下的歌曲数量
function dirSongCount(dir) {
  return library.songsByDir(dir).length
}

// 点击目录卡片：切换查看该目录歌曲（扫描进行中不可切换）
function selectDir(dir) {
  if (isScanView.value) return
  selectedDir.value = selectedDir.value === dir ? null : dir
}

// 删除目录及其歌曲（二次确认）
async function onRemoveDir(dir) {
  try {
    await ElMessageBox.confirm(
      `确定删除目录「${getBaseName(dir) || dir}」及其下所有歌曲？此操作不可恢复。`,
      '删除目录',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
      }
    )
    await library.removeScanDir(dir)
    if (selectedDir.value === dir) selectedDir.value = null
    ElMessage.success('已删除目录')
  } catch (e) {
    if (e !== 'cancel' && e?.toString() !== 'cancel') {
      ElMessage.error('删除失败：' + (e?.message || e))
    }
  }
}
</script>

<template>
  <el-dialog
    :model-value="progressOpen"
    :title="isScanView ? '导入音乐' : '导入管理'"
    width="720px"
    :close-on-click-modal="false"
    :show-close="!isScanning"
    :close-on-press-escape="!isScanning"
    append-to-body
    @update:model-value="(v) => { if (!v) closeProgress() }"
  >
    <div class="space-y-4">
      <!-- 已扫描目录管理 -->
      <section>
        <div class="mb-2 flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            已扫描目录 ({{ scanDirs.length }})
          </span>
          <el-button
            text
            size="small"
            type="primary"
            :disabled="isScanning"
            @click="openImport"
          >
            <el-icon><Plus /></el-icon>
            添加目录
          </el-button>
        </div>
        <div class="max-h-[160px] space-y-1.5 overflow-y-auto">
          <div
            v-if="scanDirs.length === 0"
            class="rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-center text-xs text-neutral-400 dark:border-neutral-700"
          >
            尚未扫描任何目录，点击「添加目录」开始导入
          </div>
          <div
            v-for="dir in scanDirs"
            :key="dir"
            class="group flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition-colors"
            :class="
              selectedDir === dir
                ? 'border-itunes-blue bg-itunes-blue/5'
                : 'border-neutral-100 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800/60'
            "
            @click="selectDir(dir)"
          >
            <el-icon :size="16" class="shrink-0 text-itunes-blue">
              <Folder />
            </el-icon>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium" :title="dir">
                {{ getBaseName(dir) || dir }}
              </div>
              <div class="truncate text-xs text-neutral-400" :title="dir">
                {{ dir }}
              </div>
            </div>
            <span class="shrink-0 text-xs text-neutral-400">
              {{ dirSongCount(dir) }} 首
            </span>
            <div class="flex shrink-0 items-center gap-1">
              <el-button
                text
                size="small"
                title="重新扫描此目录"
                :disabled="isScanning"
                @click.stop="updateScanDir(dir)"
              >
                <el-icon><Refresh /></el-icon>
              </el-button>
              <el-button
                text
                size="small"
                type="danger"
                title="删除此目录及其歌曲"
                :disabled="isScanning"
                @click.stop="onRemoveDir(dir)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </section>

      <!-- 扫描进度（仅扫描/完成/出错时显示） -->
      <section v-if="isScanView">
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-sm">
            <el-icon v-if="isScanning" class="is-loading text-itunes-blue">
              <Loading />
            </el-icon>
            <el-icon v-else-if="stage === 'done'" class="text-green-500">
              <CircleCheck />
            </el-icon>
            <el-icon v-else-if="stage === 'error'" class="text-red-500">
              <CircleClose />
            </el-icon>
            <span class="font-medium">{{ statusText }}</span>
            <span v-if="failedCount > 0" class="text-xs text-amber-500">
              {{ failedCount }} 个解析失败
            </span>
          </div>

          <el-progress
            v-if="total > 0 || stage === 'done' || stage === 'error'"
            :percentage="percentage"
            :status="progressStatus"
            :stroke-width="8"
          />

          <div
            v-if="stage === 'error'"
            class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
          >
            {{ errorMsg }}
          </div>

          <div class="truncate text-xs text-neutral-400">
            目录：<span class="text-neutral-600 dark:text-neutral-300">{{ scanPath || '-' }}</span>
          </div>
        </div>
      </section>

      <!-- 文件表格（虚拟滚动，无数量上限） -->
      <section>
        <div class="mb-1 flex items-center justify-between text-xs text-neutral-400">
          <span>
            {{
              isScanView
                ? entries.length
                  ? '解析记录'
                  : '扫描到的文件'
                : selectedDir
                  ? '当前目录歌曲'
                  : '全部歌曲'
            }}
          </span>
          <span>{{ tableData.length }} 项</span>
        </div>
        <div
          class="h-[40vh] rounded-lg border border-neutral-100 dark:border-neutral-700"
        >
          <el-auto-resizer>
            <template #default="{ height, width }">
              <el-table-v2
                :columns="tableColumns"
                :data="tableData"
                :width="width"
                :height="height"
                :row-height="44"
                row-key="id"
              >
                <template #empty>
                  <div class="flex h-full items-center justify-center">
                    <el-empty
                      :description="isScanView && isScanning ? '正在扫描目录...' : '暂无文件'"
                      :image-size="72"
                    />
                  </div>
                </template>
              </el-table-v2>
            </template>
          </el-auto-resizer>
        </div>
      </section>
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
          <template v-else>
            共 {{ library.total }} 首歌曲
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
