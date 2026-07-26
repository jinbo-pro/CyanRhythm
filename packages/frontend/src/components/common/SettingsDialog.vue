<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSettingsStore, SHORTCUT_ACTIONS, SHORTCUT_LABELS } from '../../stores/settings.js'
import ShortcutInput from './ShortcutInput.vue'
import { loadSongs, saveSongs } from '../../db/repositories/library.js'
import {
  getAllPlaylists,
  replaceAllPlaylists,
} from '../../db/repositories/playlists.js'
import { clearAllData } from '../../db/index.js'
import { getAllStats, replaceAllStats } from '../../db/repositories/stats.js'
import { loadProgress, saveProgress } from '../../db/repositories/progress.js'
import { uploadSync, downloadSync } from '../../api/index.js'

const visible = defineModel({ type: Boolean, default: false })

const router = useRouter()
const settings = useSettingsStore()

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

// 凭证弹窗状态
const credVisible = ref(false)
const credMode = ref('upload') // 'upload' | 'sync'
const credUsername = ref('')
const credPassword = ref('')
const credLoading = ref(false)

/** 打开凭证弹窗，自动填充已保存的用户名密码 */
function openCredDialog(mode) {
  credMode.value = mode
  const saved = loadCred()
  credUsername.value = saved.username || ''
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
/** 跳转到播放统计页 */
function goStats() {
  visible.value = false
  router.push('/stats')
}

// 快捷键配置
const shortcutActions = Object.values(SHORTCUT_ACTIONS)
const shortcutLabels = SHORTCUT_LABELS

/** 某个快捷键变更时：冲突检测后写入 store（自动持久化与重绑） */
function onShortcutChange(action, combo) {
  // 冲突检测：同一组合不能绑定到多个动作
  const conflict = shortcutActions.find(
    (a) => a !== action && settings.shortcuts[a] === combo
  )
  if (conflict) {
    ElMessage.warning(`该快捷键已用于「${shortcutLabels[conflict]}」，请换一个`)
    return
  }
  settings.setShortcut(action, combo)
}
</script>

<template>
  <el-drawer
    v-model="visible"
    title="设置"
    direction="ltr"
    size="400px"
    :close-on-click-modal="false"
    append-to-body
  >
    <div class="space-y-6 py-2">
      <!-- 播放统计入口 -->
      <section>
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <div class="text-sm font-medium">播放统计</div>
            <div class="mt-0.5 text-xs text-neutral-400">
              查看按歌曲统计的播放时长与播放次数
            </div>
          </div>
          <el-button plain size="small" @click="goStats">
            <template #icon><el-icon><DataLine /></el-icon></template>
            查看
          </el-button>
        </div>
      </section>

      <!-- 快捷键 -->
      <section>
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-neutral-500">快捷键</h3>
          <el-button text size="small" @click="settings.resetShortcuts()">重置默认</el-button>
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
              :model-value="settings.shortcuts[action]"
              @update:model-value="onShortcutChange(action, $event)"
            />
          </div>
        </div>
      </section>

      <!-- 列表显示 -->
      <section>
        <h3 class="mb-3 text-sm font-semibold text-neutral-500">列表显示</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <div class="text-sm font-medium">显示封面</div>
              <div class="mt-0.5 text-xs text-neutral-400">
                在歌曲列表中显示专辑封面缩略图
              </div>
            </div>
            <el-switch v-model="settings.showCover" @change="settings.persist()" />
          </div>
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <div class="text-sm font-medium">显示专辑列</div>
              <div class="mt-0.5 text-xs text-neutral-400">
                在歌曲列表中显示专辑信息
              </div>
            </div>
            <el-switch v-model="settings.showAlbum" @change="settings.persist()" />
          </div>
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <div class="text-sm font-medium">显示序号</div>
              <div class="mt-0.5 text-xs text-neutral-400">
                在歌曲列表中显示序号（当前播放时显示音浪图标）
              </div>
            </div>
            <el-switch v-model="settings.showIndex" @change="settings.persist()" />
          </div>
        </div>
      </section>

      <!-- 数据同步 -->
      <section>
        <h3 class="mb-3 text-sm font-semibold text-neutral-500">数据同步</h3>
        <div class="space-y-3">
          <!-- 上传 -->
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <div class="text-sm font-medium">上传数据</div>
              <div class="mt-0.5 text-xs text-neutral-400">
                将本地歌曲和播放列表上传到服务器备份
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
                从服务器拉取数据覆盖本地（需相同的用户名和密码）
              </div>
            </div>
            <el-button plain size="small" @click="openCredDialog('sync')">
              <template #icon><el-icon><Download /></el-icon></template>
              同步
            </el-button>
          </div>
        </div>
      </section>

      <!-- 危险操作 -->
      <section>
        <h3 class="mb-3 text-sm font-semibold text-red-400">危险操作</h3>
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
      </section>
    </div>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-drawer>

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
