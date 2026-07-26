<script setup>
defineProps({
  icon: { type: String, default: 'Headset' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
})
defineEmits(['import'])
</script>

<template>
  <div class="flex flex-1 flex-col items-center justify-center gap-4 text-center">
    <div
      class="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100 text-neutral-300 dark:bg-neutral-800"
    >
      <el-icon :size="40"><component :is="icon" /></el-icon>
    </div>
    <div v-if="title || description">
      <p v-if="title" class="text-lg font-medium">{{ title }}</p>
      <p v-if="description" class="mt-1 text-sm text-neutral-400">{{ description }}</p>
    </div>
    <el-button type="primary" @click="$emit('import')">
      <template #icon><el-icon><FolderAdd /></el-icon></template>
      导入音乐
    </el-button>
  </div>
</template>
