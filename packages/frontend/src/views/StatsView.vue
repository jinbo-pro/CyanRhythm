<script setup lang="jsx">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElIcon } from 'element-plus'
import { ArrowUp, ArrowDown, Headset, DataLine } from '@element-plus/icons-vue'
import { useStatsStore } from '../stores/stats.js'

const router = useRouter()
const stats = useStatsStore()

// 维度：'duration' 播放时长 | 'count' 播放次数
const tab = ref('duration')

// 排序：默认倒序
const sortField = ref('value') // 'value' 按数值；'title' 按歌名
const sortOrder = ref('desc') // 'desc' | 'asc'

onMounted(() => stats.refresh())

/** 秒数格式化为紧凑时长 H:MM:SS 或 M:SS */
function fmtTime(sec) {
  if (!sec || sec < 1) return '0:00'
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  return `${m}:${String(r).padStart(2, '0')}`
}

/** 秒数格式化为中文可读时长 */
function fmtHuman(sec) {
  if (!sec || sec < 1) return '0 秒'
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const parts = []
  if (h > 0) parts.push(`${h} 小时`)
  if (m > 0) parts.push(`${m} 分`)
  if (r > 0 || parts.length === 0) parts.push(`${r} 秒`)
  return parts.join(' ')
}

/** 当前维度下每条记录的展示值 */
function recordValue(r) {
  return tab.value === 'duration' ? r.playDuration || 0 : r.playCount || 0
}

/** 汇总值 */
const summary = computed(() =>
  tab.value === 'duration' ? stats.totalPlayDuration : stats.totalPlayCount
)
const summaryText = computed(() =>
  tab.value === 'duration' ? fmtHuman(summary.value) : `${summary.value} 次`
)

/** 排序后的列表（数据预先排序，直接喂给 el-table-v2） */
const sortedRecords = computed(() => {
  const list = stats.records.slice()
  const dir = sortOrder.value === 'desc' ? -1 : 1
  return list.sort((a, b) => {
    let diff
    if (sortField.value === 'title') {
      diff = (a.title || '').localeCompare(b.title || '', 'zh')
    } else {
      diff = recordValue(a) - recordValue(b)
    }
    return dir * diff
  })
})

/** 切换数值列排序（默认倒序，再次点击切换升降序） */
function toggleValueSort() {
  if (sortField.value !== 'value') {
    sortField.value = 'value'
    sortOrder.value = 'desc'
  } else {
    sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
  }
}

/** 切换歌名列排序 */
function toggleTitleSort() {
  if (sortField.value !== 'title') {
    sortField.value = 'title'
    sortOrder.value = 'asc'
  } else {
    sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
  }
}

/** 切换维度时重置为默认排序 */
function onTabChange() {
  sortField.value = 'value'
  sortOrder.value = 'desc'
}

function back() {
  if (window.history.length > 1) router.back()
  else router.push('/songs')
}

/** 渲染带排序图标的表头 */
function SortableHeader({ label, field, onToggle }) {
  const active = sortField.value === field
  return (
    <button
      class="inline-flex items-center gap-1 font-medium hover:text-neutral-700 dark:hover:text-neutral-200"
      onClick={onToggle}
    >
      {label}
      {active ? (
        <ElIcon size={12}>
          {sortOrder.value === 'asc' ? <ArrowUp /> : <ArrowDown />}
        </ElIcon>
      ) : null}
    </button>
  )
}

/** el-table-v2 列定义（JSX 渲染，虚拟滚动下只渲染可视区行） */
const columns = computed(() => [
  // 序号
  {
    key: 'index',
    width: 56,
    align: 'center',
    cellRenderer: ({ rowIndex }) => (
      <span class="text-neutral-400">{rowIndex + 1}</span>
    ),
  },
  // 标题（封面 + 歌名 / 艺术家）
  {
    key: 'title',
    width: 240,
    flexGrow: 2,
    headerCellRenderer: () => (
      <SortableHeader label="歌曲" field="title" onToggle={toggleTitleSort} />
    ),
    cellRenderer: ({ rowData }) => (
      <div class="flex w-full min-w-0 items-center gap-2.5">
        {rowData.cover ? (
          <img
            src={rowData.cover}
            class="h-9 w-9 shrink-0 rounded object-cover"
            alt=""
          />
        ) : (
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-neutral-200 text-neutral-400 dark:bg-neutral-800">
            <ElIcon size={16}><Headset /></ElIcon>
          </div>
        )}
        <div class="min-w-0">
          <div class="truncate font-medium">{rowData.title}</div>
          <div class="truncate text-xs text-neutral-400">{rowData.artist}</div>
        </div>
      </div>
    ),
  },
  // 艺术家
  {
    key: 'artist',
    dataKey: 'artist',
    title: '艺术家',
    width: 160,
    flexGrow: 1,
    cellRenderer: ({ cellData }) => <span class="truncate">{cellData}</span>,
  },
  // 数值列（播放时长 / 播放次数）
  {
    key: 'value',
    width: 120,
    align: 'right',
    headerCellRenderer: () => (
      <SortableHeader
        label={tab.value === 'duration' ? '播放时长' : '播放次数'}
        field="value"
        onToggle={toggleValueSort}
      />
    ),
    cellRenderer: ({ rowData }) => (
      <span class="tabular-nums">
        {tab.value === 'duration'
          ? fmtTime(rowData.playDuration)
          : `${rowData.playCount} 次`}
      </span>
    ),
  },
])
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 头部 -->
    <div class="px-6 pt-3">
      <div class="flex items-center gap-2">
        <el-button text circle title="返回" @click="back">
          <el-icon><ArrowLeft /></el-icon>
        </el-button>
        <h1 class="text-2xl font-bold">播放统计</h1>
      </div>
    </div>

    <!-- 维度切换 -->
    <div class="px-6 pt-4">
      <el-radio-group v-model="tab" @change="onTabChange">
        <el-radio-button value="duration">播放时长</el-radio-button>
        <el-radio-button value="count">播放次数</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 汇总卡片 -->
    <div class="px-6 pt-4">
      <div
        class="rounded-xl border border-neutral-200 bg-white px-6 py-4 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div class="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          {{ tab === 'duration' ? '总播放时长' : '总播放次数' }}
        </div>
        <div class="mt-1 text-3xl font-bold text-itunes-blue">{{ summaryText }}</div>
      </div>
    </div>

    <!-- 统计表格（el-table-v2 虚拟滚动，容器需固定高度） -->
    <div class="min-h-0 flex-1 overflow-hidden px-6 py-4">
      <div class="h-full w-full">
        <el-auto-resizer>
          <template #default="{ height, width }">
            <el-table-v2
              :columns="columns"
              :data="sortedRecords"
              :width="width"
              :height="height"
              :row-height="54"
              :row-key="'id'"
            >
              <template #empty>
                <div class="flex h-full flex-col items-center justify-center text-neutral-400">
                  <el-icon :size="48"><DataLine /></el-icon>
                  <p class="mt-3 text-sm">暂无播放记录，去听听音乐吧</p>
                </div>
              </template>
            </el-table-v2>
          </template>
        </el-auto-resizer>
      </div>
    </div>
  </div>
</template>
