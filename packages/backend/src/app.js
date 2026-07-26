import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { browseRouter } from './routes/browse.js'
import { libraryRouter } from './routes/library.js'
import { audioRouter } from './routes/audio.js'
import { syncRouter } from './routes/sync.js'

// 静态资源目录：前端构建产物，位于当前模块同级 ./static
// 打包后（esbuild CJS 产物在根 dist/）即指向 dist/static
// 兼容两种运行模式：CJS 打包产物使用原生 __dirname；ESM 开发模式使用 import.meta.url
const STATIC_DIR = typeof __dirname !== 'undefined'
  ? path.resolve(__dirname, './static')
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), './static')

/**
 * 创建并装配 Express 应用
 * @returns {import('express').Express}
 */
export function createApp() {
  const app = express()

  // 中间件
  app.use(cors())
  app.use(express.json())

  // 路由挂载
  app.use('/api/browse', browseRouter)
  app.use('/api/library', libraryRouter)
  app.use('/api/sync', syncRouter)
  app.use('/api', audioRouter) // /api/audio、/api/cover

  // 健康检查
  app.get('/api/health', (_req, res) => res.json({ ok: true }))

  // 静态资源：托管前端构建产物（./static）
  app.use(express.static(STATIC_DIR))

  // SPA 回退：非 /api 的 GET 请求统一返回 index.html，交由前端路由处理
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.resolve(STATIC_DIR, 'index.html'))
    }
    next()
  })

  // 统一错误处理
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[backend] 请求出错:', err.message)
    res.status(err.status || 500).json({ error: err.message || '服务器内部错误' })
  })

  return app
}
