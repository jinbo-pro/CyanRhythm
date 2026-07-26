import fs from 'node:fs/promises'
import path from 'node:path'
import { isAudioFile } from '../utils/audioFormats.js'
import { resolveAnyPath } from '../config.js'

/**
 * 递归扫描目录下所有受支持的音频文件
 * @param {string} absPath 任意绝对路径
 * @returns {Promise<string[]>} 绝对路径数组
 */
export async function scanAudioFiles(absPath) {
  const absDir = resolveAnyPath(absPath, 'dir')
  const results = []

  async function walk(dir) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return // 无权限或不存在，跳过该目录
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.isFile() && isAudioFile(entry.name)) {
        results.push(full)
      }
    }
  }

  await walk(absDir)
  return results
}

/**
 * 列出指定目录下的子目录（供前端文件夹选择 UI 使用）。
 * path 为空时由调用方（路由）返回系统盘符列表。
 * @param {string} absPath 任意绝对路径
 * @returns {Promise<Array<{name:string, path:string, hasSubdirs:boolean}>>}
 */
export async function listDirectories(absPath) {
  const absDir = resolveAnyPath(absPath, 'dir')
  let entries
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true })
  } catch {
    const err = new Error('目录不存在或无法访问')
    err.status = 404
    throw err
  }

  const dirs = entries.filter((e) => e.isDirectory())
  // 并发判断每个子目录是否还含有子目录（用于前端展开箭头展示）
  return Promise.all(
    dirs.map(async (d) => {
      const full = path.join(absDir, d.name)
      let hasSubdirs = false
      try {
        const sub = await fs.readdir(full, { withFileTypes: true })
        hasSubdirs = sub.some((s) => s.isDirectory())
      } catch {
        hasSubdirs = false
      }
      return {
        name: d.name,
        path: full, // 返回绝对路径，前端可直接继续浏览
        hasSubdirs,
      }
    })
  )
}
