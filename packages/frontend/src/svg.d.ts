/**
 * 让 JS/IDE 识别 .svg 模块（配合 vite-svg-loader，默认以组件形式引入）。
 * 如需作为 URL 引入，使用 query：import url from './x.svg?url'
 */
declare module '*.svg' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare module '*.svg?url' {
  const src: string
  export default src
}
