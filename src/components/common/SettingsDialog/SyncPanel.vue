<script setup>
import { ref, watch } from 'vue'
import { loadSongs, saveSongs } from '@/db/repositories/library.js'
import {
  getAllPlaylists,
  replaceAllPlaylists,
} from '@/db/repositories/playlists.js'
import { getAllStats, replaceAllStats } from '@/db/repositories/stats.js'
import { loadProgress, saveProgress } from '@/db/repositories/progress.js'
import {
  uploadSync,
  downloadSync,
  getBackupInfo,
  deleteBackup,
  getCurrentUsername,
} from '@/api/index.js'

const props = defineProps({ open: Boolean })

// ===== 同步凭证管理 =====
const CRED_KEY = 'local-music:sync-credentials'

/** 从 localStorage 读取已保存的凭证 */
function loadCred() {
  try {
    return JSON.parse(localStorage.getItem(CRED_KEY)) || {}
  } catch {
    return {}
  }
}

/** 保存凭证到 localStorage，方便下次自动填充 */
function saveCred(username, password) {
  localStorage.setItem(CRED_KEY, JSON.stringify({ username, password }))
}

// 系统当前用户名（组件加载时获取一次，用于上传弹窗默认填充）
const systemUsername = ref('')
getCurrentUsername().then((name) => {
  systemUsername.value = name || ''
}).catch(() => {})

// 凭证弹窗状态
const credVisible = ref(false)
const credMode = ref('upload') // 'upload' | 'sync'
const credUsername = ref('')
const credPassword = ref('')
const credLoading = ref(false)

// ===== 备份信息 =====
const backupInfo = ref(null) // { exists, username, encrypted, uploadedAt, size, path }
const backupLoading = ref(false)

/** 格式化文件大小 */
function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

/** 将毫秒时间戳格式化为可读日期 */
function formatTimestamp(ms) {
  if (!ms || ms === '0') return '-'
  const d = new Date(Number(ms))
  if (isNaN(d.getTime())) return '-'
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 加载备份信息（基于已保存的用户名） */
async function loadBackupInfo() {
  const saved = loadCred()
  if (!saved.username) {
    backupInfo.value = null
    return
  }
  backupLoading.value = true
  try {
    backupInfo.value = await getBackupInfo(saved.username)
  } catch {
    backupInfo.value = null
  } finally {
    backupLoading.value = false
  }
}

/** 打开凭证弹窗，自动填充已保存的用户名密码（优先已保存，否则回退系统用户名） */
function openCredDialog(mode) {
  credMode.value = mode
  const saved = loadCred()
  credUsername.value = saved.username || systemUsername.value || ''
  credPassword.value = saved.password || ''
  credVisible.value = true
}

/** 收集本地全部音乐数据为 JSON Blob（含统计与进度） */
async function collectDataBlob() {
  const songs = await loadSongs()
  const playlists = await getAllPlaylists()
  const stats = await getAllStats()
  const progress = await loadProgress()
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    songs,
    playlists,
    stats,
    progress,
  }
  return new Blob([JSON.stringify(data)], { type: 'application/json' })
}

/**
 * 凭证弹窗确认：根据模式执行上传或同步
 * 上传 —— 收集本地数据以文件方式发送到服务器，直接覆盖服务端数据
 * 同步 —— 从服务端拉取数据覆盖本地（需二次确认）
 */
async function onCredConfirm() {
  const username = credUsername.value.trim()
  if (!username) {
    ElMessage.warning('请输入用户名')
    return
  }
  const password = credPassword.value.trim()
  credLoading.value = true
  try {
    if (credMode.value === 'upload') {
      // 收集本地数据为文件并上传
      const blob = await collectDataBlob()
      const file = new File([blob], 'data.json', { type: 'application/json' })
      const result = await uploadSync(file, username, password)
      saveCred(username, password)
      ElMessage.success(
        `上传成功${result.encrypted ? '（已加密）' : ''}，共 ${(result.size / 1024).toFixed(1)} KB`
      )
      credVisible.value = false
      // 上传后刷新备份信息
      await loadBackupInfo()
    } else {
      // 同步前提示用户会覆盖本地数据
      await ElMessageBox.confirm(
        '同步将用服务器数据覆盖本地全部歌曲和播放列表，是否继续？',
        '同步确认',
        { type: 'warning', confirmButtonText: '同步', cancelButtonText: '取消' }
      )
      const data = await downloadSync(username, password)
      if (!data || !Array.isArray(data.songs)) {
        throw new Error('服务器返回的数据格式不正确')
      }
      await saveSongs(data.songs)
      if (Array.isArray(data.playlists)) {
        await replaceAllPlaylists(data.playlists)
      }
      if (Array.isArray(data.stats)) {
        await replaceAllStats(data.stats)
      }
      if (data.progress) {
        await saveProgress(data.progress)
      }
      saveCred(username, password)
      ElMessage.success('同步成功，即将刷新页面...')
      credVisible.value = false
      setTimeout(() => location.reload(), 800)
    }
  } catch (e) {
    if (e === 'cancel' || e?.toString() === 'cancel') return
    ElMessage.error(
      (credMode.value === 'upload' ? '上传' : '同步') + '失败：' + (e?.message || e)
    )
  } finally {
    credLoading.value = false
  }
}

