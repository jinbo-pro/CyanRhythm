/**
 * 项目根目录打包脚本：
 * 1. 打包前端（vite build → packages/frontend/dist）
 * 2. 将前端 dist 复制到后端 static 目录（packages/backend/static）
 * 3. 使用 esbuild 打包后端代码 → 项目根目录 dist/server.cjs（CJS 格式，原生兼容 express 等 CommonJS 依赖）
 * 4. 将静态资源复制到 dist/static，使根目录 dist 成为自包含的可运行产物
 *
 * 用法：node scripts/build.mjs
 */
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const frontendDir = path.join(projectRoot, 'packages', 'frontend')
const backendDir = path.join(projectRoot, 'packages', 'backend')
const distDir = path.join(projectRoot, 'dist')

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true })
}

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true })
}

function step(msg) {
  console.log('\n[build] ' + msg)
}

async function main() {
  // 1. 打包前端
  step('打包前端 (vite build)...')
  execSync('pnpm --filter @local-music/frontend build', {
    stdio: 'inherit',
    cwd: projectRoot,
    shell: process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : true,
  })

  const frontendDist = path.join(frontendDir, 'dist')
  if (!fs.existsSync(frontendDist)) {
    throw new Error('前端构建产物不存在：' + frontendDist)
  }

  // 2. 复制前端 dist 到后端 static 目录
  step('复制前端产物到后端 static 目录...')
  const backendStatic = path.join(backendDir, 'static')
  rmrf(backendStatic)
  copyDir(frontendDist, backendStatic)

  // 3. 使用 esbuild 打包后端 → 项目根目录 dist
  // 采用 CJS 格式：express/body-parser 等 CommonJS 依赖在 ESM 产物中会触发
  // “Dynamic require of ... is not supported”运行时错误，CJS 原生支持 require 更稳妥。
  step('esbuild 打包后端 → dist/server.cjs ...')
  rmrf(distDir)
  fs.mkdirSync(distDir, { recursive: true })
  await build({
    entryPoints: [path.join(backendDir, 'src', 'index.js')],
    bundle: true,
    minify: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    outfile: path.join(distDir, 'server.cjs'),
    logLevel: 'info',
    // 屏蔽 "import.meta" 在 CJS 产物中不可用的警告（empty-import-meta）。
    // 该警告对本项目是误报：后端源码用 `typeof __dirname !== 'undefined'` 做了运行时分支，
    // CJS 产物中 __dirname 恒存在，引用 import.meta.url 的分支是永不执行的死代码。
    logOverride: { 'empty-import-meta': 'silent' },
    banner: {
      js: '// 本地音乐播放器 - 后端打包产物（由 esbuild 生成，请勿手动编辑）',
    },
  })

  // 4. 复制静态资源到 dist/static，保证 dist 自包含可运行
  step('复制静态资源到 dist/static ...')
  copyDir(backendStatic, path.join(distDir, 'static'))

  step('完成 ✅ 打包产物位于 ./dist')
  console.log('      启动方式：node dist/server.cjs')
}

main().catch((err) => {
  console.error('\n[build] 打包失败:', err)
  process.exit(1)
})
