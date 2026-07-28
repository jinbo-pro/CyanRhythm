import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js'
import { getFrequencyData } from '../../composables/useAudioAnalyser.js'

/**
 * 基于 PixiJS 的音频可视化器
 *
 * 视觉元素：
 * 1. 旋转黑胶唱片（中央专辑封面，播放时缓慢旋转）
 * 2. 环形频谱柱（围绕唱片，高度随频域数据实时变化）
 * 3. 漂浮粒子（背景氛围，亮度随低频节拍波动）
 */
export class AudioVisualizer {
  /**
   * @param {HTMLElement} container 挂载 PixiJS canvas 的容器
   * @param {object} [opts]
   */
  constructor(container, opts = {}) {
    this.container = container
    this.app = null

    // 可配置参数
    this.barCount = opts.barCount ?? 72
    this.discRadius = opts.discRadius ?? 120
    this.maxBarLen = opts.maxBarLen ?? 70
    this.barColor = opts.barColor ?? 0x818cf8 // indigo-400
    this.particleCount = opts.particleCount ?? 40
    this.rotationSpeed = opts.rotationSpeed ?? 0.004

    // 场景元素引用
    this.disc = null
    this.coverLayer = null
    this.coverSprite = null
    this.coverMask = null
    this.coverPlaceholder = null
    this.bars = null
    this.particles = []
    this.center = { x: 0, y: 0 }

    this._playing = false
    this._resizeObserver = null
  }

  /** 初始化 PixiJS Application 并搭建场景 */
  async init() {
    this.app = new Application()
    await this.app.init({
      width: this.container.clientWidth || 400,
      height: this.container.clientHeight || 400,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })
    this.container.appendChild(this.app.canvas)

    this._buildScene()
    this._bindTicker()
    this._bindResize()
  }

  /* ------------------------------------------------------------------ *
   * 场景搭建
   * ------------------------------------------------------------------ */

  _buildScene() {
    const { width, height } = this.app.screen
    this.center = { x: width / 2, y: height / 2 }

    // ---- 粒子层（最底层） ----
    this._buildParticles(width, height)

    // ---- 频谱柱层 ----
    this.bars = new Graphics()
    this.app.stage.addChild(this.bars)

    // ---- 唱片容器 ----
    this.disc = new Container()
    this.disc.x = this.center.x
    this.disc.y = this.center.y
    this.app.stage.addChild(this.disc)

    // 黑胶底盘（大圆，深色半透明）
    const vinyl = new Graphics()
    vinyl.circle(0, 0, this.discRadius + 24)
    vinyl.fill({ color: 0x050505, alpha: 0.75 })
    this.disc.addChild(vinyl)

    // 黑胶纹路（同心细环）
    const grooves = new Graphics()
    for (let r = this.discRadius + 6; r <= this.discRadius + 22; r += 4) {
      grooves.circle(0, 0, r)
      grooves.stroke({ width: 1, color: 0xffffff, alpha: 0.04 })
    }
    this.disc.addChild(grooves)

    // 封面层（用子容器方便整体替换）
    this.coverLayer = new Container()
    this.disc.addChild(this.coverLayer)
    this._buildCoverPlaceholder()

    // 中心孔
    const hole = new Graphics()
    hole.circle(0, 0, 7)
    hole.fill({ color: 0x000000, alpha: 0.95 })
    hole.circle(0, 0, 3)
    hole.fill({ color: 0x222222, alpha: 0.8 })
    this.disc.addChild(hole)
  }

  /** 无封面时的占位图形 */
  _buildCoverPlaceholder() {
    const g = new Graphics()
    g.circle(0, 0, this.discRadius)
    g.fill({ color: 0x1e1b4b, alpha: 0.9 }) // indigo-950
    g.circle(0, 0, this.discRadius)
    g.stroke({ width: 2, color: 0x818cf8, alpha: 0.3 })
    // 简单的音符占位
    g.moveTo(-12, -18)
    g.lineTo(-12, 12)
    g.moveTo(-12, 12)
    g.bezierCurveTo(-12, 20, 0, 20, 0, 14)
    g.bezierCurveTo(0, 8, -12, 8, -12, 12)
    g.moveTo(-12, -18)
    g.lineTo(16, -24)
    g.lineTo(16, 0)
    g.moveTo(16, 0)
    g.bezierCurveTo(16, 8, 4, 8, 4, 2)
    g.bezierCurveTo(4, -4, 16, -4, 16, 0)
    g.fill({ color: 0x818cf8, alpha: 0.4 })
    this.coverPlaceholder = g
    this.coverLayer.addChild(g)
  }

  _buildParticles(width, height) {
    this.particles = []
    for (let i = 0; i < this.particleCount; i++) {
      const p = new Graphics()
      const size = 0.8 + Math.random() * 2.2
      p.circle(0, 0, size)
      p.fill({ color: 0xffffff, alpha: 0.2 })
      p.x = Math.random() * width
      p.y = Math.random() * height
      p._vx = (Math.random() - 0.5) * 0.25
      p._vy = (Math.random() - 0.5) * 0.25
      p._baseAlpha = 0.06 + Math.random() * 0.14
      p.alpha = p._baseAlpha
      this.particles.push(p)
      this.app.stage.addChild(p)
    }
  }