/** 删除备份文件（二次确认） */
async function onDeleteBackup() {
  const saved = loadCred()
  if (!saved.username) {
    ElMessage.warning('请先上传一次数据以设置用户名')
    return
  }
  try {
    await ElMessageBox.confirm(
      '确定删除当前用户的备份文件？此操作不可恢复。',
      '删除备份',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
      }
    )
    await deleteBackup(saved.username)
    backupInfo.value = null
    ElMessage.success('备份已删除')
  } catch (e) {
    if (e !== 'cancel' && e?.toString() !== 'cancel') {
      ElMessage.error('删除备份失败：' + (e?.message || e))
    }
  }
}

// 抽屉打开时加载备份信息
watch(() => props.open, (v) => {
  if (v) loadBackupInfo()
})
</script>

<template>
  <!-- 数据同步 -->
  <el-collapse-item name="sync" title="数据同步">
    <div class="space-y-3">
      <!-- 上传 -->
      <div class="flex items-center justify-between gap-4">
        <div class="min-w-0">
          <div class="text-sm font-medium">上传数据</div>
          <div class="mt-0.5 text-xs text-neutral-400">
            将本地歌曲和播放列表备份到本地 AppData
          </div>
        </div>
        <el-button plain size="small" @click="openCredDialog('upload')">
          <template #icon><el-icon><Upload /></el-icon></template>
          上传
        </el-button>
      </div>

      <!-- 同步 -->
      <div class="flex items-center justify-between gap-4">
        <div class="min-w-0">
          <div class="text-sm font-medium">同步数据</div>
          <div class="mt-0.5 text-xs text-neutral-400">
            从备份恢复数据覆盖本地（需相同的用户名和密码）
          </div>
        </div>
        <el-button plain size="small" @click="openCredDialog('sync')">
          <template #icon><el-icon><Download /></el-icon></template>
          同步
        </el-button>
      </div>

      <!-- 备份信息 -->
      <div v-loading="backupLoading" class="rounded-lg bg-neutral-50 px-3 py-2.5 dark:bg-neutral-800/50">
        <template v-if="backupInfo && backupInfo.exists">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-xs font-semibold text-neutral-500">备份信息</span>
            <el-button
              text
              size="small"
              type="danger"
              title="删除备份文件"
              @click="onDeleteBackup"
            >
              <el-icon><Delete /></el-icon>
              删除备份
            </el-button>
          </div>
          <div class="space-y-1 text-xs text-neutral-500 dark:text-neutral-400">
            <div class="flex items-start gap-2">
              <span class="shrink-0 text-neutral-400">路径：</span>
              <span class="break-all font-mono text-neutral-600 dark:text-neutral-300" :title="backupInfo.path">
                {{ backupInfo.path }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <span class="shrink-0 text-neutral-400">大小：</span>
              <span class="text-neutral-600 dark:text-neutral-300">{{ formatSize(backupInfo.size) }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="shrink-0 text-neutral-400">时间：</span>
              <span class="text-neutral-600 dark:text-neutral-300">{{ formatTimestamp(backupInfo.uploadedAt) }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="shrink-0 text-neutral-400">加密：</span>
              <el-tag size="small" :type="backupInfo.encrypted ? 'warning' : 'info'" effect="plain">
                {{ backupInfo.encrypted ? '已加密' : '未加密' }}
              </el-tag>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="flex items-center justify-between">
            <span class="text-xs text-neutral-400">暂无备份，上传后将显示备份路径</span>
          </div>
        </template>
      </div>
    </div>
  </el-collapse-item>

  <el-dialog
    v-model="credVisible"
    :title="credMode === 'upload' ? '上传数据' : '同步数据'"
    width="360px"
    :close-on-click-modal="false"
    append-to-body
  >
    <el-form label-position="top" @submit.prevent>
      <el-form-item label="用户名">
        <el-input
          v-model="credUsername"
          placeholder="必填"
          @keyup.enter="onCredConfirm"
        />
      </el-form-item>
      <el-form-item label="密码">
        <el-input
          v-model="credPassword"
          type="password"
          show-password
          placeholder="选填（用于加密）"
          @keyup.enter="onCredConfirm"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="credVisible = false">取消</el-button>
      <el-button type="primary" :loading="credLoading" @click="onCredConfirm">
        确定
      </el-button>
    </template>
  </el-dialog>
</template>
