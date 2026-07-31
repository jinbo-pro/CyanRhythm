/**
 * LRC 歌词解析工具
 */

// 时间标签正则：[mm:ss.xx] 或 [mm:ss] 或 [mm:ss:xx]
const TIME_TAG_RE = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g
// 元数据标签：[ti:][ar:][al:][by:][offset:][length:]
const META_TAG_RE = /^\[(ti|ar|al|by|offset|length):/i

/**
 * 解析 LRC 文本为歌词行数组
 * @param {string} lrcText LRC 原始文本
 * @returns {{ time: number, text: string }[]} 按时间升序排列的歌词行
 */
export function parseLRC(lrcText) {
  if (!lrcText) return []
  const lines = lrcText.split(/\r?\n/)
  const result = []
  for (const line of lines) {
    if (META_TAG_RE.test(line)) continue // 跳过 [ti:][ar:] 等元数据行
    TIME_TAG_RE.lastIndex = 0
    const tags = [...line.matchAll(TIME_TAG_RE)] // 一行可能含多个时间标签
    if (!tags.length) continue
    const text = line.replace(TIME_TAG_RE, '').trim()
    for (const tag of tags) {
      const min = parseInt(tag[1], 10)
      const sec = parseInt(tag[2], 10)
      const ms = tag[3] ? parseInt(tag[3].padEnd(3, '0'), 10) : 0
      result.push({ time: min * 60 + sec + ms / 1000, text })
    }
  }
  return result.sort((a, b) => a.time - b.time)
}

/**
 * 根据当前播放时间查找应高亮的行索引（二分查找，返回 <= currentTime 的最后一行）
 * @param {{ time: number, text: string }[]} lines 解析后的歌词行
 * @param {number} currentTime 当前播放时间（秒）
 * @returns {number} 高亮行索引，无歌词返回 -1
 */
export function findActiveIndex(lines, currentTime) {
  if (!lines.length) return -1
  let lo = 0
  let hi = lines.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].time <= currentTime) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans
}

/** 将秒数格式化为 LRC 时间标签 mm:ss.xxx */
function formatLRCTime(totalSec) {
  if (totalSec < 0) totalSec = 0
  const totalMs = Math.round(totalSec * 1000)
  const m = Math.floor(totalMs / 60000)
  const s = Math.floor((totalMs % 60000) / 1000)
  const ms = totalMs % 1000
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

/**
 * 将歌词行数组序列化为 LRC 文本（支持把时间偏移烘焙进时间轴）
 * @param {{ time: number, text: string }[]} lines 歌词行（time 单位：秒）
 * @param {number} [offsetMs=0] 要烘焙进时间轴的偏移量（毫秒），正数推迟、负数提前
 * @returns {string} LRC 格式文本
 */
export function buildLRC(lines, offsetMs = 0) {
  const offsetSec = offsetMs / 1000
  return lines
    .map((line) => `[${formatLRCTime(line.time + offsetSec)}]${line.text}`)
    .join('\n')
}
