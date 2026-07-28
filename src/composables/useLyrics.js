import { ref, computed, watch } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { getLyrics } from '../api/index.js'
import { parseLRC, findActiveIndex } from '../utils/lrcParser.js'
import {
  getLyricsCache,
  saveLyricsCache,
  updateLyricsOffset,
} from '../db/repositories/lyrics.js'

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
 *   adjustOffset: (delta:number) => Promise<void>,
 * }}
 */
export function useLyrics() {
  const player = usePlayerStore()
  const lines = ref([]) // 解析后的歌词行 [{time, text}]
  const plainText = ref('') // 无时间轴的纯文本歌词（降级展示）
  const loading = ref(false)
  const source = ref('none') // embedded | file | online | none
  const offset = ref(0) // 毫秒，正数推迟高亮、负数提前

  const hasSynced = computed(() => lines.value.length > 0)
  const hasAnyLyrics = computed(() => hasSynced.value || !!plainText.value)

  // 当前高亮行（受 offset 影响）
  const activeIndex = computed(() =>
    findActiveIndex(lines.value, player.seek + offset.value / 1000)
  )

  // 歌曲切换 → 加载歌词
  watch(
    () => player.currentSong?.id,
    async (id) => {
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
    },
    { immediate: true }
  )

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

  return {
    lines,
    plainText,
    loading,
    source,
    hasSynced,
    hasAnyLyrics,
    activeIndex,
    offset,
    adjustOffset,
  }
}
