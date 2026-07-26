import { ref, computed } from 'vue'
import { scanLibraryStream } from '../api/index.js'
import { useLibraryStore } from '../stores/library.js'

// 文件夹选择弹窗开关（跨组件共享，无需 Pinia）
const folderPickerOpen = ref(false)

// —— 导入进度状态（模块级单例，全局共享） ——
const progressOpen = ref(false)
// 阶段：idle（未开始）| scanning（扫描目录）| parsing（解析元数据）| done（完成）| error（出错）
const stage = ref('idle')
const scanPath = ref('')
const total = ref(0) // 发现的文件总数
const doneCount = ref(0) // 已处理（成功+失败）数量
const failedCount = ref(0) // 解析失败数量
const discoveredFiles = ref([]) // files 事件上报的相对路径清单
const entries = ref([]) // 已解析条目 {file, ok}，最新在前
const errorMsg = ref('')

let controller = null

const isScanning = computed(
  () => stage.value === 'scanning' || stage.value === 'parsing'
)
const percentage = computed(() => {
  if (!total.value) return 0
  return Math.min(100, Math.round((doneCount.value / total.value) * 100))
})
const successCount = computed(() => doneCount.value - failedCount.value)

/** 打开文件夹选择弹窗 */
function openImport() {
  folderPickerOpen.value = true
}

/** 重置进度状态 */
function resetProgress() {
  stage.value = 'idle'
  scanPath.value = ''
  total.value = 0
  doneCount.value = 0
  failedCount.value = 0
  discoveredFiles.value = []
  entries.value = []
  errorMsg.value = ''
}

/** 处理单条 SSE 事件（返回的 Promise 会被流读取器等待） */
async function handleMessage(msg) {
  if (!msg || !msg.type) return
  switch (msg.type) {
    case 'files':
      total.value = msg.total || 0
      discoveredFiles.value = Array.isArray(msg.files) ? msg.files : []
      stage.value = total.value === 0 ? 'done' : 'parsing'
      // 空目录：直接入库空结果并完成
      if (total.value === 0) {
        const library = useLibraryStore()
        await library.mergeSongs([], scanPath.value)
      }
      break
    case 'progress':
      doneCount.value = typeof msg.index === 'number' ? msg.index : doneCount.value + 1
      if (msg.ok === false) failedCount.value += 1
      entries.value.unshift({ file: msg.file, ok: msg.ok !== false })
      break
    case 'done': {
      // 入库（后端回传权威的全量结果）
      const library = useLibraryStore()
      await library.mergeSongs(msg.songs || [], scanPath.value)
      stage.value = 'done'
      break
    }
    case 'error':
      stage.value = 'error'
      errorMsg.value = msg.message || '扫描过程中出错'
      break
  }
}

/** 选择文件夹后开始流式扫描 */
async function startScan(p = '') {
  const dir = (p || '').trim()
  if (!dir) return
  resetProgress()
  scanPath.value = dir
  progressOpen.value = true
  stage.value = 'scanning'
  controller = new AbortController()
  try {
    await scanLibraryStream(dir, handleMessage, controller.signal)
  } catch (e) {
    if (e?.name === 'AbortError') {
      // 用户主动取消：静默关闭弹窗
      progressOpen.value = false
      stage.value = 'idle'
    } else {
      stage.value = 'error'
      errorMsg.value = e?.message || String(e)
    }
  } finally {
    controller = null
  }
}

/** 取消正在进行的扫描 */
function cancelScan() {
  if (controller) {
    controller.abort()
    controller = null
  }
}

/** 关闭进度弹窗（仅在非扫描中允许关闭） */
function closeProgress() {
  if (isScanning.value) return
  progressOpen.value = false
  stage.value = 'idle'
}

export function useImport() {
  return {
    // 文件夹选择
    folderPickerOpen,
    openImport,
    // 进度状态
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
    startScan,
    cancelScan,
    closeProgress,
  }
}
