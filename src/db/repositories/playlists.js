import { getDB } from '../index.js'

/**
 * 自定义播放列表仓储（IndexedDB: playlists store）
 */

/** 获取全部播放列表 */
export async function getAllPlaylists() {
  const db = await getDB()
  return db.getAll('playlists')
}

/** 获取单个播放列表 */
export async function getPlaylist(id) {
  const db = await getDB()
  return db.get('playlists', id)
}

/** 新增或更新播放列表 */
export async function savePlaylist(playlist) {
  const db = await getDB()
  await db.put('playlists', playlist)
  return playlist
}

/** 删除播放列表 */
export async function deletePlaylist(id) {
  const db = await getDB()
  await db.delete('playlists', id)
}

/**
 * 批量替换全部播放列表（先清空再写入）
 * 用于从导出文件导入播放列表数据
 */
export async function replaceAllPlaylists(playlists) {
  const db = await getDB()
  const tx = db.transaction('playlists', 'readwrite')
  await tx.store.clear()
  for (const pl of playlists) {
    await tx.store.put(pl)
  }
  await tx.done
}
