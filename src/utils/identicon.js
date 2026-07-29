import Identicon from 'identicon.js'

/**
 * cyrb53 哈希算法（同步，轻量）
 * 返回两个 32 位哈希拼接的 16 位十六进制字符串，
 * 满足 identicon.js 对 hash ≥15 字符的要求
 * @param {string} str 输入字符串
 * @param {number} [seed=0] 种子（同输入不同种子 → 不同输出）
 * @returns {string} 16 位 hex 字符串
 */
export function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')
}

/**
 * 根据任意字符串生成 identicon 像素图标 data URL（同步）
 * @param {string} str 用于生成图标的字符串
 * @param {object} [opts] 可选配置
 * @param {number} [opts.size=64] 图标像素尺寸
 * @returns {string|null} SVG data URL，失败返回 null
 */
export function generateIdenticon(str, opts = {}) {
  if (!str) return null
  try {
    const hash = cyrb53(str)
    const base64 = new Identicon(hash, {
      size: opts.size || 64,
      margin: 0.08,
      format: 'svg',
      background: [240, 240, 240, 0], // 透明背景，适配深浅主题
    }).toString()
    return 'data:image/svg+xml;base64,' + base64
  } catch {
    return null
  }
}
