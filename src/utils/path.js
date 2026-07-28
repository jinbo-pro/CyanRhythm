/**
 * 前端轻量路径工具：兼容 Windows 反斜杠与 Unix 正斜杠。
 * 歌曲的 fileRelPath 实际存储的是绝对路径（如 D:\音乐\周杰伦\xxx.mp3），
 * 按文件夹分组时需要从中提取所在目录与目录名。
 */

/**
 * 从文件路径中提取所在目录
 * @param {string} filePath 文件路径
 * @returns {string} 目录路径；无分隔符时返回空字符串
 */
export function getDirName(filePath) {
  if (!filePath) return ''
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return idx >= 0 ? filePath.slice(0, idx) : ''
}

/**
 * 取路径最后一级名称（目录名或文件名）
 * @param {string} dirPath 目录或文件路径
 * @returns {string}
 */
export function getBaseName(dirPath) {
  if (!dirPath) return ''
  const idx = Math.max(dirPath.lastIndexOf('/'), dirPath.lastIndexOf('\\'))
  return idx >= 0 ? dirPath.slice(idx + 1) : dirPath
}

/**
 * 取目录的父目录（用于详情页展示所属位置）
 * @param {string} dirPath 目录路径
 * @returns {string}
 */
export function getParentDir(dirPath) {
  return getDirName(dirPath)
}
