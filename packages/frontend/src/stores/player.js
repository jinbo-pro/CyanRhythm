import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import { Howl } from 'howler'
import { audioUrl } from '../api/index.js'
import { useSettingsStore, PLAY_MODES } from './settings.js'
import { useLibraryStore } from './library.js'
import { useStatsStore } from './stats.js'
import { loadProgress, saveProgress } from '../db/repositories/progress.js'

// Howl 实例与 RAF 句柄放在模块作用域，避免被 Vue 响应式代理
let howl = null
let rafId = null
let lastSaveTime = 0
let lastStatsTickAt = 0 // 播放时长统计：上一帧墙钟时间戳（ms）

export const usePlayerStore = defineStore('player', {
  state: () => ({
    queue: [], // 播放队列：歌曲 id 数组
    queueIndex: -1, // 当前歌曲在队列中的索引
    currentSong: null, // 当前歌曲对象
    isPlaying: false,
    seek: 0, // 当前播放时间（秒）
    duration: 0, // 当前歌曲总时长（秒）
  }),
  getters: {
    /** 播放进度 0~1 */
    progress: (state) => (state.duration ? state.seek / state.duration : 0),
  },
  actions: {
    /**
     * 设置播放队列并从指定歌曲开始播放
     * @param {object[]} songs 歌曲对象数组
     * @param {number} startIndex 起始索引
     */
    playSongs(songs, startIndex = 0) {
      if (!songs.length) return
      this.queue = songs.map((s) => s.id)
      this.queueIndex = startIndex
      this._loadAndPlay(this.queueIndex)
    },

    /** 加载某首歌（不自动播放） */
    _load(song, autoplay = false, seekTo = 0) {
      if (howl) {
        howl.unload()
        howl = null
      }
      this.currentSong = song
      this.seek = seekTo || 0
      this.duration = song.duration || 0
      this.isPlaying = false

      const settings = useSettingsStore()
      const ext = song.fileRelPath.split('.').pop().toLowerCase()
      howl = new Howl({
        src: [audioUrl(song.fileRelPath)],
        html5: true, // 流式播放，支持大文件与 seek
        volume: settings.muted ? 0 : settings.volume,
        format: [ext],
      })

      howl.on('load', () => {
        this.duration = howl.duration()
        if (seekTo) howl.seek(seekTo)
      })
      howl.on('play', () => {
        this.isPlaying = true
        this._startRaf()
      })
      howl.on('pause', () => {
        this.isPlaying = false
        this._stopRaf()
      })
      howl.on('stop', () => {
        this.isPlaying = false
        this._stopRaf()
      })
      howl.on('end', () => {
        this._onEnd()
      })

      if (autoplay) howl.play()
    },

    play() {
      if (howl) howl.play()
    },
    pause() {
      if (howl) howl.pause()
    },
    toggle() {
      this.isPlaying ? this.pause() : this.play()
    },
    stop() {
      if (howl) howl.stop()
      this.isPlaying = false
      this._stopRaf()
    },

    /** 跳转到指定秒数 */
    seekTo(seconds) {
      if (!howl) return
      howl.seek(seconds)
      this.seek = seconds
    },

    /**
     * 获取当前 Howl 底层的 HTMLAudioElement（供 WebAudio 频谱分析使用）
     * Howler html5 模式下，每个 Sound 的 _node 即为 <audio> 元素
     */
    getCurrentAudioNode() {
      if (!howl || !howl._sounds || !howl._sounds.length) return null
      return howl._sounds[0]._node || null
    },

    /** 同步音量（由设置变更时调用） */
    syncVolume() {
      const settings = useSettingsStore()
      if (howl) howl.volume(settings.volume)
    },
    syncMute() {
      const settings = useSettingsStore()
      if (howl) howl.mute(settings.muted)
    },

    /** 用户点击：下一曲（忽略单曲循环） */
    next() {
      if (!this.queue.length) return
      const settings = useSettingsStore()
      let idx
      if (settings.playMode === PLAY_MODES.SHUFFLE) {
        idx = this._randomIndex()
      } else {
        idx = this.queueIndex + 1
        if (idx >= this.queue.length) idx = 0
      }
      this.queueIndex = idx
      this._loadAndPlay(idx)
    },

    /** 用户点击：上一曲（超过 3 秒则回到开头） */
    prev() {
      if (!this.queue.length) return
      if (howl && this.seek > 3) {
        this.seekTo(0)
        return
      }
      let idx = this.queueIndex - 1
      if (idx < 0) idx = this.queue.length - 1
      this.queueIndex = idx
      this._loadAndPlay(idx)
    },

    /** 根据队列索引加载并播放 */
    _loadAndPlay(index) {
      const library = useLibraryStore()
      const songId = this.queue[index]
      const song = library.getSongById(songId)
      if (!song) return
      this._load(song, true)
      this._saveProgressNow()
      // 埋点：记录一次播放（按 id 唯一）
      try {
        useStatsStore().recordPlay(song)
      } catch (e) {
        console.error('[player] 记录播放统计失败:', e)
      }
    },

    /** 歌曲自然播放结束时的自动调度 */
    _onEnd() {
      const settings = useSettingsStore()
      if (settings.playMode === PLAY_MODES.LOOP && howl) {
        // 单曲循环：重新播放
        howl.seek(0)
        howl.play()
        // 单曲循环重新播放算一次新的播放
        try {
          useStatsStore().recordPlay(this.currentSong)
        } catch (e) {
          console.error('[player] 记录播放统计失败:', e)
        }
        return
      }
      // 顺序/随机：自动下一曲
      this.next()
    },

    /** 随机模式下生成下一索引（尽量避免与当前相同） */
    _randomIndex() {
      if (this.queue.length === 1) return 0
      let idx = this.queueIndex
      while (idx === this.queueIndex) {
        idx = Math.floor(Math.random() * this.queue.length)
      }
      return idx
    },

    /** 启动 requestAnimationFrame 循环更新进度条 */
    _startRaf() {
      this._stopRaf()
      lastStatsTickAt = Date.now()
      const tick = () => {
        if (howl && this.isPlaying) {
          this.seek = howl.seek()
          const now = Date.now()
          // 节流持久化进度：约每 5 秒写一次
          if (now - lastSaveTime > 5000) {
            lastSaveTime = now
            this._saveProgressNow()
          }
          // 播放时长统计：按墙钟差累加实际发声时间
          if (lastStatsTickAt) {
            const dt = (now - lastStatsTickAt) / 1000
            // 合理范围（0~2s），规避页面切到后台后的超大间隔
            if (dt > 0 && dt < 2) {
              try {
                useStatsStore().recordDuration(this.currentSong, dt)
              } catch (e) {
                console.error('[player] 记录播放时长失败:', e)
              }
            }
          }
          lastStatsTickAt = now
        } else {
          // 暂停时重置时间基准，避免下次继续时把暂停期计入
          lastStatsTickAt = Date.now()
        }
        rafId = requestAnimationFrame(tick)
      }
      rafId = requestAnimationFrame(tick)
    },
    _stopRaf() {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      // 停止时立即 flush 统计，避免丢失最近一段时长
      try {
        const stats = useStatsStore()
        if (stats._pending.size > 0) stats.flush()
      } catch (e) {
        console.error('[player] flush 统计失败:', e)
      }
      lastStatsTickAt = 0
    },

    /** 立即保存当前播放进度到 IndexedDB */
    async _saveProgressNow() {
      if (!this.currentSong) return
      // 去除 Vue3 响应式代理，否则结构化克隆算法无法序列化 Proxy，写入 idb 会抛错
      const rawSong = toRaw(this.currentSong)
      try {
        await saveProgress({
          songId: rawSong.id,
          song: { ...rawSong },
          currentTime: this.seek,
        })
      } catch (e) {
        console.error('[player] 保存进度失败:', e)
      }
    },

    /**
     * 应用启动时恢复上次播放状态（加载但不自动播放）
     * 需在 library store 之后调用
     */
    async restoreLast() {
      const data = await loadProgress()
      if (!data || !data.song) return
      // 优先用媒体库中的最新数据
      const library = useLibraryStore()
      const song = library.getSongById(data.songId) || data.song
      this.queue = [song.id]
      this.queueIndex = 0
      this._load(song, false, data.currentTime || 0)
    },
  },
})
