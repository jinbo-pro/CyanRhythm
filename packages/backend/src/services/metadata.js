import { parseFile } from 'music-metadata'
import crypto from 'node:crypto'
import path from 'node:path'

/**
 * 根据相对路径生成稳定的 16 位 id
 * @param {string} relPath 相对路径
 * @returns {string}
 */
function hashId(relPath) {
  return crypto.createHash('sha1').update(relPath).digest('hex').slice(0, 16)
}

/**
 * 解析单个音频文件的元数据（使用成熟库 music-metadata，不手写解析）
 * @param {string} absPath 绝对路径
 * @param {string} relPath 相对 MUSIC_ROOT 的路径（用作 id）
 * @returns {Promise<object>} 标准化后的歌曲对象
 */
export async function parseAudioMetadata(absPath, relPath) {
  const fileName = path.basename(absPath, path.extname(absPath))

  let metadata
  try {
    metadata = await parseFile(absPath, { duration: true })
  } catch {
    return {
      id: hashId(relPath),
      title: fileName,
      artist: '未知艺术家',
      albumArtist: '未知艺术家',
      album: '未知专辑',
      duration: 0,
      year: null,
      hasCover: false,
      cover: null,
      fileRelPath: relPath,
    }
  }

  const common = metadata.common
  const picture = common.picture && common.picture[0]

  // 封面转 base64 data URL，随歌曲对象一起返回并持久化到 IndexedDB
  // 这样前端刷新后直接从本地读取，无需再请求 /api/cover
  let cover = null
  if (picture) {
    const base64 = Buffer.from(picture.data).toString('base64')
    cover = `data:${picture.format || 'image/jpeg'};base64,${base64}`
  }

  return {
    id: hashId(relPath),
    title: common.title || fileName,
    artist: common.artist || '未知艺术家',
    albumArtist: common.albumartist || common.artist || '未知艺术家',
    album: common.album || '未知专辑',
    duration: Math.round(metadata.format.duration || 0),
    year: common.year || null,
    hasCover: !!picture,
    cover,
    fileRelPath: relPath,
  }
}

/**
 * 提取专辑封面图片
 * @param {string} absPath 绝对路径
 * @returns {Promise<{data: Uint8Array, format: string} | null>}
 */
export async function getCover(absPath) {
  const metadata = await parseFile(absPath)
  const picture = metadata.common.picture && metadata.common.picture[0]
  if (!picture) return null
  return { data: picture.data, format: picture.format }
}
