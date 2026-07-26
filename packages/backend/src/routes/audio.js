import { Router } from 'express'
import fs from 'node:fs'
import { resolveAnyPath, isAbsolutePath } from '../config.js'
import { getCover } from '../services/metadata.js'

export const audioRouter = Router()

/**
 * GET /api/audio?file=relPath
 * 流式输出音频文件，支持 HTTP Range 请求（用于播放器进度拖拽/seek）
 */
audioRouter.get('/audio', (req, res, next) => {
  try {
    const filePath = req.query.file
    if (typeof filePath !== 'string' || !filePath) {
      return res.status(400).json({ error: '缺少 file 参数' })
    }
    if (!isAbsolutePath(filePath)) {
      return res.status(400).json({ error: 'file 参数必须是绝对路径' })
    }
    const abs = resolveAnyPath(filePath, 'file')
    fs.stat(abs, (err, stat) => {
      if (err || !stat.isFile()) {
        return res.status(404).json({ error: '文件不存在' })
      }
      const range = req.headers.range
      if (range) {
        // 处理 Range 请求
        const match = /bytes=(\d*)-(\d*)/.exec(range)
        if (match) {
          const start = match[1] ? parseInt(match[1], 10) : 0
          const end = match[2] ? parseInt(match[2], 10) : stat.size - 1
          const clampedEnd = Math.min(end, stat.size - 1)
          res.status(206)
          res.set({
            'Content-Range': `bytes ${start}-${clampedEnd}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': clampedEnd - start + 1,
            'Content-Type': 'application/octet-stream',
          })
          fs.createReadStream(abs, { start, end: clampedEnd }).pipe(res)
          return
        }
      }
      // 全量返回
      res.set({
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes',
        'Content-Type': 'application/octet-stream',
      })
      fs.createReadStream(abs).pipe(res)
    })
  } catch (e) {
    next(e)
  }
})

/**
 * GET /api/cover?file=relPath
 * 从音频元数据中提取并返回专辑封面图片
 */
audioRouter.get('/cover', async (req, res, next) => {
  try {
    const filePath = req.query.file
    if (typeof filePath !== 'string' || !filePath) {
      return res.status(400).json({ error: '缺少 file 参数' })
    }
    if (!isAbsolutePath(filePath)) {
      return res.status(400).json({ error: 'file 参数必须是绝对路径' })
    }
    const abs = resolveAnyPath(filePath, 'file')
    const cover = await getCover(abs)
    if (!cover) {
      return res.status(404).json({ error: '无封面' })
    }
    res.set('Content-Type', cover.format || 'image/jpeg')
    res.send(Buffer.from(cover.data))
  } catch (e) {
    next(e)
  }
})
