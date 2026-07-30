import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

// ═══════════════════════════════════════════════
//  目录浏览
// ═══════════════════════════════════════════════

/**
 * 浏览目录树（供文件夹选择 UI）
 * @param {string} path 绝对路径，根目录传空字符串返回系统盘符列表
 * @returns {Promise<{path:string, dirs:Array<{name:string,path:string,hasSubdirs:boolean,quick?:boolean}>}>}
 */
export function browseDirectories(path = '') {
  return invoke('browse_directories', { path })
}

// ═══════════════════════════════════════════════
//  媒体库扫描
// ═══════════════════════════════════════════════

/**
 * 扫描指定目录下的音频文件并解析元数据（非流式，一次性返回）
 * @param {string} path 绝对路径
 * @returns {Promise<{total:number, songs:object[]}>}
 */
export function scanLibrary(path = '') {
  return invoke('scan_library', { path })
}

/**
 * 流式扫描目录（Tauri 事件）：实时回调扫描到的文件清单与解析进度
 *
 * Rust 端通过 `scan-event-{scanId}` 事件推送 files/progress 事件，
 * 命令完成后返回全部歌曲数据（done 事件由此函数从返回值构造）。
 *
 * @param {string} path 绝对路径（如 D:\\音乐）
 * @param {(msg:object)=>void|Promise<void>} onMessage 每条事件回调
 * @param {AbortSignal} [signal] 可选，用于取消扫描
 */
export async function scanLibraryStream(path = '', onMessage, signal) {
  const scanId = crypto.randomUUID()
  const eventName = `scan-event-${scanId}`

  // 监听扫描事件
  const unlisten = await listen(eventName, (event) => {
    onMessage(event.payload)
  })

  // 取消机制：abort 时通知 Rust 端停止
  if (signal) {
    signal.addEventListener(
      'abort',
      () => {
        invoke('cancel_scan', { scanId }).catch(() => {})
      },
      { once: true }
    )
  }

  try {
    const result = await invoke('scan_library_stream', { scanId, path })

    // 被取消：抛出 AbortError，与原 fetch + AbortController 行为一致
    if (result.cancelled || signal?.aborted) {
      const err = new Error('Aborted')
      err.name = 'AbortError'
      throw err
    }

    // done 事件：从命令返回值构造，确保 await onMessage 完成后再返回
    const ret = onMessage({ type: 'done', total: result.songs.length, songs: result.songs })
    if (ret && typeof ret.then === 'function') await ret
  } catch (e) {
    // 非取消类错误：通过 error 事件通知前端
    if (e?.name === 'AbortError') throw e
    onMessage({ type: 'error', message: e?.message || String(e) })
  } finally {
    unlisten()
  }
}

// ═══════════════════════════════════════════════
//  音频播放 & 封面
// ═══════════════════════════════════════════════

/**
 * 将本地音频文件路径转换为 webview 可直接加载的 URL（支持 Range/seek）
 * @param {string} filePath 音频文件的绝对路径
 * @returns {string}
 */
export function audioUrl(filePath) {
  return convertFileSrc(filePath)
}

/**
 * 异步获取专辑封面 data URL（兼容旧数据：IndexedDB 中未存 cover 字段的旧歌曲）
 * @param {string} filePath 音频文件的绝对路径
 * @returns {Promise<string|null>} base64 data URL 或 null
 */
export async function coverUrl(filePath) {
  try {
    return await invoke('get_cover_data_url', { filePath })
  } catch {
    return null
  }
}

// ═══════════════════════════════════════════════
//  文件详情（按需实时读取）
// ═══════════════════════════════════════════════

/**
 * 读取音频文件的详情（文件名、大小、创建/修改时间、扩展名）
 * 仅在用户主动点击「详情」时调用
 * @param {string} filePath 音频文件的绝对路径
 * @returns {Promise<{path:string,fileName:string,fileSize:number,createdAt:number|null,modifiedAt:number|null,extension:string}>}
 */
export function getFileInfo(filePath) {
  return invoke('get_file_info', { filePath })
}

// ═══════════════════════════════════════════════
//  歌词获取
// ═══════════════════════════════════════════════

/**
 * 获取歌词（Rust 端按 内嵌→本地.lrc→在线lrclib 优先级获取）
 * @param {object} song 歌曲对象
 * @returns {Promise<{source:string, syncedLyrics:string|null, plainLyrics:string|null}>}
 */
export function getLyrics(song) {
  return invoke('get_lyrics', {
    filePath: song.fileRelPath,
    title: song.title,
    artist: song.artist,
    album: song.album,
    duration: song.duration,
  })
}

// ═══════════════════════════════════════════════
//  健康检查（本地应用始终健康）
// ═══════════════════════════════════════════════

export function checkHealth() {
  return Promise.resolve({ ok: true })
}

// ═══════════════════════════════════════════════
//  数据同步（本地备份/恢复）
// ═══════════════════════════════════════════════

/**
 * 上传（备份）音乐数据到本地 AppData 目录
 * @param {File|Blob} file 数据文件
 * @param {string} username 用户名（必填）
 * @param {string} password 密码（选填，有则加密）
 * @returns {Promise<{ok:boolean, bucket:string, encrypted:boolean, size:number}>}
 */
export async function uploadSync(file, username, password) {
  // 读取文件为 base64（分块处理避免大文件栈溢出）
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, chunk)
  }
  const dataBase64 = btoa(binary)

  return invoke('sync_upload', { dataBase64, username, password })
}

/**
 * 从本地 AppData 目录同步（恢复）音乐数据
 * @param {string} username 用户名（必填）
 * @param {string} password 密码（选填）
 * @returns {Promise<object>} 解析后的 JSON 数据 { version, songs, playlists, stats, progress }
 */
export function downloadSync(username, password) {
  return invoke('sync_download', { username, password })
}

/**
 * 查询指定用户名的备份信息
 * @param {string} username 用户名（必填）
 * @returns {Promise<{exists:boolean, username:string, encrypted:boolean, uploadedAt:string, size:number, path:string}>}
 */
export function getBackupInfo(username) {
  return invoke('sync_get_backup_info', { username })
}

/**
 * 删除指定用户名的备份
 * @param {string} username 用户名（必填）
 * @returns {Promise<void>}
 */
export function deleteBackup(username) {
  return invoke('sync_delete_backup', { username })
}

/**
 * 获取当前系统用户名（用于上传弹窗默认填充）
 * @returns {Promise<string|null>}
 */
export function getCurrentUsername() {
  return invoke('get_current_username')
}
