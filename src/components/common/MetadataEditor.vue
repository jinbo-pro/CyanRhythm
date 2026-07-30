<script setup>
import { ref, watch, computed } from 'vue'
import { updateMetadata, coverUrl, getEmbeddedLyrics } from '../../api/index.js'

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

const saving = ref(false)
const coverLoading = ref(false)
const fileInputRef = ref(null)

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
})

/** 触发文件选择 */
function pickCover() {
  fileInputRef.value?.click()
}

/** 文件选择后读取为 data URL */
function onCoverFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    coverData.value = reader.result
    coverChanged.value = true
  }
  reader.readAsDataURL(file)
  // 清空 input 的 value，允许重复选择同一文件
  e.target.value = ''
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
        <el-button
          v-if="hasCover"
          text
          size="small"
          type="danger"
          @click="removeCover"
        >
          移除封面
        </el-button>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="hidden"
          @change="onCoverFile"
        />
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
      <el-form-item label="歌词">
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
  </el-dialog>
</template>
