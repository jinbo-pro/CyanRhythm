// 支持的音频文件扩展名（小写）
export const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.wav', '.aac', '.m4a']

/**
 * 判断文件名是否为受支持的音频文件
 * @param {string} fileName 文件名
 * @returns {boolean}
 */
export function isAudioFile(fileName) {
  const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''
  return AUDIO_EXTENSIONS.includes(ext)
}
