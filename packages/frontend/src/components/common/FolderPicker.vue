<script setup>
import { ref, watch, computed } from 'vue'
import { browseDirectories } from '../../api/index.js'
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'select'])

const currentPath = ref('') // 空字符串表示"此电脑"（盘符列表）
const dirs = ref([])
const loading = ref(false)
const manualInput = ref('')

/** 加载指定层级的目录列表；path 为空时返回系统盘符 */
async function load(path = '') {
  loading.value = true
  try {
    const data = await browseDirectories(path)
    currentPath.value = data.path
    dirs.value = data.dirs
    manualInput.value = data.path
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || '浏览目录失败')
  } finally {
    loading.value = false
  }
}

watch(
  () => props.modelValue,
  (v) => {
    if (v) load(currentPath.value || '')
  }
)

/** 将绝对路径拆分为面包屑分段（兼容 Windows 盘符与 POSIX 路径） */
function pathSegments(p) {
  if (!p) return []
  const winRoot = /^([a-zA-Z]:)([\\/])?/.exec(p)
  if (winRoot) {
    const drive = winRoot[1]
    const rootPath = drive + '\\'
    const list = [{ name: drive, path: rootPath }]
    const rest = p.slice(winRoot[0].length)
    const segs = rest.split(/[\\/]/).filter(Boolean)
    let acc = drive
    for (const s of segs) {
      acc = acc + '\\' + s
      list.push({ name: s, path: acc })
    }
    return list
  }
  if (p.startsWith('/')) {
    const list = [{ name: '/', path: '/' }]
    const segs = p.split('/').filter(Boolean)
    let acc = ''
    for (const s of segs) {
      acc = acc + '/' + s
      list.push({ name: s, path: acc })
    }
    return list
  }
  return [{ name: p, path: p }]
}

const crumbs = computed(() => {
  const list = [{ name: '此电脑', path: '' }]
  return list.concat(pathSegments(currentPath.value))
})

/** 向上一级 */
function goUp() {
  const segs = pathSegments(currentPath.value)
  if (segs.length <= 1) load('')
  else load(segs[segs.length - 2].path)
}

function enterManual() {
  const p = manualInput.value.trim()
  if (!p) return
  load(p)
}

function confirm() {
  emit('select', currentPath.value)
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="选择要导入的音乐文件夹"
    width="680px"
    top="8vh"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <!-- 工具栏：返回上级 + 面包屑 -->
    <div class="mb-3 flex items-center gap-2">
      <el-button size="small" :disabled="!currentPath || loading" @click="goUp">
        <template #icon><el-icon><Back /></el-icon></template>
        上一级
      </el-button>
      <el-breadcrumb separator="/">
        <el-breadcrumb-item
          v-for="(c, i) in crumbs"
          :key="c.path"
          @click="load(c.path)"
        >
          <span :class="i === crumbs.length - 1 ? 'font-medium text-itunes-blue' : 'cursor-pointer'">
            {{ c.name }}
          </span>
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <!-- 手动输入路径 -->
    <div class="mb-3 flex items-center gap-2">
      <el-input
        v-model="manualInput"
        size="small"
        placeholder="输入或粘贴文件夹路径，如 D:\音乐，回车进入"
        @keyup.enter="enterManual"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-button size="small" type="primary" plain @click="enterManual">进入</el-button>
    </div>

    <!-- 目录列表 -->
    <div v-loading="loading" class="h-[45vh] overflow-y-auto rounded-lg border border-neutral-100 dark:border-neutral-700">
      <div v-if="!loading && dirs.length === 0" class="flex h-full items-center justify-center text-sm text-neutral-400">
        <el-empty description="该目录下没有子文件夹" :image-size="80" />
      </div>
      <div
        v-for="d in dirs"
        :key="d.path"
        class="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
        @click="load(d.path)"
      >
        <el-icon :size="18" :class="d.quick ? 'text-purple-500' : 'text-itunes-blue'">
          <Folder />
        </el-icon>
        <span class="flex-1 truncate">{{ d.name }}</span>
        <el-tag v-if="d.quick" size="small" type="info" effect="plain">快捷</el-tag>
        <el-icon v-if="d.hasSubdirs" :size="14" class="text-neutral-400"><ArrowRight /></el-icon>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between">
        <div class="min-w-0 flex-1 truncate text-xs text-neutral-400 flex items-center">
          当前选择：<span class="text-neutral-600 dark:text-neutral-300">{{ currentPath || '（请先进入某个文件夹）' }}</span>
        </div>
        <div class="flex gap-2">
          <el-button @click="emit('update:modelValue', false)">取消</el-button>
          <el-button type="primary" :disabled="!currentPath" @click="confirm">导入此文件夹</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>
