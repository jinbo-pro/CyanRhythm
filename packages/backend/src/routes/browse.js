import { Router } from 'express'
import { listDirectories } from '../services/scanner.js'
import { listSystemRoots, isAbsolutePath } from '../config.js'

export const browseRouter = Router()

/**
 * GET /api/browse?path=
 * - path 为空或不存在：返回系统盘符/根节点列表，供前端选择起点
 * - path 为绝对路径：列出该目录下的子目录
 * 供前端文件夹选择 UI 使用（支持浏览电脑任意目录）
 */
browseRouter.get('/', async (req, res, next) => {
  try {
    const rawPath = typeof req.query.path === 'string' ? req.query.path.trim() : ''

    if (!rawPath || !isAbsolutePath(rawPath)) {
      // 返回系统根节点（盘符 + 快捷入口）
      const dirs = await listSystemRoots()
      return res.json({ path: '', dirs })
    }

    const dirs = await listDirectories(rawPath)
    res.json({ path: rawPath, dirs })
  } catch (e) {
    next(e)
  }
})
