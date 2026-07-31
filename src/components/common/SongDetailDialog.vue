<script setup>
import { ref, watch } from 'vue'
import { getFileInfo, deleteAudioFile } from '@/api/index.js'
import { formatTime } from '@/composables/usePlayer.js'
import { confirmDelete, isCancelError } from '@/utils/common.js'
import { useLibraryStore } from '@/stores/library.js'
import { usePlaylistStore } from '@/stores/playlist.js'
import { usePlayerStore } from '@/stores/player.js'

const emit = defineEmits(['deleted'])

const props = defineProps({
  /** 当前歌曲对象（需包含 fileRelPath、duration 等字段） */
  song: { type: Object, default: null },
})

// 弹窗可见性（v-model）
const visible = defineModel({ type: Boolean, default: false })

const detailLoading = ref(false)
const detailInfo = ref(null)
const deleting = ref(false)

const library = useLibraryStore()
const playlistStore = usePlaylistStore()
const player = usePlayerStore()

/** 格式化文件大小（B / KB / MB / GB） */
function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
}

/** 格式化时间戳为本地可读字符串 */
function formatTimestamp(ts) {
  if (!ts) return '未知'
  return new Date(ts).toLocaleString()
}

/** 格式化时长（秒 → mm:ss 或 hh:mm:ss） */
function formatDuration(sec) {
  if (!sec) return '00:00'
  return formatTime(sec)
}

async function onDeleteFile() {
  if (!props.song?.fileRelPath || deleting.value) return
  const fileName = detailInfo.value?.fileName || props.song.title || props.song.fileRelPath
  try {
    await confirmDelete(
      `确定删除文件「${fileName}」？此操作会从磁盘中删除文件，且不可恢复。`,
      '删除文件'
    )
    deleting.value = true
    player.forgetSong(props.song.id)
    await deleteAudioFile(props.song.fileRelPath)
    await library.removeSong(props.song.id)
    await playlistStore.removeSongFromAll(props.song.id)
    ElMessage.success('文件已删除')
    visible.value = false
    emit('deleted', props.song)
  } catch (e) {
    if (!isCancelError(e)) {
      ElMessage.error('删除文件失败：' + (e?.message || e))
    }
  } finally {
    deleting.value = false
  }
}
// 弹窗打开时实时读取文件信息（点击触发，不在初始化时获取）
watch(visible, async (open) => {
  if (!open || !props.song) return
  detailLoading.value = true
  detailInfo.value = null
  try {
    detailInfo.value = await getFileInfo(props.song.fileRelPath)
  } catch (e) {
    console.error('[SongDetailDialog] 读取文件详情失败:', e)
  } finally {
    detailLoading.value = false
  }
})
</script>

<template>
  <el-dialog
    v-model="visible"
    title="歌曲详情"
    width="480px"
    :close-on-click-modal="true"
    append-to-body
    class="song-detail-dialog"
  >
    <div v-loading="detailLoading" class="min-h-[120px]">
      <template v-if="detailInfo">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="标题">
            {{ song?.title || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="艺术家">
            {{ song?.artist || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="专辑">
            {{ song?.album || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="时长">
            {{ formatDuration(song?.duration) }}
          </el-descriptions-item>
          <el-descriptions-item label="文件名">
            {{ detailInfo.fileName }}
          </el-descriptions-item>
          <el-descriptions-item label="文件路径">
            <span class="break-all text-xs leading-5">{{ detailInfo.path }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="文件大小">
            {{ formatFileSize(detailInfo.fileSize) }}
          </el-descriptions-item>
          <el-descriptions-item label="格式">
            {{ detailInfo.extension || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatTimestamp(detailInfo.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="修改时间">
            {{ formatTimestamp(detailInfo.modifiedAt) }}
          </el-descriptions-item>
        </el-descriptions>
      </template>
      <el-empty
        v-else-if="!detailLoading"
        description="读取文件信息失败"
        :image-size="64"
      />
    </div>
    <template #footer>
      <div class="flex items-center justify-between gap-2">
        <el-button
          type="danger"
          plain
          :loading="deleting"
          :disabled="!song || detailLoading"
          @click="onDeleteFile"
        >
          <template #icon><el-icon><Delete /></el-icon></template>
          删除文件
        </el-button>
        <el-button type="primary" @click="visible = false">关闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>