  /* ------------------------------------------------------------------ *
   * 动画循环
   * ------------------------------------------------------------------ */

  _bindTicker() {
    this.app.ticker.add(() => this._tick())
  }

  _tick() {
    const data = getFrequencyData()
    const { width, height } = this.app.screen
    const cx = this.center.x
    const cy = this.center.y

    // ---- 唱片旋转 ----
    if (this._playing) {
      this.disc.rotation += this.rotationSpeed
    }

    // ---- 频谱柱 ----
    this.bars.clear()
    const innerR = this.discRadius + 32
    const half = this.barCount / 2

    for (let i = 0; i < this.barCount; i++) {
      // 镜像映射：左右对称，取前 half 个频段
      const dataIdx = i < half ? i : this.barCount - 1 - i
      // 跳过 DC 分量（bin 0），从 bin 1 开始取
      const raw = data ? data[Math.min(dataIdx + 1, data.length - 1)] || 0 : 0
      const value = raw / 255
      const barLen = Math.max(3, value * this.maxBarLen)

      const angle = (i / this.barCount) * Math.PI * 2 - Math.PI / 2
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)

      this.bars.moveTo(cx + cos * innerR, cy + sin * innerR)
      this.bars.lineTo(
        cx + cos * (innerR + barLen),
        cy + sin * (innerR + barLen)
      )
    }
    this.bars.stroke({ width: 3, color: this.barColor, cap: 'round' })

    // ---- 粒子 ----
    // 取前 6 个频段作为低频（节拍）参考
    let bass = 0
    if (data) {
      for (let i = 1; i <= 6; i++) bass += data[i] || 0
      bass = bass / 6 / 255
    }

    for (const p of this.particles) {
      p.x += p._vx
      p.y += p._vy
      // 边界环绕
      if (p.x < -10) p.x = width + 10
      else if (p.x > width + 10) p.x = -10
      if (p.y < -10) p.y = height + 10
      else if (p.y > height + 10) p.y = -10
      // 亮度随低频脉动
      p.alpha = p._baseAlpha + bass * 0.45
    }
  }

  /* ------------------------------------------------------------------ *
   * 公共 API
   * ------------------------------------------------------------------ */

  /** 设置播放/暂停状态（控制唱片旋转） */
  setPlaying(playing) {
    this._playing = !!playing
  }

  /**
   * 更新封面图片（异步加载）
   * @param {string|null} src 封面地址（URL 或 base64），null 显示占位
   */
  async updateCover(src) {
    // 版本号：防止快速切歌时旧请求覆盖新封面
    this._coverVersion = (this._coverVersion || 0) + 1
    const version = this._coverVersion

    // 清除旧封面
    if (this.coverSprite) {
      this.coverLayer.removeChild(this.coverSprite)
      this.coverSprite.destroy()
      this.coverSprite = null
    }
    if (this.coverMask) {
      this.coverLayer.removeChild(this.coverMask)
      this.coverMask.destroy()
      this.coverMask = null
    }

    if (!src) {
      if (this.coverPlaceholder) this.coverPlaceholder.visible = true
      return
    }

    // 先用占位，等图片加载完再替换
    if (this.coverPlaceholder) this.coverPlaceholder.visible = true

    try {
      // 预加载图片：用 HTMLImageElement 避开 PixiJS Assets 对 data-URL 的警告
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = src
      })

      // 加载期间封面又变了，放弃本次结果
      if (version !== this._coverVersion) return

      // 从已加载的 HTMLImageElement 创建纹理（Texture.from 接收图片元素时不会走 Assets 管线）
      const texture = Texture.from(img)

      // 创建圆形遮罩
      this.coverMask = new Graphics()
      this.coverMask.circle(0, 0, this.discRadius)
      this.coverMask.fill(0xffffff)

      this.coverSprite = new Sprite(texture)
      this.coverSprite.anchor.set(0.5)
      const size = this.discRadius * 2
      this.coverSprite.width = size
      this.coverSprite.height = size
      this.coverSprite.mask = this.coverMask

      if (this.coverPlaceholder) this.coverPlaceholder.visible = false
      this.coverLayer.addChild(this.coverSprite)
      this.coverLayer.addChild(this.coverMask)
    } catch (e) {
      // 加载失败：保持占位图
      console.warn('[visualizer] 封面加载失败:', e)
    }
  }

  /* ------------------------------------------------------------------ *
   * 响应式 & 清理
   * ------------------------------------------------------------------ */

  _bindResize() {
    this._resizeObserver = new ResizeObserver(() => this._onResize())
    this._resizeObserver.observe(this.container)
  }

  _onResize() {
    if (!this.app) return
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (w === 0 || h === 0) return
    this.app.renderer.resize(w, h)
    this.center = { x: w / 2, y: h / 2 }
    this.disc.x = this.center.x
    this.disc.y = this.center.y
  }

  destroy() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect()
      this._resizeObserver = null
    }
    if (this.app) {
      this.app.destroy(true, { children: true })
      this.app = null
    }
    this.particles = []
    this.disc = null
    this.bars = null
    this.coverSprite = null
    this.coverMask = null
    this.coverPlaceholder = null
    this.coverLayer = null
  }
}
