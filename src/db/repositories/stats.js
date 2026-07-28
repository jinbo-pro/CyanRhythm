import { getDB } from '../index.js'

/**
 * 播放统计仓储（IndexedDB: stats store）
 * 以歌曲 id 为主键，记录每首歌的播放次数与累计播放时长
 */

/** 读取全部播放统计 */
export async function getAllStats() {
  const db = await getDB()
  return (await db.getAll('stats')) || []
}

/**
 * 累加某首歌的播放统计；若不存在则新建
 * @param {string} id 歌曲唯一标识（id）
 * @param {{playCount?: number, playDuration?: number, song?: object}} delta
 */
export async function addStat(id, { playCount = 0, playDuration = 0, song = null } = {}) {
  if (!id) return
  const db = await getDB()
  const tx = db.transaction('stats', 'readwrite')
  const store = tx.objectStore('stats')
  const existing = await store.get(id)
  const record = existing || {
    id,
    playCount: 0,
    playDuration: 0,
    title: song?.title || '未知歌曲',
    artist: song?.artist || '未知艺术家',
    album: song?.album || '未知专辑',
    cover: song?.cover || null,
    lastPlayedAt: 0,
  }
  record.playCount += playCount
  record.playDuration += playDuration
  if (playCount > 0) record.lastPlayedAt = Date.now()
  // 歌曲信息随最新播放更新（便于名称变更后仍可识别）
  if (song) {
    record.title = song.title || record.title
    record.artist = song.artist || record.artist
    record.album = song.album || record.album
    record.cover = song.cover ?? record.cover
  }
  await store.put(record)
  await tx.done
}

/** 清空全部统计 */
export async function clearStats() {
  const db = await getDB()
  await db.clear('stats')
}

/**
 * 批量替换全部播放统计（先清空再写入）
 * 用于从同步数据恢复统计
 */
export async function replaceAllStats(stats) {
  const db = await getDB()
  const tx = db.transaction('stats', 'readwrite')
  await tx.store.clear()
  for (const s of stats) {
    await tx.store.put(s)
  }
  await tx.done
}
