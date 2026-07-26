import { Router } from 'express'
import path from 'node:path'
import { scanAudioFiles } from '../services/scanner.js'
import { parseAudioMetadata } from '../services/metadata.js'
import { resolveAnyPath, isAbsolutePath } from '../config.js'

export const libraryRouter = Router()

/** 校验扫描路径，返回规范化后的绝对路径；非法则抛出可识别错误 */
function assertScanPath(scanPath) {
  if (!isAbsolutePath(scanPath)) {
    const err = new Error('请提供有效的文件夹绝对路径')
    err.status = 400
    throw err
  }
  return resolveAnyPath(scanPath, 'dir')
}

/**
 * POST /api/library/scan
 * body: { path } 任意绝对路径（如 D:\音乐、E:\songs）
 * 递归扫描并解析该目录下的全部音频文件元数据
 */
libraryRouter.post('/scan', async (req, res, next) => {
  try {
    const { path: scanPath = '' } = req.body || {}
    const absDir = assertScanPath(scanPath)
    const files = await scanAudioFiles(absDir)

    // 限制并发数解析，避免大量文件同时打开导致内存/句柄压力
    const songs = []
    const concurrency = Math.min(8, files.length || 1)
    let cursor = 0
    async function worker() {
      while (cursor < files.length) {
        const abs = files[cursor++]
        try {
          // fileRelPath 直接存储绝对路径，供 audio/cover 接口使用
          songs.push(await parseAudioMetadata(abs, abs))
        } catch {
          // 单个文件解析失败则跳过，不阻断整体
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker))

    res.json({ total: songs.length, songs })
  } catch (e) {
    next(e)
  }
})

/**
 * 将单条消息以 SSE（Server-Sent Events）格式写入响应流
 * @param {import('express').Response} res
 * @param {object} data
 */
function sseSend(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

/**
 * POST /api/library/scan-stream
 * body: { path } 任意绝对路径
 * 流式扫描：先递归发现全部音频文件并上报清单，再并发解析元数据、逐个上报进度，最后回传入库结果。
 * 前端通过 fetch + ReadableStream 消费该 SSE 流，实时渲染进度弹窗。
 */
libraryRouter.post('/scan-stream', async (req, res, next) => {
  let headersSent = false
  try {
    const { path: scanPath = '' } = req.body || {}
    const absDir = assertScanPath(scanPath)

    // 开启 SSE
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // 关闭代理缓冲，确保实时推送
    res.flushHeaders?.()
    headersSent = true

    /** 响应连接关闭（客户端中途断开）时停止后续工作。
     *  注意：必须监听 res 的 close，而非 req 的 close——
     *  req 的 close 在请求体读取完成时就会触发，会误判为客户端断开。 */
    let aborted = false
    res.on('close', () => {
      aborted = true
    })

    // 1. 递归扫描文件清单
    const files = await scanAudioFiles(absDir)
    // 相对路径更便于前端展示（去掉冗长的公共前缀）；根目录文件回退为文件名
    const relFiles = files.map((f) => {
      const rel = path.relative(absDir, f)
      return rel || path.basename(f)
    })
    sseSend(res, { type: 'files', total: files.length, files: relFiles })

    if (aborted) return res.end()

    // 2. 限制并发解析，逐个上报进度
    const songs = []
    const concurrency = Math.min(8, files.length || 1)
    let cursor = 0
    let doneCount = 0
    async function worker() {
      while (!aborted && cursor < files.length) {
        const abs = files[cursor++]
        const rel = path.relative(absDir, abs) || path.basename(abs)
        let ok = true
        try {
          songs.push(await parseAudioMetadata(abs, abs))
        } catch {
          ok = false // 单个解析失败不阻断整体
        }
        doneCount += 1
        if (!aborted) sseSend(res, { type: 'progress', index: doneCount, file: rel, ok })
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker))

    if (aborted) return // 客户端已断开，无需再写入

    // 3. 完成：回传入库所需的全量歌曲数据
    sseSend(res, { type: 'done', total: songs.length, songs })
    res.end()
  } catch (e) {
    if (!headersSent) {
      // 流尚未开始，走常规 JSON 错误
      next(e)
    } else {
      // 流已开启，以 error 事件通知前端后正常结束
      sseSend(res, { type: 'error', message: e?.message || '服务器内部错误' })
      res.end()
    }
  }
})
