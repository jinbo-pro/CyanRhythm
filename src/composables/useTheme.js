import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings.js'

/** 主题切换组合式函数 */
export function useTheme() {
  const settings = useSettingsStore()
  const isDark = computed(() => settings.theme === 'dark')

  /**
   * 切换深浅主题
   * 传入鼠标事件时启用 View Transitions API 的圆形扩散动画
   * （效果与 Element Plus 官方文档暗黑模式切换一致）
   */
  function toggle(event) {
    // 浏览器不支持 View Transitions 或未传入事件时，直接切换
    if (!event || !document.startViewTransition) {
      settings.toggleTheme()
      return
    }

    const x = event.clientX
    const y = event.clientY
    // 从点击点到视口最远顶点的距离，作为扩散圆的最大半径
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    )

    // 在回调中执行真实的 DOM 主题切换，让 View Transitions 捕获前后快照
    const transition = document.startViewTransition(() => {
      settings.toggleTheme()
    })

    transition.ready
      .then(() => {
        const clipPath = [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`,
        ]
        document.documentElement.animate(
          { clipPath },
          {
            duration: 400,
            easing: 'ease-in-out',
            pseudoElement: '::view-transition-new(root)',
          },
        )
      })
      .catch(() => {
        // 过渡被中断时无需处理，主题状态已在回调中正常更新
      })
  }

  return { isDark, toggle }
}
