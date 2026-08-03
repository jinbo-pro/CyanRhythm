import { useSettingsStore, SHORTCUT_ACTIONS } from '../stores/settings.js'
import { usePlayerStore } from '../stores/player.js'

/**
 * 将 DOM keydown 事件转换为标准组合键格式的字符串
 * 例如：Ctrl+Shift+P => 'Control+Shift+P'，空格 => 'Space'，左方向键 => 'Left'
 * @param {KeyboardEvent} e
 * @returns {string|null} Tauri 快捷键字符串；纯修饰键按下时返回 null
 */
export function keyEventToCombo(e) {
  const parts = []
  if (e.ctrlKey) parts.push('Control')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Super')

  const key = e.key
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return null

  const KEY_MAP = {
    ' ': 'Space',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    Enter: 'Return',
    Escape: 'Escape',
    Backspace: 'Backspace',
    Tab: 'Tab',
    Delete: 'Delete',
    Insert: 'Insert',
  }

  let main = KEY_MAP[key]
  if (!main) {
    main = key.length === 1 ? key.toUpperCase() : key
  }
  parts.push(main)
  return parts.join('+')
}

/** Tauri 快捷键 -> 人类可读文本的映射表 */
const DISPLAY_MAP = {
  Space: 'Space',
  Left: '←',
  Right: '→',
  Up: '↑',
  Down: '↓',
  Return: 'Enter',
  Escape: 'Esc',
  Backspace: 'Backspace',
  Tab: 'Tab',
  Delete: 'Delete',
  Insert: 'Insert',
  Control: 'Ctrl',
  Alt: 'Alt',
  Shift: 'Shift',
  Super: 'Win',
}

/**
 * 将 Tauri 快捷键字符串格式化为人类可读文本
 * @param {string} combo
 * @returns {string}
 */
export function formatCombo(combo) {
  if (!combo) return '未设置'
  return combo
    .split('+')
    .map((part) => DISPLAY_MAP[part] || part)
    .join(' + ')
}

/**
 * 应用内快捷键绑定 composable（替代系统级 global-shortcut）
 *
 * 原先基于 tauri-plugin-global-shortcut 注册系统级热键，快捷键在应用未聚焦 /
 * 最小化时也会生效，且会抢占其他应用的按键。现改为监听 document 的 keydown
 * 事件：DOM 事件天然仅在应用窗口聚焦时接收，完全满足「聚焦时生效」的需求，
 * 同时不影响其他程序。组合键解析复用 keyEventToCombo，零额外依赖。
 *
 * 冲突规避：
 * - ShortcutInput 录制时在 capture 阶段监听并 stopPropagation，会先于本监听器
 *   （bubble 阶段）执行，录制期间不会被全局监听器误触发。
 * - 输入框 / 文本域 / contenteditable 聚焦时跳过，避免影响编辑。
 * - 命中时 preventDefault，避免 Space 等触发已聚焦按钮的 click 造成双触发。
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

  // combo -> action 映射（bind 时按当前配置构建）
  let comboMap = {}
  let bound = false

  /** 当前聚焦元素是否为可编辑控件（输入时不触发快捷键） */
  function isEditableTarget() {
    const el = document.activeElement
    if (!el) return false
    const tag = el.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
    return !!el.isContentEditable
  }

  function onKeydown(e) {
    // 编辑场景（搜索框、元数据编辑、歌词编辑等）不拦截
    if (isEditableTarget()) return
    const combo = keyEventToCombo(e)
    if (!combo) return
    const action = comboMap[combo]
    if (!action) return
    // 命中应用内快捷键：阻止默认行为（如 Space 滚动页面 / 触发聚焦按钮 click）
    e.preventDefault()
    handlers[action]?.()
  }

  /** 按当前 settings.shortcuts 配置绑定快捷键（幂等，重复调用仅刷新映射） */
  function bind() {
    comboMap = {}
    for (const action of Object.values(SHORTCUT_ACTIONS)) {
      const combo = settings.shortcuts[action]
      if (combo) comboMap[combo] = action
    }
    if (!bound) {
      // bubble 阶段：让 ShortcutInput 的 capture 监听能先行拦截录制按键
      document.addEventListener('keydown', onKeydown)
      bound = true
    }
    return Promise.resolve({ failed: [] })
  }

  /** 解绑快捷键监听 */
  function unbind() {
    if (bound) {
      document.removeEventListener('keydown', onKeydown)
      bound = false
    }
    comboMap = {}
    return Promise.resolve()
  }

  return { bind, unbind }
}
