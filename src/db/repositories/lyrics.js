import { getDB } from '../index.js'

/**
 * 歌词缓存仓储（IndexedDB: lyrics store）
 * 以 songId 为主键存储歌词原文、来源、偏移量
 */

/** 读取缓存的歌词（含偏移量），不存在返回 null */
export async function getLyricsCache(songId) {
  const db = await getDB()
  return (await db.get('lyrics', songId)) || null
}

/**
 * 写入/更新歌词缓存
 * @param {string} songId
 * @param {{ source:string, syncedLyrics:string|null, plainLyrics:string|null, offset?:number }} data
 */
export async function saveLyricsCache(songId, data) {
  const db = await getDB()
  await db.put('lyrics', { songId, ...data, fetchedAt: Date.now() })
}

/** 仅更新某首歌的歌词时间偏移量（毫秒） */
export async function updateLyricsOffset(songId, offset) {
  const db = await getDB()
  const rec = await db.get('lyrics', songId)
  if (rec) {
    rec.offset = offset
    await db.put('lyrics', rec)
  }
}
