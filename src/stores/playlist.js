import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import {
  getAllPlaylists,
  savePlaylist,
  deletePlaylist,
} from '../db/repositories/playlists.js'

/** 系统内置"我的收藏"播放列表固定 id，不可删除、不可重命名 */
export const FAVORITES_ID = 'pl_favorites'
export const FAVORITES_NAME = '我的收藏'

/**
 * 自定义播放列表 Store（数据持久化到 IndexedDB）
 * 数据结构：{ id, name, songIds: [], createdAt, sort, builtin? }
 * sort 为数字排序值，越小越靠前；未设置时按创建时间兜底
 * builtin=true 标记系统内置列表（如"我的收藏"），受保护不可删除/编辑
 */
export const usePlaylistStore = defineStore('playlist', {
  state: () => ({
    playlists: [],
    loaded: false,
  }),
  getters: {
    /** 下一个可用排序值（= 当前最大 sort + 1，默认 1） */
    nextSort(state) {
      if (!state.playlists.length) return 1
      const max = Math.max(
        ...state.playlists.map((p) => (typeof p.sort === 'number' ? p.sort : 0))
      )
      return max + 1
    },
    /** 系统内置"我的收藏"播放列表 */
    favorites(state) {
      return state.playlists.find((p) => p.id === FAVORITES_ID) || null
    },
  },
  actions: {
    /**
     * 统一持久化方法：剥离 Vue 响应式代理后写入 IndexedDB
     * 必须先 toRaw 脱壳，否则结构化克隆 Proxy 会抛 'could not be cloned'
     */
    async _persist(pl) {
      const raw = toRaw(pl)
      await savePlaylist({
        ...raw,
        songIds: [...raw.songIds],
        icon: raw.icon ? { ...toRaw(raw.icon) } : null,
      })
    },
    /** 将当前 playlists 按 sort 升序排序（返回新数组引用触发响应式更新） */
    _resort() {
      this.playlists = [...this.playlists].sort((a, b) => {
        const sa = typeof a.sort === 'number' ? a.sort : 0
        const sb = typeof b.sort === 'number' ? b.sort : 0
        if (sa !== sb) return sa - sb
        // sort 相同时回退到创建时间
        return (a.createdAt || 0) - (b.createdAt || 0)
      })
    },
    /** 从 IndexedDB 加载全部播放列表（加载后按 sort 排序） */
    async load() {
      const list = await getAllPlaylists()
      this.playlists = Array.isArray(list) ? list : []
      // 确保系统内置"我的收藏"列表始终存在
      await this._ensureFavorites()
      this._resort()
      this.loaded = true
    },
    /** 系统初始化时确保"我的收藏"内置列表存在（sort=0 始终排在最前） */
    async _ensureFavorites() {
      const existed = this.playlists.find((p) => p.id === FAVORITES_ID)
      if (existed) return
      const fav = {
        id: FAVORITES_ID,
        name: FAVORITES_NAME,
        songIds: [],
        createdAt: 0,
        sort: 0,
        builtin: true,
      }
      await savePlaylist({ ...fav })
      this.playlists.push(fav)
    },
    /** 生成播放列表 id（Tauri WebView 安全上下文，crypto.randomUUID 可用） */
    _genId() {
      return 'pl_' + crypto.randomUUID()
    },
    /**
     * 新建播放列表
     * @param {string} name 名称（必填）
     * @param {number} [sort] 排序值，不传则取 nextSort（追加到末尾）
     * @param {{type:string, value:string}|null} [icon] 图标配置
     */
    async create(name, sort, icon) {
      const sortVal = typeof sort === 'number' ? sort : this.nextSort
      const pl = {
        id: this._genId(),
        name,
        icon: icon || null,
        songIds: [],
        createdAt: Date.now(),
        sort: sortVal,
      }
      await savePlaylist({ ...pl })
      this.playlists.push(pl)
      this._resort()
      return pl
    },
    /**
     * 更新播放列表（名称 / 排序 / 图标）—— 内置列表受保护，不可更新
     * @param {string} id
     * @param {{name?:string, sort?:number, icon?:object|null}} patch
     */
    async update(id, patch) {
      if (id === FAVORITES_ID) return
      const pl = this.playlists.find((p) => p.id === id)
      if (!pl) return
      if (typeof patch.name === 'string') pl.name = patch.name
      if (typeof patch.sort === 'number') pl.sort = patch.sort
      if (patch.icon !== undefined) pl.icon = patch.icon
      await this._persist(pl)
      this._resort()
    },
    /** 删除播放列表 —— 内置列表受保护，不可删除 */
    async remove(id) {
      if (id === FAVORITES_ID) return
      await deletePlaylist(id)
      this.playlists = this.playlists.filter((p) => p.id !== id)
    },
    /** 向播放列表添加歌曲（去重） */
    async addSong(id, songId) {
      const pl = this.playlists.find((p) => p.id === id)
      if (!pl) return
      if (!pl.songIds.includes(songId)) {
        pl.songIds.push(songId)
        await this._persist(pl)
      }
    },
    /** 从播放列表移除歌曲 */
    async removeSong(id, songId) {
      const pl = this.playlists.find((p) => p.id === id)
      if (!pl) return
      pl.songIds = pl.songIds.filter((sid) => sid !== songId)
      await this._persist(pl)
    },
    /** 从所有播放列表中移除指定歌曲 */
    async removeSongFromAll(songId) {
      if (!songId) return
      const changed = this.playlists.filter((pl) => pl.songIds.includes(songId))
      for (const pl of changed) {
        pl.songIds = pl.songIds.filter((sid) => sid !== songId)
        await this._persist(pl)
      }
    },
    getPlaylist(id) {
      return this.playlists.find((p) => p.id === id)
    },
    /** 判断歌曲是否已收藏 */
    isFavorite(songId) {
      const fav = this.favorites
      return !!(fav && fav.songIds.includes(songId))
    },
    /** 切换歌曲收藏状态（收藏 / 取消收藏） */
    async toggleFavorite(songId) {
      const fav = this.favorites
      if (!fav) return
      const idx = fav.songIds.indexOf(songId)
      if (idx >= 0) {
        fav.songIds.splice(idx, 1)
      } else {
        fav.songIds.push(songId)
      }
      await this._persist(fav)
    },
  },
})
