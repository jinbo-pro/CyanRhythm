<script setup>
import { ref, onBeforeUnmount } from 'vue'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'

defineProps({
  /** 待裁剪图片的 data URL */
  image: { type: String, default: '' },
})

const emit = defineEmits(['cropped'])

const visible = defineModel({ type: Boolean, default: false })

const imgRef = ref(null)
let cropper = null

/** 弹窗打开动画结束后初始化 cropper（确保容器已有尺寸） */
function initCropper() {
  destroyCropper()
  if (!imgRef.value) return
  cropper = new Cropper(imgRef.value, {
    aspectRatio: 1, // 封面固定 1:1
    viewMode: 1,
    dragMode: 'move',
    autoCropArea: 1,
    background: false,
  })
}

function destroyCropper() {
  cropper?.destroy()
  cropper = null
}

/** 旋转 90 度 */
function rotate() {
  cropper?.rotate(90)
}

/** 重置裁剪框 */
function reset() {
  cropper?.reset()
}

/** 确认裁剪，输出 data URL */
function confirm() {
  if (!cropper) return
  const canvas = cropper.getCroppedCanvas({
    maxWidth: 1024,
    maxHeight: 1024,
    imageSmoothingQuality: 'high',
  })
  emit('cropped', canvas.toDataURL('image/jpeg', 0.92))
  visible.value = false
}

onBeforeUnmount(destroyCropper)
</script>

<template>
  <el-dialog
    v-model="visible"
    title="裁剪封面"
    width="520px"
    :close-on-click-modal="false"
    append-to-body
    @opened="initCropper"
    @closed="destroyCropper"
  >
    <div class="h-[360px] w-full overflow-hidden bg-neutral-900">
      <img ref="imgRef" :src="image" alt="crop" class="block max-w-full" />
    </div>

    <template #footer>
      <div class="flex items-center justify-between">
        <div>
          <el-button @click="rotate">
            <el-icon><RefreshRight /></el-icon>
            <span class="ml-1">旋转</span>
          </el-button>
          <el-button @click="reset">重置</el-button>
        </div>
        <div>
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" @click="confirm">确认</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>
