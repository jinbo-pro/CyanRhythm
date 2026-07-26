import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import { getAllStats, addStat } from '../db/repositories/stats.js'

/**
 * 播放统计 Store：以歌曲 id 为唯一键，记录播放次数与累计播放时长。
 * 播放次数：每次切换歌曲 / 单曲循环重新播放时 +1
 * 播放时长：RAF 循环中按墙钟差累加（仅播放中），节流写入 idb
 */
export const useStatsStore = defineStore('stats', {
  state: () => ({
    records: [], // [{ id, playCount, playDuration, title, artist, album, cover, lastPlayedAt }]
    loaded: false,
    // 待写入的内存增量（按 id 聚合），定时 flush 到 idb
    _pending: new Map(), // id -> { playCount, playDuration, song }
    _flushTimer: null,
  }),
  getters: {
    /** 总播放次数 */
    totalPlayCount: (state) =>
      state.records.reduce((sum, r) => sum + (r.playCount || 0), 0),
    /** 总播放时长（秒） */
    totalPlayDuration: (state) =>
      state.records.reduce((sum, r) => sum + (r.playDuration || 0), 0),
    /** 根据 id 获取单条统计 */
    getById: (state) => (id) => state.records.find((r) => r.id === id),
  },
  actions: {
    /** 从 IndexedDB 加载全部统计 */
    async load() {
      this.records = await getAllStats()
      this.loaded = true
    },
    /**
     * 记录一次播放行为（播放次数 +1）
     * @param {object} song 歌曲对象
     */
    recordPlay(song) {
      const id = song?.id
      if (!id) return
      // 更新内存
      let r = this.records.find((x) => x.id === id)
      if (!r) {
        r = {
          id,
          playCount: 0,
          playDuration: 0,
          title: song.title || '未知歌曲',
          artist: song.artist || '未知艺术家',
          album: song.album || '未知专辑',
          cover: song.cover || null,
          lastPlayedAt: 0,
        }
        this.records.push(r)
      }
      r.playCount += 1
      r.lastPlayedAt = Date.now()
      r.title = song.title || r.title
      r.artist = song.artist || r.artist
      r.album = song.album || r.album
      r.cover = song.cover ?? r.cover
      // 累加到待写入
      this._accumulate(id, 1, 0, song)
    },
    /**
     * 累加播放时长（仅内存 + 待写入，不立即落库）
     * @param {object} song 歌曲对象
     * @param {number} seconds 秒数
     */
    recordDuration(song, seconds) {
      const id = song?.id
      if (!id || seconds <= 0) return
      let r = this.records.find((x) => x.id === id)
      if (!r) {
        r = {
          id,
          playCount: 0,
          playDuration: 0,
          title: song.title || '未知歌曲',
          artist: song.artist || '未知艺术家',
          album: song.album || '未知专辑',
          cover: song.cover || null,
          lastPlayedAt: 0,
        }
        this.records.push(r)
      }
      r.playDuration += seconds
      this._accumulate(id, 0, seconds, song)
    },
    /** 聚合到 pending map 并安排 flush */
    _accumulate(id, playCount, playDuration, song) {
      const cur = this._pending.get(id) || { playCount: 0, playDuration: 0, song: null }
      cur.playCount += playCount
      cur.playDuration += playDuration
      cur.song = song ? { ...toRaw(song) } : cur.song
      this._pending.set(id, cur)
      this._scheduleFlush()
    },
    /** 节流写入：每 5 秒最多一次 */
    _scheduleFlush() {
      if (this._flushTimer) return
      this._flushTimer = setTimeout(async () => {
        this._flushTimer = null
        await this.flush()
      }, 5000)
    },
    /** 将全部待写入增量落库 */
    async flush() {
      if (this._pending.size === 0) return
      const items = [...this._pending.entries()]
      this._pending.clear()
      for (const [id, delta] of items) {
        try {
          await addStat(id, delta)
        } catch (e) {
          console.error('[stats] 写入失败:', e)
        }
      }
    },
    /** 刷新统计（从 idb 重新加载，用于统计页打开时） */
    async refresh() {
      await this.flush()
      await this.load()
    },
  },
})
