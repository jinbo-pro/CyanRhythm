import { defineStore } from 'pinia'
import { loadSettings, saveSettings } from '../db/repositories/settings.js'
import { setEnabled, applyGains, setBandGain } from '../composables/useEqualizer.js'

/** 播放模式枚举 */
export const PLAY_MODES = {
  SEQUENCE: 'sequence', // 顺序播放
  LOOP: 'loop', // 单曲循环
  SHUFFLE: 'shuffle', // 随机播放
}

/** 播放模式展示信息（图标标识 + 中文） */
export const PLAY_MODE_INFO = {
  [PLAY_MODES.SEQUENCE]: { icon: 'sequence', label: '顺序播放' },
  [PLAY_MODES.LOOP]: { icon: 'loop', label: '单曲循环' },
  [PLAY_MODES.SHUFFLE]: { icon: 'shuffle', label: '随机播放' },
}

/**
 * 快捷键动作枚举（键值同时作为快捷键配置对象的字段名）
 */
export const SHORTCUT_ACTIONS = {
  PLAY_PAUSE: 'playPause', // 切换播放/暂停
  PREV: 'prev', // 上一曲
  NEXT: 'next', // 下一曲
}

/** 快捷键默认绑定（mousetrap 组合字符串） */
export const DEFAULT_SHORTCUTS = {
  [SHORTCUT_ACTIONS.PLAY_PAUSE]: 'space',
  [SHORTCUT_ACTIONS.PREV]: 'left',
  [SHORTCUT_ACTIONS.NEXT]: 'right',
}

/** 快捷键中文描述 */
export const SHORTCUT_LABELS = {
  [SHORTCUT_ACTIONS.PLAY_PAUSE]: '播放/暂停',
  [SHORTCUT_ACTIONS.PREV]: '上一曲',
  [SHORTCUT_ACTIONS.NEXT]: '下一曲',
}

// 防抖保存，避免拖动滑块时频繁写库
let persistTimer = null

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    volume: 0.8, // 0 ~ 1
    muted: false,
    playMode: PLAY_MODES.SEQUENCE,
    theme: 'light', // 'light' | 'dark'
    // 歌曲列表个性化显示（全局生效，在设置弹窗中切换）
    showCover: true, // 是否显示封面缩略图
    showAlbum: true, // 是否显示专辑列
    showIndex: true, // 是否显示序号列
    pixelIcon: false, // 无封面时是否用名称生成像素图标
    // 快捷键配置：动作 -> mousetrap 组合字符串（如 'space'、'ctrl+right'）
    shortcuts: { ...DEFAULT_SHORTCUTS },
    // EQ 均衡器配置
    eqEnabled: false, // 是否启用 EQ
    eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 10 段增益（dB）
    loaded: false,
  }),
  actions: {
    /** 从 IndexedDB 读取配置 */
    async load() {
      const data = await loadSettings()
      this.volume = data.volume ?? 0.8
      this.muted = data.muted ?? false
      this.playMode = data.playMode ?? PLAY_MODES.SEQUENCE
      this.theme = data.theme ?? 'light'
      this.showCover = data.showCover ?? true
      this.showAlbum = data.showAlbum ?? true
      this.showIndex = data.showIndex ?? true
      this.pixelIcon = data.pixelIcon ?? false
      // 合并快捷键：以保存值为准，缺失项回退到默认
      this.shortcuts = { ...DEFAULT_SHORTCUTS, ...(data.shortcuts || {}) }
      // EQ 均衡器配置
      this.eqEnabled = data.eqEnabled ?? false
      this.eqGains = Array.isArray(data.eqGains) && data.eqGains.length === 10
        ? data.eqGains
        : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      this.loaded = true
      this.applyTheme()
      // 同步 EQ 状态到音频模块（AudioContext 可能尚未就绪，模块内部会缓存待应用）
      this.syncEqualizer()
    },
    /** 防抖持久化 */
    persist() {
      if (persistTimer) clearTimeout(persistTimer)
      persistTimer = setTimeout(() => {
        saveSettings({
          volume: this.volume,
          muted: this.muted,
          playMode: this.playMode,
          theme: this.theme,
          showCover: this.showCover,
          showAlbum: this.showAlbum,
          showIndex: this.showIndex,
          pixelIcon: this.pixelIcon,
          shortcuts: { ...this.shortcuts },
          eqEnabled: this.eqEnabled,
          eqGains: [...this.eqGains],
        })
      }, 400)
    },
    setVolume(v) {
      this.volume = Math.min(1, Math.max(0, v))
      if (this.volume > 0) this.muted = false
      this.persist()
    },
    toggleMute() {
      this.muted = !this.muted
      this.persist()
    },
    setPlayMode(mode) {
      this.playMode = mode
      this.persist()
    },
    /** 循环切换播放模式 */
    cyclePlayMode() {
      const order = [PLAY_MODES.SEQUENCE, PLAY_MODES.LOOP, PLAY_MODES.SHUFFLE]
      const idx = order.indexOf(this.playMode)
      this.setPlayMode(order[(idx + 1) % order.length])
    },
    /** 设置某个动作的快捷键（combo 为 mousetrap 组合字符串） */
    setShortcut(action, combo) {
      this.shortcuts = { ...this.shortcuts, [action]: combo }
      this.persist()
    },
    /** 重置全部快捷键为默认 */
    resetShortcuts() {
      this.shortcuts = { ...DEFAULT_SHORTCUTS }
      this.persist()
    },
    setTheme(theme) {
      this.theme = theme
      this.applyTheme()
      this.persist()
    },
    toggleTheme() {
      this.setTheme(this.theme === 'light' ? 'dark' : 'light')
    },
    /** 应用主题到 <html> 根节点（配合 Tailwind darkMode:'class'） */
    applyTheme() {
      const root = document.documentElement
      if (this.theme === 'dark') root.classList.add('dark')
      else root.classList.remove('dark')
    },
    /** 同步 EQ 配置到音频模块 */
    syncEqualizer() {
      setEnabled(this.eqEnabled)
      applyGains(this.eqGains)
    },
    /** 设置 EQ 启用状态 */
    setEqEnabled(val) {
      this.eqEnabled = val
      this.syncEqualizer()
      this.persist()
    },
    /** 设置某频段增益 */
    setEqGain(index, db) {
      this.eqGains[index] = db
      // 轻量更新：仅调整单个滤波器，避免拖动滑块时频繁重路由
      setBandGain(index, db)
      this.persist()
    },
    /** 批量设置 EQ 增益（如应用预设） */
    setEqGains(gainsArr) {
      this.eqGains = [...gainsArr]
      this.syncEqualizer()
      this.persist()
    },
  },
})
