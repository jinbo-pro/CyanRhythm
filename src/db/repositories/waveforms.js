import { getDB } from '../index.js'

/**
 * 波形热力图缓存仓储（IndexedDB: waveforms store）
 * 以 songId 为主键存储预渲染的整曲瞬时响度数据（Float32Array），
 * 打开播放详情页时直接读取，无需重新解码音频。
 */

/** 读取缓存的波形数据，不存在返回 null */
export async function getWaveformCache(songId) {
  const db = await getDB()
  return (await db.get('waveforms', songId)) || null
}

/**
 * 写入/更新波形缓存
 * @param {string} songId
 * @param {{ peaks: Float32Array, duration: number, version: number }} data
 */
export async function saveWaveformCache(songId, data) {
  const db = await getDB()
  await db.put('waveforms', { songId, ...data, createdAt: Date.now() })
}

/** 删除指定歌曲的波形缓存 */
export async function deleteWaveformCache(songId) {
  const db = await getDB()
  await db.delete('waveforms', songId)
}
