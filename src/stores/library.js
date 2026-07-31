import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import { scanLibrary as scanApi } from '../api/index.js'
import {
  loadSongs,
  saveSongs,
  clearSongs,
  loadScanDirs,
  saveScanDirs,
} from '../db/repositories/library.js'
import { getDirName, getBaseName } from '../utils/path.js'

/**
 * 媒体库 Store：管理扫描得到的歌曲数据，并派生专辑/歌手分组。
 * 歌曲列表与已扫描目录列表会持久化到 IndexedDB，刷新/重启后自动恢复。
 */
export const useLibraryStore = defineStore('library', {
  state: () => ({
    songs: [], // 全部歌曲对象
    scanDirs: [], // 已扫描的目录绝对路径列表
    scanning: false,
    lastScanPath: '',
    loaded: false, // 是否已从 idb 加载
  }),
  getters: {
    total: (state) => state.songs.length,
    /** 按专辑分组 */
    albums(state) {
      const map = new Map()
      for (const s of state.songs) {
        const key = s.album || '未知专辑'
        if (!map.has(key)) {
          map.set(key, { name: key, artist: s.albumArtist || s.artist, songs: [], firstSong: s })
        }
        map.get(key).songs.push(s)
      }
      return [...map.values()]
    },
    /** 按歌手分组 */
    artists(state) {
      const map = new Map()
      for (const s of state.songs) {
        const key = s.artist || '未知艺术家'
        if (!map.has(key)) map.set(key, { name: key, songs: [], albumSet: new Set() })
        const grp = map.get(key)
        grp.songs.push(s)
        grp.albumSet.add(s.album || '未知专辑')
      }
      return [...map.values()].map((a) => ({
        name: a.name,
        songs: a.songs,
        albums: [...a.albumSet],
        albumCount: a.albumSet.size,
      }))
    },
    /** 根据 id 获取歌曲 */
    getSongById(state) {
      return (id) => state.songs.find((s) => s.id === id)
    },
    /** 按文件夹分组：以每首歌曲所在目录为维度聚合 */
    folders(state) {
      const map = new Map()
      for (const s of state.songs) {
        const key = getDirName(s.fileRelPath) || '未知文件夹'
        if (!map.has(key)) {
          map.set(key, {
            path: key,
            name: getBaseName(key) || key,
            songs: [],
            firstSong: s,
          })
        }
        map.get(key).songs.push(s)
      }
      return [...map.values()]
    },
  },
  actions: {
    /** 应用启动时从 IndexedDB 恢复歌曲列表与已扫描目录 */
    async load() {
      const songs = await loadSongs()
      this.songs = songs || []
      this.scanDirs = (await loadScanDirs()) || []
      this.loaded = true
    },
    /** 将当前 songs 持久化到 IndexedDB（去除 Vue 响应式） */
    async _persist() {
      // toRaw 逐层脱壳：songs 数组及每个歌曲对象都可能是响应式代理
      const plain = toRaw(this.songs).map((s) => ({ ...toRaw(s) }))
      await saveSongs(plain)
    },
    /** 扫描目录并将结果合并入库（按 id 去重） */
    async scan(path = '') {
      this.scanning = true
      try {
        const { songs } = await scanApi(path)
        return await this.mergeSongs(songs, path)
      } finally {
        this.scanning = false
      }
    },
    /**
     * 将外部传入的歌曲数组合并入库（按 id 去重）并持久化。
     * 供流式扫描在拿到最终结果后调用。
     * @param {object[]} songs
     * @param {string} [scanPath]
     * @returns {Promise<object[]>} 本次合并的歌曲列表
     */
    async mergeSongs(songs, scanPath = '') {
      const list = Array.isArray(songs) ? songs : []
      const map = new Map(this.songs.map((s) => [s.id, s]))
      for (const s of list) map.set(s.id, s)
      this.songs = [...map.values()]
      if (scanPath) this.lastScanPath = scanPath
      // 持久化（扫描返回的是普通对象，无需 toRaw，但为统一仍走 _persist）
      await this._persist()
      return list
    },
    /**
     * 判断歌曲是否属于指定目录（fileRelPath 以 dir 为根目录）。
     * 兼容 Windows 反斜杠与 Unix 正斜杠，路径比较大小写不敏感。
     */
    isSongInDir(song, dir) {
      const p = song && song.fileRelPath
      if (!p || !dir) return false
      const lower = String(p).toLowerCase()
      const dirLower = String(dir).toLowerCase()
      return (
        lower === dirLower ||
        lower.startsWith(dirLower + '\\') ||
        lower.startsWith(dirLower + '/')
      )
    },
    /** 获取属于指定目录的歌曲列表 */
    songsByDir(dir) {
      return this.songs.filter((s) => this.isSongInDir(s, dir))
    },
    /** 添加扫描目录（去重）并持久化 */
    async addScanDir(dir) {
      const d = (dir || '').trim()
      if (!d) return
      const lower = d.toLowerCase()
      if (!this.scanDirs.some((x) => x.toLowerCase() === lower)) {
        this.scanDirs = [...this.scanDirs, d]
        // 展开为普通数组再入库：响应式 Proxy 无法被 IndexedDB 结构化克隆
        await saveScanDirs([...this.scanDirs])
      }
    },
    /** 删除扫描目录及该目录下的全部歌曲 */
    async removeScanDir(dir) {
      const d = (dir || '').trim()
      if (!d) return
      const lower = d.toLowerCase()
      this.scanDirs = this.scanDirs.filter((x) => x.toLowerCase() !== lower)
      this.songs = this.songs.filter((s) => !this.isSongInDir(s, d))
      await saveScanDirs([...this.scanDirs])
      await this._persist()
    },
    /**
     * 更新单首歌曲的元数据（编辑后回写）
     * @param {object} updatedSong 包含最新字段的歌曲对象（按 id 匹配替换）
     */
    async updateSong(updatedSong) {
      const idx = this.songs.findIndex((s) => s.id === updatedSong.id)
      if (idx >= 0) {
        this.songs[idx] = updatedSong
        this.songs = [...this.songs]
        await this._persist()
      }
    },
    /** 从媒体库移除单首歌曲记录 */
    async removeSong(id) {
      if (!id) return
      const next = this.songs.filter((s) => s.id !== id)
      if (next.length === this.songs.length) return
      this.songs = next
      await this._persist()
    },
    /**
     * 替换指定目录的歌曲：先删除该目录下的旧歌曲，再合并新歌曲（按 id 去重）。
     * 用于「更新目录」——重新扫描后用新结果覆盖该目录的歌曲。
     */
    async replaceSongsByDir(dir, songs) {
      const d = (dir || '').trim()
      const list = Array.isArray(songs) ? songs : []
      const remaining = this.songs.filter((s) => !this.isSongInDir(s, d))
      const map = new Map(remaining.map((s) => [s.id, s]))
      for (const s of list) map.set(s.id, s)
      this.songs = [...map.values()]
      if (d) this.lastScanPath = d
      await this._persist()
      return list
    },
    /** 清空媒体库 */
    async clear() {
      this.songs = []
      this.scanDirs = []
      await clearSongs()
      await saveScanDirs([])
    },
  },
})
