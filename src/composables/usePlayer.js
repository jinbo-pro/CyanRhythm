import { usePlayerStore } from '../stores/player.js'

/** 秒数格式化为 m:ss */
export function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** 播放控制组合式函数，统一暴露常用操作 */
export function usePlayer() {
  const player = usePlayerStore()
  return {
    player,
    play: () => player.play(),
    pause: () => player.pause(),
    toggle: () => player.toggle(),
    next: () => player.next(),
    prev: () => player.prev(),
    seek: (sec) => player.seekTo(sec),
  }
}
