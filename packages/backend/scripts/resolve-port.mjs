/**
 * 端口解析脚本：在前后端启动前运行。
 * 1. 使用 get-port 寻找一个可用端口（优先 18080）
 * 2. 将端口写入前端 .env.local（供 Vite proxy 使用）
 * 3. 将端口写入后端 .port（供后端 config.js 读取）
 *
 * 用法：node scripts/resolve-port.mjs
 */
import getPort from 'get-port'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(backendRoot, '../..')

const preferredPort = Number(process.env.PORT) || 18080
const port = await getPort({ port: preferredPort })

// 写入前端环境变量（Vite 自动加载 .env.local）
const frontendEnvPath = path.resolve(projectRoot, 'packages/frontend/.env.local')
fs.writeFileSync(frontendEnvPath, `VITE_BACKEND_PORT=${port}\n`)

// 写入后端端口文件（config.js 读取）
const portFilePath = path.resolve(backendRoot, '.port')
fs.writeFileSync(portFilePath, String(port))

console.log(`[resolve-port] 后端可用端口: ${port}`)
