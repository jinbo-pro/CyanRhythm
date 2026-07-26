import { getDB } from '../index.js'

/**
 * 播放器配置仓储（IndexedDB: settings store）
 * 以单一 key 'app' 存储整个配置对象
 */
const SETTINGS_KEY = 'app'

/** 读取全部配置 */
export async function loadSettings() {
  const db = await getDB()
  return (await db.get('settings', SETTINGS_KEY)) || {}
}

/** 保存全部配置 */
export async function saveSettings(settings) {
  const db = await getDB()
  await db.put('settings', settings, SETTINGS_KEY)
}
