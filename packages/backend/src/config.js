import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

// 兼容打包（CJS）与未打包（ESM）两种运行模式：
// CJS 打包产物中 __dirname 为原生提供；ESM 开发模式需通过 import.meta.url 推导
const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url))

/**
 * 服务端口，优先级：
 * 1. 环境变量 PORT（显式指定，最高优先级）
 * 2. .port 文件（dev 脚本通过 get-port 自动写入）
 * 3. 默认 18080
 */
export const PORT = (() => {
  if (process.env.PORT) return Number(process.env.PORT)
  try {
    const portFile = path.resolve(_dirname, '../.port')
    const port = parseInt(fs.readFileSync(portFile, 'utf-8').trim(), 10)
    if (port > 0) return port
  } catch {
    /* .port 文件不存在（如直接运行 start），回退默认值 */
  }
  return 18080
})()

/**
 * 音乐根目录：作为"快捷入口"默认浏览起点（向后兼容）。
 * 优先读取环境变量 MUSIC_ROOT，否则使用系统默认音乐目录。
 * 注意：当前版本已支持浏览/导入电脑任意目录，此目录仅作为默认起点。
 */
export const MUSIC_ROOT = (function resolveMusicRoot() {
  const envRoot = process.env.MUSIC_ROOT
  if (envRoot) return path.resolve(envRoot)
  return path.join(os.homedir(), 'Music')
})()

/**
 * 【向后兼容】将相对路径解析为 MUSIC_ROOT 下的绝对路径。
 * 保留给历史调用方；新代码请使用 resolveAnyPath。
 * @param {string} relPath 相对于 MUSIC_ROOT 的路径，可为空（表示根目录）
 * @returns {string} 绝对路径
 */
export function resolveUnderRoot(relPath) {
  if (!relPath || relPath === '/' || relPath === '.') return MUSIC_ROOT
  const abs = path.resolve(MUSIC_ROOT, relPath)
  if (abs !== MUSIC_ROOT && !abs.startsWith(MUSIC_ROOT + path.sep)) {
    const err = new Error('非法路径：不能访问音乐根目录之外的文件')
    err.status = 403
    throw err
  }
  return abs
}

/**
 * 判断给定字符串是否为"绝对路径"形式。
 * 兼容 Windows 盘符路径（C:\、D:\）与 POSIX 绝对路径（/）。
 * @param {string} p
 * @returns {boolean}
 */
export function isAbsolutePath(p) {
  if (typeof p !== 'string' || !p) return false
  // path.isAbsolute 能识别 POSIX '/' 与 Windows 'C:\'
  return path.isAbsolute(p)
}

/**
 * 解析并校验"任意"绝对路径，允许访问电脑上的任意目录（满足"前端可选任意目录"需求）。
 * 纯本地应用，音频文件本身无害，故不再限定单一根目录，仅做基本合法性校验。
 * @param {string} absPath 任意绝对路径
 * @param {'dir'|'file'} [expect] 可选，期望类型；不传则只规范化不校验存在性
 * @returns {string} 规范化后的绝对路径
 */
export function resolveAnyPath(absPath, expect) {
  if (typeof absPath !== 'string' || !absPath.trim()) {
    const err = new Error('路径不能为空')
    err.status = 400
    throw err
  }
  // 规范化：合并 ../、多余分隔符等
  const norm = path.resolve(absPath)
  if (expect) {
    try {
      const stat = fs.statSync(norm)
      if (expect === 'dir' && !stat.isDirectory()) {
        const err = new Error('路径不是一个目录：' + norm)
        err.status = 400
        throw err
      }
      if (expect === 'file' && !stat.isFile()) {
        const err = new Error('路径不是一个文件：' + norm)
        err.status = 400
        throw err
      }
    } catch (e) {
      // stat 失败说明路径不存在，向上抛 404
      if (!e.status) {
        const err = new Error('路径不存在或无法访问：' + norm)
        err.status = 404
        throw err
      }
      throw e
    }
  }
  return norm
}

/**
 * 枚举系统可访问的"根节点"，供前端文件夹选择器作为起点。
 * - Windows：返回存在的盘符（如 C:\、D:\），外加用户主目录与默认音乐目录作为快捷入口
 * - POSIX：返回根 '/'，外加主目录与音乐目录
 * @returns {Promise<Array<{name:string, path:string, hasSubdirs:boolean, quick?:boolean}>>}
 */
export async function listSystemRoots() {
  const roots = []

  // 1. 快捷入口：主目录 + 默认音乐目录
  const home = os.homedir()
  roots.push({
    name: '主目录',
    path: home,
    hasSubdirs: true,
    quick: true,
  })
  if (path.resolve(MUSIC_ROOT) !== path.resolve(home)) {
    roots.push({
      name: '音乐文件夹',
      path: MUSIC_ROOT,
      hasSubdirs: true,
      quick: true,
    })
  }

  // 2. 系统盘符 / 根
  if (process.platform === 'win32') {
    // Windows：逐个探测盘符 C: ~ Z:
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    for (const letter of letters) {
      const drive = `${letter}:\\`
      try {
        const stat = fs.statSync(drive)
        if (stat.isDirectory()) {
          roots.push({ name: `${letter}: 盘`, path: drive, hasSubdirs: true })
        }
      } catch {
        // 盘符不可访问，跳过
      }
    }
  } else {
    // POSIX：根目录
    roots.push({ name: '/', path: '/', hasSubdirs: true })
  }

  return roots
}
