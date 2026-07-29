<script setup>
import { computed, ref, watch } from 'vue'
import PlaylistIcon from './PlaylistIcon.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 编辑模式：传入播放列表对象；新建模式：传 null */
  playlist: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'submit'])

const formRef = ref()
const form = ref({ name: '', sort: 1, iconType: 'pixel', iconValue: '' })

const isEdit = computed(() => !!props.playlist)
const title = computed(() => (isEdit.value ? '编辑播放列表' : '新建播放列表'))

const rules = {
  name: [{ required: true, message: '请输入播放列表名称', trigger: 'blur' }],
}

/** 生成随机种子（用于像素图标的初始值） */
function randomSeed() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)
}

/** 编辑器中的实时预览对象 */
const previewPlaylist = computed(() => ({
  icon: {
    type: form.value.iconType,
    value: form.value.iconValue,
  },
}))

// 弹窗打开时初始化表单
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    if (isEdit.value && props.playlist.icon) {
      form.value = {
        name: props.playlist.name,
        sort: typeof props.playlist.sort === 'number' ? props.playlist.sort : 1,
        iconType: props.playlist.icon.type || 'pixel',
        iconValue: props.playlist.icon.value || '',
      }
      // 如果编辑的是像素模式但值为空，补充随机种子
      if (form.value.iconType === 'pixel' && !form.value.iconValue) {
        form.value.iconValue = randomSeed()
      }
      // 如果编辑的是纯色模式但值为空，给默认色
      if (form.value.iconType === 'color' && !form.value.iconValue) {
        form.value.iconValue = '#2c7be5'
      }
    } else if (isEdit.value) {
      // 编辑模式但原列表无图标：默认像素 + 随机种子
      form.value = {
        name: props.playlist.name,
        sort: typeof props.playlist.sort === 'number' ? props.playlist.sort : 1,
        iconType: 'pixel',
        iconValue: randomSeed(),
      }
    } else {
      // 新建模式：默认像素 + 随机种子
      form.value = { name: '', sort: 1, iconType: 'pixel', iconValue: randomSeed() }
    }
    formRef.value?.clearValidate()
  }
)

/** 切换图标类型时，确保对应模式有初始值 */
function onTypeChange(type) {
  if (type === 'pixel' && !form.value.iconValue) {
    form.value.iconValue = randomSeed()
  }
  if (type === 'color' && !form.value.iconValue) {
    form.value.iconValue = '#2c7be5'
  }
}

async function submit() {
  await formRef.value?.validate((valid) => {
    if (!valid) return
    emit('submit', {
      name: form.value.name.trim(),
      sort: Number(form.value.sort) || 1,
      icon: {
        type: form.value.iconType,
        value: form.value.iconValue,
      },
    })
    emit('update:modelValue', false)
  })
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="420px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      @submit.prevent
    >
      <el-form-item label="名称" prop="name" required>
        <el-input
          v-model="form.name"
          placeholder="请输入播放列表名称"
          maxlength="50"
          clearable
          @keyup.enter="submit"
        />
      </el-form-item>

      <!-- 图标选择 -->
      <el-form-item label="图标">
        <div class="w-full">
          <el-radio-group
            v-model="form.iconType"
            @change="onTypeChange"
          >
            <el-radio-button value="pixel">像素</el-radio-button>
            <el-radio-button value="color">纯色</el-radio-button>
          </el-radio-group>

          <div class="mt-3 flex items-center gap-3">
            <!-- 实时预览 -->
            <div class="flex shrink-0 items-center justify-center">
              <PlaylistIcon :playlist="previewPlaylist" :size="40" />
            </div>

            <!-- 像素模式：输入框 + 随机按钮 -->
            <template v-if="form.iconType === 'pixel'">
              <el-input
                v-model="form.iconValue"
                placeholder="输入字符生成图标"
                maxlength="50"
                clearable
                class="flex-1"
              />
              <el-button text circle title="随机生成" @click="form.iconValue = randomSeed()">
                <el-icon :size="16"><Refresh /></el-icon>
              </el-button>
            </template>

            <!-- 纯色模式：颜色选择器 -->
            <template v-else>
              <el-color-picker v-model="form.iconValue" />
              <span class="text-xs text-neutral-400">{{ form.iconValue }}</span>
            </template>
          </div>
        </div>
      </el-form-item>

      <el-form-item label="排序">
        <div>
          <el-input-number v-model="form.sort" :min="1" :step="1" />
          <div class="mt-1 text-xs text-neutral-400">数字越小越靠前，相同数字按创建时间排序</div>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="submit">{{ isEdit ? '保存' : '创建' }}</el-button>
    </template>
  </el-dialog>
</template>
