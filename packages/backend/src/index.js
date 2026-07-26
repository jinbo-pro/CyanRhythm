import fs from 'node:fs'
import { createApp } from './app.js'
import { PORT, MUSIC_ROOT } from './config.js'

// 启动前确保音乐根目录存在
if (!fs.existsSync(MUSIC_ROOT)) {
  try {
    fs.mkdirSync(MUSIC_ROOT, { recursive: true })
  } catch {
    // 创建失败不阻断启动，仅提示
  }
}

const app = createApp()

app.listen(PORT, () => {
  console.log('========================================')
  console.log('  本地音乐播放器 - 后端服务已启动')
  console.log(`  地址: http://localhost:${PORT}`)
  console.log(`  音乐根目录: ${MUSIC_ROOT}`)
  console.log('========================================')
})
