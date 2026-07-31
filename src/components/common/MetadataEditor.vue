<script setup>
import { ref, watch, computed } from 'vue'
import { updateMetadata, coverUrl, getEmbeddedLyrics, fetchOnlineLyrics } from '@/api/index.js'
import { deleteLyricsCache } from '@/db/repositories/lyrics.js'
import { eventBus, EVENTS } from '@/utils/eventBus.js'
import CoverCropper from './CoverCropper.vue'
import { clickUploadFile, readFile } from '@/utils/common.js'

const props = defineProps({
  /** 当前编辑的歌曲对象 */
  song: { type: Object, default: null },
})

const emit = defineEmits(['saved'])

const visible = defineModel({ type: Boolean, default: false })

const form = ref({
  title: '',
  artist: '',
  album: '',
  albumArtist: '',
  year: '',
  lyrics: '',
})

// 封面 data URL（预览 + 写入用）；coverChanged 标记是否被用户修改过
const coverData = ref('')
const coverChanged = ref(false)
// 弹窗打开时的初始歌词，用于保存时判断歌词是否被修改（决定是否刷新歌词缓存）
const originalLyrics = ref('')

const saving = ref(false)
const coverLoading = ref(false)
const fileInputRef = ref(null)

// 裁剪弹窗：cropSource 为待裁剪图片的 data URL
const cropperVisible = ref(false)
const cropSource = ref('')

const hasCover = computed(() => !!coverData.value)

// 弹窗打开时初始化表单 + 异步加载封面
watch(visible, async (open) => {
  if (!open || !props.song) return
  form.value = {
    title: props.song.title || '',
    artist: props.song.artist || '',
    album: props.song.album || '',
    albumArtist: props.song.albumArtist || '',
    year: props.song.year ? String(props.song.year) : '',
    lyrics: '',
  }
  coverData.value = ''
  coverChanged.value = false

  // 封面：优先用内嵌 cover，否则从文件提取
  if (props.song.cover) {
    coverData.value = props.song.cover
  } else if (props.song.hasCover) {
    coverLoading.value = true
    try {
      coverData.value = (await coverUrl(props.song.fileRelPath)) || ''
    } catch {
      coverData.value = ''
    } finally {
      coverLoading.value = false
    }
  }

  // 歌词：仅加载内嵌歌词供编辑（不触发在线请求）
  form.value.lyrics = (await getEmbeddedLyrics(props.song.fileRelPath)) || ''
  originalLyrics.value = form.value.lyrics
})

/** 文件选择 */
async function pickCover() {
  const [file] = await clickUploadFile(false, 'image/jpeg,image/png,image/webp')
  cropSource.value = await readFile(file, 'readAsDataURL')
  cropperVisible.value = true
}

/** 重新裁剪当前封面 */
function recropCover() {
  if (!coverData.value) return
  cropSource.value = coverData.value
  cropperVisible.value = true
}

/** 裁剪完成，应用为新封面 */
function onCropped(dataUrl) {
  coverData.value = dataUrl
  coverChanged.value = true
}

// 在线歌词获取
const lyricsFetching = ref(false)

/** 尝试从 lrclib 在线获取歌词并填充（使用表单中的标题/艺术家，支持用户修正后重试） */
async function fetchLyrics() {
  if (!props.song || lyricsFetching.value) return
  lyricsFetching.value = true
  try {
    const r = await fetchOnlineLyrics({
      title: form.value.title.trim() || props.song.title,
      artist: form.value.artist.trim() || props.song.artist,
      album: form.value.album.trim() || props.song.album,
      duration: props.song.duration,
    })
    const text = r?.syncedLyrics || r?.plainLyrics || ''
    if (text) {
      form.value.lyrics = text
      ElMessage.success('已获取在线歌词，保存后写入文件')
    } else {
      ElMessage.warning('未找到匹配的在线歌词')
    }
  } catch (e) {
    console.error('[MetadataEditor] 在线歌词获取失败:', e)
    ElMessage.error('在线歌词获取失败，请检查网络')
  } finally {
    lyricsFetching.value = false
  }
}

async function pickLyricsFile() {
  const [file] = await clickUploadFile(false, '.lrc,.txt,text/plain')
  const text = await readFile(file, 'readAsText')
  form.value.lyrics = text
}

/** 移除封面 */
function removeCover() {
  coverData.value = ''
  coverChanged.value = true
}

