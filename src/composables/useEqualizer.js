import { Howler } from 'howler'

/**
 * EQ 均衡器模块（Web Audio API BiquadFilter 链）
 *
 * 音频图：
 *   MediaElementSource → AnalyserNode → [EQ 滤波器链] → ctx.destination
 *
 * 当 EQ 启用时，AnalyserNode 的输出从直连 destination 切换为
 * 经过多段 BiquadFilter 滤波器链再汇入 destination；
 * 关闭时恢复直连，实现零损耗旁路。
 *
 * 设计要点：
 * - 滤波器链懒创建，仅在使用 EQ 时才建立
 * - 即使 AudioContext/Analyser 尚未就绪，也能保存期望状态（desiredGains），
 *   待 analyser 注册时统一应用
 */

/** 标准 10 段 EQ 中心频率（Hz） */
export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

/** 频率展示标签 */
export const EQ_LABELS = ['31', '62', '125', '250', '500', '1K', '2K', '4K', '8K', '16K']

/** 预设方案 */
export const EQ_PRESETS = {
  flat: { name: '平坦', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  pop: { name: '流行', gains: [-1, 1, 3, 4, 2, 0, -1, -1, 1, 2] },
  rock: { name: '摇滚', gains: [5, 4, 2, 0, -1, -1, 2, 3, 4, 4] },
  jazz: { name: '爵士', gains: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3] },
  classical: { name: '古典', gains: [4, 3, 2, 2, -1, -1, 0, 2, 3, 4] },
  bass: { name: '重低音', gains: [7, 6, 5, 3, 1, 0, 0, 0, 0, 0] },
  treble: { name: '高音增强', gains: [0, 0, 0, 0, 0, 2, 4, 5, 6, 6] },
  vocal: { name: '人声', gains: [-2, -1, 0, 2, 4, 4, 3, 2, 0, -1] },
}

// ===== 模块级状态（不进入 Vue 响应式，与 analyser 模块保持一致） =====
let filters = []
let inputNode = null // EQ 链入口 GainNode
let outputNode = null // EQ 链出口 GainNode
let analyserRef = null // 由 useAudioAnalyser 注册的 AnalyserNode 引用

// 期望状态：即使 AudioContext 尚未就绪也能缓存，待就绪后统一应用
let desiredEnabled = false
let desiredGains = EQ_BANDS.map(() => 0)

/**
 * 懒加载创建 EQ 滤波器链（仅创建一次）
 * 链路：inputNode → filter[0] → filter[1] → ... → filter[N-1] → outputNode → destination
 */
function ensureChain() {
  if (filters.length) return
  const ctx = Howler.ctx
  if (!ctx) return

  inputNode = ctx.createGain()
  outputNode = ctx.createGain()

  filters = EQ_BANDS.map((freq, i) => {
    const f = ctx.createBiquadFilter()
    // 首段用 lowshelf、末段用 highshelf，中间用 peaking
    if (i === 0) f.type = 'lowshelf'
    else if (i === EQ_BANDS.length - 1) f.type = 'highshelf'
    else f.type = 'peaking'
    f.frequency.value = freq
    f.Q.value = 1.0
    f.gain.value = desiredGains[i] || 0
    return f
  })

  // 串联滤波器
  inputNode.connect(filters[0])
  for (let i = 0; i < filters.length - 1; i++) {
    filters[i].connect(filters[i + 1])
  }
  filters[filters.length - 1].connect(outputNode)
  outputNode.connect(ctx.destination)
}

/**
 * 根据 enabled 状态重新路由 analyser 的输出
 * - 启用：analyser → inputNode → filters → outputNode → destination
 * - 禁用：analyser → destination
 */
function routeAnalyser() {
  if (!analyserRef) return
  const ctx = Howler.ctx
  if (!ctx) return
  try {
    analyserRef.disconnect()
    if (desiredEnabled) {
      ensureChain()
      analyserRef.connect(inputNode)
    } else {
      analyserRef.connect(ctx.destination)
    }
  } catch (e) {
    console.warn('[eq] 路由切换失败:', e)
  }
}

/**
 * 由 useAudioAnalyser 在创建 AnalyserNode 后调用，
 * 注册引用并立即应用当前 EQ 状态
 * @param {AnalyserNode} node
 */
export function registerAnalyser(node) {
  analyserRef = node
  routeAnalyser()
}

/**
 * 返回 analyser 应连接的目标节点（用于初始创建时的路由）
 * @returns {AudioNode | null}
 */
export function getAnalyserTarget() {
  const ctx = Howler.ctx
  if (!ctx) return null
  if (!desiredEnabled) return ctx.destination
  ensureChain()
  return inputNode || ctx.destination
}

/** 获取当前是否启用 */
export function isEnabled() {
  return desiredEnabled
}

/** 启用/禁用 EQ，立即重路由 */
export function setEnabled(val) {
  desiredEnabled = val
  routeAnalyser()
}

/** 设置某一频段增益（dB） */
export function setBandGain(index, db) {
  desiredGains[index] = db
  if (filters[index]) filters[index].gain.value = db
}

/** 批量应用增益数组 */
export function applyGains(gainsArr) {
  desiredGains = [...gainsArr]
  gainsArr.forEach((db, i) => {
    if (filters[i]) filters[i].gain.value = db
  })
}
