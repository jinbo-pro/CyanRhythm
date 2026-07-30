<script setup>
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings.js'

const emit = defineEmits(['close'])

const router = useRouter()
const settings = useSettingsStore()

/** 跳转到播放统计页 */
function goStats() {
  emit('close')
  router.push('/stats')
}

function onRefresh() {
  location.reload()
}
</script>

<template>
  <!-- 常规设置 -->
  <el-collapse-item name="general" title="常规">
    <div class="space-y-4">
      <!-- 播放统计入口 -->
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

      <el-divider class="!my-2" />

      <!-- 列表显示 -->
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
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <div class="text-sm font-medium">显示文件名</div>
            <div class="mt-0.5 text-xs text-neutral-400">
              在歌曲列表中显示文件名列，支持按文件名排序
            </div>
          </div>
          <el-switch v-model="settings.showFileName" @change="settings.persist()" />
        </div>
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <div class="text-sm font-medium">像素图标</div>
            <div class="mt-0.5 text-xs text-neutral-400">
              无封面的歌曲和专辑使用名称生成像素图标
            </div>
          </div>
          <el-switch v-model="settings.pixelIcon" @change="settings.persist()" />
        </div>
      </div>

      <el-divider class="!my-2" />

      <!-- 刷新页面 -->
      <div class="flex items-center justify-between gap-4">
        <div class="min-w-0">
          <div class="text-sm font-medium">刷新页面</div>
          <div class="mt-0.5 text-xs text-neutral-400">
            重新加载当前页面以应用变更或修复异常状态
          </div>
        </div>
        <el-button plain size="small" @click="onRefresh">
          <template #icon><el-icon><Refresh /></el-icon></template>
          刷新
        </el-button>
      </div>
    </div>
  </el-collapse-item>
</template>
