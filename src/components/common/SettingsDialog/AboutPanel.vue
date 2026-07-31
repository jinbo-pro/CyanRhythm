<script setup>
import { ref, onMounted } from 'vue'
import { getVersion } from '@tauri-apps/api/app'
import { openUrl } from '@tauri-apps/plugin-opener'

const version = ref('')
const REPO_URL = 'https://github.com/jinbo-pro/CyanRhythm'
const RELEASES_URL = 'https://github.com/jinbo-pro/CyanRhythm/releases'

onMounted(async () => {
  try {
    version.value = await getVersion()
  } catch {
    version.value = ''
  }
})

/** 使用系统浏览器打开外部链接 */
function openLink(url) {
  openUrl(url).catch(() => {
    ElMessage.error('打开链接失败')
  })
}
</script>

<template>
  <!-- 关于 -->
  <el-collapse-item name="about" title="关于">
    <div class="space-y-4">
      <!-- 应用标识 -->
      <div class="flex flex-col items-center text-center">
        <div class="mt-3 text-base font-semibold">青律 CyanRhythm</div>
        <div v-if="version" class="mt-1 text-xs text-neutral-400">版本 {{ version }}</div>
      </div>

      <!-- 简介 -->
      <p class="text-xs leading-relaxed text-neutral-400">
        一款纯本地运行的桌面音乐播放器，无云端服务、不联网，没有广告与会员，让听歌回归纯粹。拯救你珍藏的本地音乐，还原一个干净优质的听歌环境。
      </p>

      <el-divider class="!my-2" />

      <!-- 链接 -->
      <div class="space-y-2">
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <div class="text-sm font-medium">GitHub 仓库</div>
            <div class="mt-0.5 text-xs text-neutral-400">查看源码、反馈问题</div>
          </div>
          <el-button plain size="small" @click="openLink(REPO_URL)">
            <template #icon><el-icon><Link /></el-icon></template>
            访问
          </el-button>
        </div>
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <div class="text-sm font-medium">下载最新版本</div>
            <div class="mt-0.5 text-xs text-neutral-400">前往 Releases 获取更新</div>
          </div>
          <el-button plain size="small" @click="openLink(RELEASES_URL)">
            <template #icon><el-icon><Download /></el-icon></template>
            下载
          </el-button>
        </div>
      </div>

      <el-divider class="!my-2" />

      <!-- 许可证 -->
      <div class="text-center text-xs text-neutral-400">
        开源协议 MIT License
      </div>
    </div>
  </el-collapse-item>
</template>
