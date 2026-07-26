<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 编辑模式：传入播放列表对象；新建模式：传 null */
  playlist: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'submit'])

const formRef = ref()
const form = ref({ name: '', sort: 1 })

const isEdit = computed(() => !!props.playlist)
const title = computed(() => (isEdit.value ? '编辑播放列表' : '新建播放列表'))

const rules = {
  name: [{ required: true, message: '请输入播放列表名称', trigger: 'blur' }],
}

// 弹窗打开时初始化表单
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    if (isEdit.value) {
      form.value = {
        name: props.playlist.name,
        sort: typeof props.playlist.sort === 'number' ? props.playlist.sort : 1,
      }
    } else {
      form.value = { name: '', sort: 1 }
    }
    formRef.value?.clearValidate()
  }
)

async function submit() {
  await formRef.value?.validate((valid) => {
    if (!valid) return
    emit('submit', {
      name: form.value.name.trim(),
      sort: Number(form.value.sort) || 1,
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
