import { getDB } from '../index.js'

/**
 * 播放进度仓储（IndexedDB: progress store）
 * 只记录"上次播放"一条
 */
const PROGRESS_KEY = 'last'

/** 读取上次播放进度 */
export async function loadProgress() {
  const db = await getDB()
  return (await db.get('progress', PROGRESS_KEY)) || null
}

/** 保存播放进度 */
export async function saveProgress(progress) {
  const db = await getDB()
  await db.put('progress', progress, PROGRESS_KEY)
}