/** 保存元数据 */
async function save() {
  if (!props.song || saving.value) return
  saving.value = true
  try {
    const updated = await updateMetadata({
      filePath: props.song.fileRelPath,
      title: form.value.title.trim() || null,
      artist: form.value.artist.trim() || null,
      album: form.value.album.trim() || null,
      albumArtist: form.value.albumArtist.trim() || null,
      year: form.value.year.trim() || null,
      lyrics: form.value.lyrics.trim() || null,
      // 仅在用户修改了封面时发送，避免无意义的重写
      coverBase64: coverChanged.value ? coverData.value || null : null,
    })
    emit('saved', updated)
    // 歌词被修改时，清除缓存并通知歌词面板重新加载
    // （useLyrics 以 id 为依赖且命中旧缓存，id 不变不会自动刷新）
    if (form.value.lyrics !== originalLyrics.value) {
      await deleteLyricsCache(updated.id)
      eventBus.emit(EVENTS.LYRICS_UPDATED, updated.id)
    }
    visible.value = false
  } catch (e) {
    console.error('[MetadataEditor] 保存失败:', e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="编辑音乐信息"
    width="560px"
    :close-on-click-modal="false"
    append-to-body
    class="metadata-editor"
  >
    <div v-if="song" class="flex gap-5">
      <!-- 封面区域 -->
      <div class="flex shrink-0 flex-col items-center gap-2">
        <div
          class="group relative flex h-[160px] w-[160px] cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800"
          @click="pickCover"
        >
          <img
            v-if="hasCover"
            :src="coverData"
            alt="cover"
            class="h-full w-full object-cover"
          />
          <div v-loading="coverLoading" class="flex h-full w-full items-center justify-center">
            <el-icon v-if="!hasCover && !coverLoading" :size="40" class="text-neutral-400">
              <Picture />
            </el-icon>
          </div>
          <!-- 悬浮提示 -->
          <div
            class="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            <el-icon :size="20"><Refresh /></el-icon>
            <span class="ml-1">更换封面</span>
          </div>
        </div>
        <div v-if="hasCover" class="flex gap-1">
          <el-button text size="small" @click="recropCover">裁剪</el-button>
          <el-button text size="small" type="danger" @click="removeCover">
            移除封面
          </el-button>
        </div>
      </div>

      <!-- 表单区域 -->
      <el-form :model="form" label-position="top" class="flex-1">
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="歌曲标题" clearable />
        </el-form-item>
        <el-form-item label="艺术家">
          <el-input v-model="form.artist" placeholder="艺术家" clearable />
        </el-form-item>
        <el-form-item label="专辑">
          <el-input v-model="form.album" placeholder="专辑名称" clearable />
        </el-form-item>
        <div class="flex gap-3">
          <el-form-item label="专辑艺术家" class="flex-1">
            <el-input v-model="form.albumArtist" placeholder="专辑艺术家" clearable />
          </el-form-item>
          <el-form-item label="年份" style="width: 120px">
            <el-input v-model="form.year" placeholder="如 2024" clearable />
          </el-form-item>
        </div>
      </el-form>
    </div>

    <!-- 歌词编辑 -->
    <el-form v-if="song" :model="form" label-position="top" class="mt-2">
      <el-form-item>
        <template #label>
          <div class="flex w-full items-center justify-between">
            <span>歌词</span>
            <div class="flex items-center gap-1">
              <el-button
                text
                size="small"
                type="primary"
                :loading="lyricsFetching"
                @click="fetchLyrics"
              >
                <el-icon v-if="!lyricsFetching"><Download /></el-icon>
                <span class="ml-1">获取在线歌词</span>
              </el-button>
              <el-button
                text
                size="small"
                type="primary"
                @click="pickLyricsFile"
              >
                <el-icon><Upload /></el-icon>
                <span class="ml-1">上传歌词文件</span>
              </el-button>
            </div>
          </div>
        </template>
        <el-input
          v-model="form.lyrics"
          type="textarea"
          :rows="5"
          placeholder="输入或粘贴歌词文本（支持 LRC 时间标签）"
          resize="vertical"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </template>

    <!-- 封面裁剪弹窗 -->
    <CoverCropper
      v-model="cropperVisible"
      :image="cropSource"
      @cropped="onCropped"
    />
  </el-dialog>
</template>
