import { getDB } from '../index.js'

/**
 * 媒体库歌曲列表仓储（IndexedDB: library store）
 * 以单一 key 'songs' 存储全部歌曲数组（结构化数据，刷新后可恢复）
 */
const SONGS_KEY = 'songs'

/** 读取全部歌曲 */
export async function loadSongs() {
  const db = await getDB()
  return (await db.get('library', SONGS_KEY)) || []
}

/** 保存全部歌曲（需调用方去除 Vue 响应式） */
export async function saveSongs(songs) {
  const db = await getDB()
  await db.put('library', songs, SONGS_KEY)
}

/** 清空歌曲 */
export async function clearSongs() {
  const db = await getDB()
  await db.put('library', [], SONGS_KEY)
}
