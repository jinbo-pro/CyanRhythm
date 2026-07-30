import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut'
import { useSettingsStore, SHORTCUT_ACTIONS } from '../stores/settings.js'
import { usePlayerStore } from '../stores/player.js'

/**
 * 将 DOM keydown 事件转换为 Tauri global-shortcut 格式的组合字符串
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
 * 全局快捷键绑定 composable
 * 基于 tauri-plugin-global-shortcut，快捷键在系统级别生效（无需窗口聚焦）
 * 每次调用 bind() 会先 unregisterAll 再重新注册，便于配置变更后刷新
 */
export function useShortcuts() {
  const settings = useSettingsStore()
  const player = usePlayerStore()

  // 串行锁：避免快速连续修改快捷键时多个 bind() 并发导致注册竞态
  let bindChain = Promise.resolve()

  /** 各动作对应的处理函数 */
  const handlers = {
    [SHORTCUT_ACTIONS.PLAY_PAUSE]: () => player.toggle(),
    [SHORTCUT_ACTIONS.PREV]: () => player.prev(),
    [SHORTCUT_ACTIONS.NEXT]: () => player.next(),
  }

  /** 解绑全部已注册的全局快捷键 */
  async function unbind() {
    try {
      await unregisterAll()
    } catch (e) {
      console.error('[shortcuts] unregisterAll failed:', e)
    }
  }

  /** 按当前 settings.shortcuts 配置注册全局快捷键，返回注册失败的列表 */
  async function bind() {
    // 串行化：每次调用排队等待上一次完成
    const run = bindChain.then(async () => {
      await unbind()
      const failed = []
      for (const action of Object.values(SHORTCUT_ACTIONS)) {
        const combo = settings.shortcuts[action]
        if (!combo) continue
        try {
          // handler 收到 ShortcutEvent，包含 state（Pressed/Released）
          // 仅在 Pressed 时触发动作，避免按下+释放重复执行
          await register(combo, (event) => {
            if (event?.state === 'Pressed') handlers[action]?.()
          })
        } catch (e) {
          console.error(`[shortcuts] 注册失败 "${combo}":`, e)
          failed.push(combo)
        }
      }
      // 系统级注册失败提示用户（如被其他应用占用）
      if (failed.length) {
        ElMessage.error(
          `快捷键注册失败：${failed.map(formatCombo).join('、')}，可能被其他程序占用`
        )
      }
      return { failed }
    })
    // 保持链不断裂：即使某次出错也不影响后续调用
    bindChain = run.catch(() => {})
    return run
  }

  return { bind, unbind }
}
