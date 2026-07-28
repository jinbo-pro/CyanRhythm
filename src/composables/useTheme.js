import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings.js'

/** 主题切换组合式函数 */
export function useTheme() {
  const settings = useSettingsStore()
  const isDark = computed(() => settings.theme === 'dark')

  function toggle() {
    settings.toggleTheme()
  }

  return { isDark, toggle }
}
