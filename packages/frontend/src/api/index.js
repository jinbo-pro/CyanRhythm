import axios from 'axios'

// 统一的 axios 实例，baseUrl 留空（通过 vite proxy 转发到后端）
const http = axios.create({
  baseURL: '',
  timeout: 60000,
})

/**
 * 浏览目录树（供文件夹选择 UI）
 * @param {string} path 相对 MUSIC_ROOT 的目录路径，根目录传空字符串
 * @returns {Promise<{path:string, dirs:Array<{name:string,path:string,hasSubdirs:boolean}>}>}
 */
export function browseDirectories(path = '') {
  return http
    .get('/api/browse', { params: { path } })
    .then((res) => res.data)
}

/**
 * 扫描指定目录下的音频文件并解析元数据
 * @param {string} path 相对 MUSIC_ROOT 的目录路径
 * @returns {Promise<{total:number, songs:object[]}>}
 */
export function scanLibrary(path = '') {
  return http
    .post('/api/library/scan', { path })
    .then((res) => res.data)
}

/**
 * 流式扫描目录（SSE）：实时回调扫描到的文件清单与解析进度
 * @param {string} path 绝对路径（如 D:\\音乐）
 * @param {(msg:object)=>void} onMessage 每条事件回调：{type:'files'|'progress'|'done'|'error', ...}
 * @param {AbortSignal} [signal] 可选，用于取消扫描
 */
export async function scanLibraryStream(path = '', onMessage, signal) {
  const resp = await fetch('/api/library/scan-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
    signal,
  })

  if (!resp.ok) {
    let msg = `扫描失败（HTTP ${resp.status}）`
    try {
      const data = await resp.json()
      if (data?.error) msg = data.error
    } catch {
      /* 响应体非 JSON，忽略 */
    }
    throw new Error(msg)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  // 持续读取响应流，按 SSE 帧分隔符 "\n\n" 拆分解析
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let sep
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const raw = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      // 仅取 data: 行（忽略 event:/id:/注释行）
      const dataLine = raw
        .split('\n')
        .map((l) => l.replace(/\r$/, ''))
        .find((l) => l.startsWith('data:'))
      if (!dataLine) continue
      try {
        const parsed = JSON.parse(dataLine.slice(5).trim())
        // 若回调返回 Promise（如 done 事件需入库），等待其完成再继续读流
        const ret = onMessage(parsed)
        if (ret && typeof ret.then === 'function') await ret
      } catch {
        /* 单条事件解析失败跳过，不中断整体流 */
      }
    }
  }
}

/** 拼接音频流地址（Howler 直接消费） */
export function audioUrl(fileRelPath) {
  return `/api/audio?file=${encodeURIComponent(fileRelPath)}`
}

/** 拼接专辑封面地址 */
export function coverUrl(fileRelPath) {
  return `/api/cover?file=${encodeURIComponent(fileRelPath)}`
}

/** 后端健康检查 */
export function checkHealth() {
  return http.get('/api/health').then((res) => res.data)
}

/**
 * 上传音乐数据文件到服务器
 * @param {File|Blob} file 数据文件
 * @param {string} username 用户名（必填）
 * @param {string} password 密码（选填，有则服务端加密）
 * @returns {Promise<{ok:boolean, bucket:string, encrypted:boolean, size:number}>}
 */
export function uploadSync(file, username, password) {
  const form = new FormData()
  form.append('file', file)
  form.append('username', username)
  if (password) form.append('password', password)
  return http
    .post('/api/sync/upload', form, { timeout: 120000 })
    .then((res) => res.data)
}

/**
 * 从服务器同步（下载）音乐数据
 * @param {string} username 用户名（必填）
 * @param {string} password 密码（选填）
 * @returns {Promise<object>} 解析后的 JSON 数据 { version, songs, playlists }
 */
export function downloadSync(username, password) {
  return http
    .get('/api/sync/download', {
      params: { username, password },
      timeout: 120000,
    })
    .then((res) => res.data)
}
