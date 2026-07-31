import { audioUrl } from '@/api/index.js'
import { getWaveformCache, saveWaveformCache } from '@/db/repositories/waveforms.js'
import { getAudioContext } from './useAudioAnalyser.js'

/**
 * 波形热力图模块（B 站风格高低潮波形）
 *
 * 原理：
 *  1. 复用全局共享的 AudioContext（Howler.ctx，与频谱可视化 / 10 段 EQ 同一上下文），
 *     调用其 decodeAudioData 将整曲解码为 PCM 样本——这是 Web Audio API 原生能力，
 *     不引入任何重型解码库。
 *  2. 将 PCM 样本按时间均分为固定数量的桶，每桶取 RMS（均方根）代表该段瞬时响度，
 *     直观区分低潮 / 副歌高潮。
 *  3. 预渲染结果（Float32Array）缓存到 IndexedDB（waveforms store），
 *     再次打开详情页直接读取，无需重新解码。
 */

/** 波形桶数（渲染时按宽度二次降采样，桶越多越平滑） */
export const WAVEFORM_BUCKETS = 1000

/** 缓存版本号：算法变更时递增，使旧缓存失效 */
const CACHE_VERSION = 1

/** 每桶最多参与计算的样本数（超大文件下子采样以保持响应速度） */
const MAX_SAMPLES_PER_BUCKET = 2048

/**
 * 从 AudioBuffer 计算各桶 RMS 峰值并归一化
 * @param {AudioBuffer} audioBuffer
 * @param {number} buckets
 * @returns {Float32Array} 0~1 归一化响度数组
 */
function computePeaks(audioBuffer, buckets) {
  const channels = audioBuffer.numberOfChannels
  const length = audioBuffer.length
  const peaks = new Float32Array(buckets)

  // 收集各声道数据（getChannelData 返回的 Float32Array 会被复用，禁止修改）
  const channelData = []
  for (let c = 0; c < channels; c++) channelData.push(audioBuffer.getChannelData(c))

  const blockSize = Math.max(1, Math.floor(length / buckets))
  const step = Math.max(1, Math.ceil(blockSize / MAX_SAMPLES_PER_BUCKET))

  for (let i = 0; i < buckets; i++) {
    const start = i * blockSize
    const end = Math.min(start + blockSize, length)
    let sumSq = 0
    let count = 0
    for (let j = start; j < end; j += step) {
      // 混音：取各声道平均值
      let sample = 0
      for (let c = 0; c < channels; c++) sample += channelData[c][j]
      sample /= channels
      sumSq += sample * sample
      count++
    }
    peaks[i] = count > 0 ? Math.sqrt(sumSq / count) : 0
  }

  // 归一化到 [0,1]
  let max = 0
  for (let i = 0; i < buckets; i++) if (peaks[i] > max) max = peaks[i]
  if (max > 0) {
    for (let i = 0; i < buckets; i++) peaks[i] /= max
  }

  // 感知曲线：略微提升低响度段可见度，同时保留高低潮对比度
  for (let i = 0; i < buckets; i++) peaks[i] = Math.pow(peaks[i], 0.7)

  return peaks
}

/**
 * 获取指定歌曲的波形数据（优先读缓存，否则解码并缓存）
 * @param {{ id:string, fileRelPath:string }} song
 * @param {object} [opts]
 * @param {number} [opts.buckets=WAVEFORM_BUCKETS]
 * @returns {Promise<{ peaks: Float32Array, duration: number }>}
 */
export async function buildWaveform(song, opts = {}) {
  const buckets = opts.buckets ?? WAVEFORM_BUCKETS

  // 1. 命中缓存直接返回（桶数 / 版本需匹配）
  const cached = await getWaveformCache(song.id)
  if (
    cached &&
    cached.version === CACHE_VERSION &&
    cached.peaks &&
    cached.peaks.length === buckets
  ) {
    return { peaks: cached.peaks, duration: cached.duration }
  }

  // 2. 解码：复用全局共享 AudioContext
  const ctx = getAudioContext()
  if (!ctx) throw new Error('AudioContext 尚未就绪')

  const url = audioUrl(song.fileRelPath)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`音频文件获取失败: ${res.status}`)
  const arrayBuffer = await res.arrayBuffer()

  // decodeAudioData 会消耗 ArrayBuffer，传副本以兼容回调式实现
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))

  // 3. 计算 RMS 并缓存
  const peaks = computePeaks(audioBuffer, buckets)
  const duration = audioBuffer.duration
  await saveWaveformCache(song.id, { peaks, duration, version: CACHE_VERSION })

  return { peaks, duration }
}
