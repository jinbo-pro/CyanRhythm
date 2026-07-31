import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { getLyrics, updateMetadata } from '../api/index.js'
import { parseLRC, findActiveIndex, buildLRC } from '../utils/lrcParser.js'
import {
  getLyricsCache,
  saveLyricsCache,
  updateLyricsOffset,
  deleteLyricsCache,
} from '../db/repositories/lyrics.js'
import { eventBus, EVENTS } from '../utils/eventBus.js'

/**
 * 歌词组合式函数
 * 职责：歌曲切换时加载歌词（缓存优先）、解析 LRC 时间轴、暴露响应式状态
 *
 * @returns {{
 *   lines: import('vue').Ref<{time:number,text:string}[]>,
 *   plainText: import('vue').Ref<string>,
 *   loading: import('vue').Ref<boolean>,
 *   source: import('vue').Ref<string>,
 *   hasSynced: import('vue').ComputedRef<boolean>,
 *   hasAnyLyrics: import('vue').ComputedRef<boolean>,
 *   activeIndex: import('vue').ComputedRef<number>,
 *   offset: import('vue').Ref<number>,
 *   saving: import('vue').Ref<boolean>,
 *   adjustOffset: (delta:number) => Promise<void>,
 *   saveLyricsToFile: () => Promise<boolean>,
 * }}
 */
export function useLyrics() {
  const player = usePlayerStore()
  const lines = ref([]) // 解析后的歌词行 [{time, text}]
  const plainText = ref('') // 无时间轴的纯文本歌词（降级展示）
  const loading = ref(false)
  const source = ref('none') // embedded | file | online | none
  const offset = ref(0) // 毫秒，正数推迟高亮、负数提前
  const saving = ref(false) // 歌词保存到文件中

  const hasSynced = computed(() => lines.value.length > 0)
  const hasAnyLyrics = computed(() => hasSynced.value || !!plainText.value)

  // 当前高亮行（受 offset 影响）
  const activeIndex = computed(() =>
    findActiveIndex(lines.value, player.seek + offset.value / 1000)
  )

  /** 加载指定歌曲的歌词（缓存优先，无缓存则调 Rust 获取） */
  async function loadLyrics(id) {
    if (!id) {
      reset()
      return
    }
    reset()
    loading.value = true
    try {
      // 1. 先查缓存
      const cached = await getLyricsCache(id)
      if (cached) {
        applyCache(cached)
        return
      }
      // 2. 调 Rust 获取（内嵌→本地.lrc→在线lrclib）
      const result = await getLyrics(player.currentSong)
      lines.value = result.syncedLyrics ? parseLRC(result.syncedLyrics) : []
      plainText.value = result.plainLyrics || ''
      source.value = result.source
      // 3. 写缓存
      await saveLyricsCache(id, {
        source: result.source,
        syncedLyrics: result.syncedLyrics,
        plainLyrics: result.plainLyrics,
        offset: 0,
      })
    } catch (e) {
      console.error('[lyrics] 获取失败:', e)
    } finally {
      loading.value = false
    }
  }

  // 歌曲切换 → 加载歌词
  watch(() => player.currentSong?.id, (id) => loadLyrics(id), { immediate: true })

  // 歌词被编辑保存后，缓存已被清除，需主动重新加载当前歌曲
  function onLyricsUpdated(songId) {
    if (songId && songId === player.currentSong?.id) {
      loadLyrics(songId)
    }
  }
  eventBus.on(EVENTS.LYRICS_UPDATED, onLyricsUpdated)
  onBeforeUnmount(() => eventBus.off(EVENTS.LYRICS_UPDATED, onLyricsUpdated))

  /** 应用缓存数据到响应式状态 */
  function applyCache(c) {
    lines.value = c.syncedLyrics ? parseLRC(c.syncedLyrics) : []
    plainText.value = c.plainLyrics || ''
    source.value = c.source || 'none'
    offset.value = c.offset || 0
  }

  /** 重置所有状态 */
  function reset() {
    lines.value = []
    plainText.value = ''
    offset.value = 0
    source.value = 'none'
  }

  /**
   * 调整歌词时间偏移
   * @param {number} delta 毫秒增量（正数推迟、负数提前）
   */
  async function adjustOffset(delta) {
    offset.value += delta
    if (player.currentSong) {
      await updateLyricsOffset(player.currentSong.id, offset.value)
    }
  }

  /**
   * 将当前偏移烘焙进时间轴并写入音频文件
   * 仅对带时间轴的歌词有效。写入后清除缓存并重新加载（offset 自动归零）。
   * @returns {Promise<boolean>} 是否保存成功
   */
  async function saveLyricsToFile() {
    const song = player.currentSong
    if (!song || !lines.value.length || saving.value) return false
    saving.value = true
    try {
      // 1. 将偏移烘焙进时间轴生成新 LRC 文本
      const newLrc = buildLRC(lines.value, offset.value)
      // 2. 写入文件（仅更新歌词，其他字段保持原值）
      await updateMetadata({ filePath: song.fileRelPath, lyrics: newLrc })
      // 3. 清除缓存并重新加载（offset 自动归零，时间轴为烘焙后的值）
      await deleteLyricsCache(song.id)
      await loadLyrics(song.id)
      return true
    } catch (e) {
      console.error('[lyrics] 保存歌词失败:', e)
      return false
    } finally {
      saving.value = false
    }
  }

  return {
    lines,
    plainText,
    loading,
    source,
    saving,
    hasSynced,
    hasAnyLyrics,
    activeIndex,
    offset,
    adjustOffset,
    saveLyricsToFile,
  }
}
