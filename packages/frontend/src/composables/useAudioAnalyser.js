import { Howler } from 'howler'
import { getAnalyserTarget, registerAnalyser } from './useEqualizer.js'

/**
 * WebAudio 频谱分析器模块
 *
 * 核心原理：
 * 本项目 Howler 使用 html5 模式（流式播放），音频通过 HTMLAudioElement 直接输出，
 * 不经过 Howler 的 WebAudio 图（Howler.masterGain）。
 * 因此需要通过 createMediaElementSource 将 <audio> 元素接入 WebAudio 分析链路：
 *
 *   HTMLAudioElement → MediaElementSource → AnalyserNode → ctx.destination
 *
 * 注意：一旦对某个 audio 元素调用 createMediaElementSource，该元素的音频输出
 * 将完全路由到 WebAudio 图，必须将 AnalyserNode 连接到 destination 才能听到声音。
 */

let analyser = null
let dataArray = null

/** 记录已连接的 audio 元素，避免重复创建 MediaElementSource（每个元素只能创建一次） */
const connectedNodes = new WeakSet()

/** 懒加载创建 AnalyserNode（仅创建一次，全局共享） */
function ensureAnalyser() {
  if (analyser) return analyser
  const ctx = Howler.ctx
  if (!ctx) return null

  analyser = ctx.createAnalyser()
  analyser.fftSize = 256 // → frequencyBinCount = 128 个频段
  analyser.smoothingTimeConstant = 0.85 // 时域平滑，让柱状图更柔和
  analyser.minDecibels = -80
  analyser.maxDecibels = -10
  dataArray = new Uint8Array(analyser.frequencyBinCount)
  // analyser → EQ链/destination 只连接一次，后续所有 source 都汇入同一个 analyser
  // 若 EQ 已启用，则经滤波器链再汇入 destination；否则直连
  const target = getAnalyserTarget() || ctx.destination
  analyser.connect(target)
  // 注册到 EQ 模块，以便后续切换 EQ 开关时能重路由
  registerAnalyser(analyser)
  return analyser
}

/**
 * 将一个 HTMLAudioElement 接入分析链路
 * @param {HTMLAudioElement} audioEl
 * @returns {boolean} 是否成功连接
 */
export function connectAudioNode(audioEl) {
  if (!audioEl) return false
  const ctx = Howler.ctx
  if (!ctx) return false

  // 浏览器自动播放策略：需在用户手势后恢复 AudioContext
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }

  const an = ensureAnalyser()
  if (!an) return false

  // 同一元素只连接一次
  if (connectedNodes.has(audioEl)) return true
  connectedNodes.add(audioEl)

  try {
    const source = ctx.createMediaElementSource(audioEl)
    source.connect(an)
    return true
  } catch (e) {
    console.warn('[analyser] 接入音频节点失败:', e)
    return false
  }
}

/**
 * 获取当前频域数据（0~255 的 Uint8Array）
 * @returns {Uint8Array | null}
 */
export function getFrequencyData() {
  if (!analyser) return null
  analyser.getByteFrequencyData(dataArray)
  return dataArray
}

/** 获取频段数量 */
export function getFrequencyBinCount() {
  return analyser ? analyser.frequencyBinCount : 0
}
