import mitt from 'mitt'

// 全局事件总线，用于跨组件通信
// 使用：eventBus.emit('open-settings') / eventBus.on('open-settings', handler)
export const eventBus = mitt()

// 集中管理事件名，避免散落字符串
export const EVENTS = {
  OPEN_SETTINGS: 'open-settings',
  OPEN_IMPORT: 'open-import',
}
