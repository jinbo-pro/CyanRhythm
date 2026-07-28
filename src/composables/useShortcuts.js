import Mousetrap from 'mousetrap'
import { useSettingsStore, SHORTCUT_ACTIONS } from '../stores/settings.js'
import { usePlayerStore } from '../stores/player.js'

/**
 * 将 keydown 事件转换为 mousetrap 风格的组合字符串
 * 例如：Ctrl+Shift+P => 'ctrl+shift+p'，空格 => 'space'，左方向键 => 'left'
 * @param {KeyboardEvent} e
 * @returns {string|null} mousetrap 组合字符串；纯修饰键按下时返回 null
 */
export function keyEventToCombo(e) {
  const parts = []
  if (e.ctrlKey) parts.push('ctrl')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  if (e.metaKey) parts.push('meta')

  // 仅按下修饰键（未按主键）时不构成完整组合
  const key = e.key
  if (
    key === 'Control' ||
    key === 'Alt' ||
    key === 'Shift' ||
    key === 'Meta'
  ) {
    return null
  }

  let main
  switch (key) {
    case ' ':
      main = 'space'
      break
    case 'ArrowLeft':
      main = 'left'
      break
    case 'ArrowRight':
      main = 'right'
      break
    case 'ArrowUp':
      main = 'up'
      break
    case 'ArrowDown':
      main = 'down'
      break
    case 'Enter':
      main = 'enter'
      break
    case 'Escape':
      main = 'esc'
      break
    case 'Backspace':
      main = 'backspace'
      break
    case 'Tab':
      main = 'tab'
      break
    case 'Delete':
      main = 'del'
      break
    case 'Insert':
      main = 'ins'
      break
    default:
      main = key.length === 1 ? key.toLowerCase() : key.toLowerCase()
  }
  parts.push(main)
  return parts.join('+')
}

/** mousetrap 组合键 -> 人类可读文本的映射表 */
const DISPLAY_MAP = {
  space: 'Space',
  left: '←',
  right: '→',
  up: '↑',
  down: '↓',
  enter: 'Enter',
  esc: 'Esc',
  backspace: 'Backspace',
  tab: 'Tab',
  del: 'Delete',
  ins: 'Insert',
  ctrl: 'Ctrl',
  alt: 'Alt',
  shift: 'Shift',
  meta: 'Cmd',
}

/**
 * 将 mousetrap 组合字符串格式化为人类可读文本
 * 例如：'ctrl+shift+p' => 'Ctrl+Shift+P'
 * @param {string} combo
 * @returns {string}
 */
export function formatCombo(combo) {
  if (!combo) return '未设置'
  return combo
    .split('+')
    .map((part) => {
      const lower = part.toLowerCase()
      if (DISPLAY_MAP[lower]) return DISPLAY_MAP[lower]
      if (lower.length === 1) return part.toUpperCase()
      return part
    })
    .join(' + ')
}

let bound = false

/**
 * 全局快捷键绑定 composable
 * 读取 settings.shortcuts 配置并绑定到 player 控制方法
 * 每次调用 bind() 会先 unbind 再重新绑定，便于配置变更后刷新
 */
export function useShortcuts() {
  const settings = useSettingsStore()
  const player = usePlayerStore()

  /** 各动作对应的处理函数 */
  const handlers = {
    [SHORTCUT_ACTIONS.PLAY_PAUSE]: () => player.toggle(),
    [SHORTCUT_ACTIONS.PREV]: () => player.prev(),
    [SHORTCUT_ACTIONS.NEXT]: () => player.next(),
  }

  /** 解绑全部已绑定快捷键 */
  function unbind() {
    Object.values(SHORTCUT_ACTIONS).forEach((action) => {
      const combo = settings.shortcuts[action]
      if (combo) Mousetrap.unbind(combo)
    })
    bound = false
  }

  /** 按当前 settings.shortcuts 配置绑定全局快捷键 */
  function bind() {
    unbind()
    Object.values(SHORTCUT_ACTIONS).forEach((action) => {
      const combo = settings.shortcuts[action]
      if (combo) Mousetrap.bind(combo, (e) => {
        e.preventDefault()
        handlers[action]()
      })
    })
    bound = true
  }

  return { bind, unbind, isBound: () => bound }
}
