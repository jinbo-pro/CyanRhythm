import { openDB, deleteDB } from 'idb'

const DB_NAME = 'local-music'
const DB_VERSION = 1

/**
 * IndexedDB 数据库句柄（单例）
 * store 划分：
 *  - playlists：自定义播放列表（keyPath=id）
 *  - settings：播放器配置（key-value）
 *  - progress：播放进度
 *  - library：导入的歌曲列表（以单一 key 存储全部歌曲数组）
 *  - stats：播放统计（keyPath=id，记录每首歌的播放次数与累计时长）
 *  - lyrics：歌词缓存（keyPath=songId）
 */
let dbPromise = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('playlists', { keyPath: 'id' })
        db.createObjectStore('settings')
        db.createObjectStore('progress')
        db.createObjectStore('library')
        db.createObjectStore('stats', { keyPath: 'id' })
        db.createObjectStore('lyrics', { keyPath: 'songId' })
      },
    })
  }
  return dbPromise
}

/**
 * 清空所有 IndexedDB 数据：直接删除整个数据库
 * 用于「设置 → 清空所有数据」，清空后刷新页面即可恢复初始状态
 */
export async function clearAllData() {
  // 先关闭已缓存的数据库连接，否则浏览器会因连接未释放而阻塞删除
  if (dbPromise) {
    const db = await dbPromise
    db.close()
    dbPromise = null
  }
  await deleteDB(DB_NAME)
}
