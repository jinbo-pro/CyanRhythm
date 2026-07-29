import { getFrequencyData } from '../../composables/useAudioAnalyser.js'

/**
 * 基于原生 Canvas 2D 的音频可视化器
 *
 * 视觉元素：
 * 1. 旋转黑胶唱片（中央专辑封面，播放时缓慢旋转）
 * 2. 环形频谱柱（围绕唱片，高度随频域数据实时变化）
 * 3. 漂浮粒子（背景氛围，亮度随低频节拍波动）
 */
export class AudioVisualizer {
  /**
   * @param {HTMLElement} container 挂载 canvas 的容器
   * @param {object} [opts]
   */
  constructor(container, opts = {}) {
    this.container = container

    // 可配置参数
    this.barCount = opts.barCount ?? 72
    this.discRadius = opts.discRadius ?? 120
    this.maxBarLen = opts.maxBarLen ?? 70
    this.barColor = opts.barColor ?? '#818cf8' // indigo-400
    this.particleCount = opts.particleCount ?? 40
    this.rotationSpeed = opts.rotationSpeed ?? 0.004

    // 状态
    this._playing = false
    this._rotation = 0
    this._coverImg = null
    this._coverVersion = 0
    this._particles = []
    this._rafId = null
    this._resizeObserver = null

    // 创建 canvas
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')
    this.container.appendChild(this.canvas)

    this._resize()
    this._initParticles()
    this._bindResize()
    this._startLoop()
  }

  /* ------------------------------------------------------------------ *
   * 尺寸 & 响应式
   * ------------------------------------------------------------------ */

  _resize() {
    const dpr = window.devicePixelRatio || 1
    const w = this.container.clientWidth || 400
    const h = this.container.clientHeight || 400
    this._cssW = w
    this._cssH = h
    this._cx = w / 2
    this._cy = h / 2
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.canvas.style.width = w + 'px'
    this.canvas.style.height = h + 'px'
    // 重置变换矩阵为 dpr 缩放，后续绘制坐标全部用 CSS 像素
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  _bindResize() {
    this._resizeObserver = new ResizeObserver(() => this._resize())
    this._resizeObserver.observe(this.container)
  }

  /* ------------------------------------------------------------------ *
   * 粒子
   * ------------------------------------------------------------------ */

  _initParticles() {
    this._particles = []
    for (let i = 0; i < this.particleCount; i++) {
      this._particles.push({
        x: Math.random() * this._cssW,
        y: Math.random() * this._cssH,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        size: 0.8 + Math.random() * 2.2,
        baseAlpha: 0.06 + Math.random() * 0.14,
      })
    }
  }

  /* ------------------------------------------------------------------ *
   * 动画循环
   * ------------------------------------------------------------------ */

  _startLoop() {
    const loop = () => {
      this._render()
      this._rafId = requestAnimationFrame(loop)
    }
    this._rafId = requestAnimationFrame(loop)
  }

  _render() {
    const ctx = this.ctx
    const w = this._cssW
    const h = this._cssH
    const cx = this._cx
    const cy = this._cy

    ctx.clearRect(0, 0, w, h)

    const data = getFrequencyData()

    // ---- 粒子（最底层） ----
    let bass = 0
    if (data) {
      for (let i = 1; i <= 6; i++) bass += data[i] || 0
      bass = bass / 6 / 255
    }
    for (const p of this._particles) {
      p.x += p.vx
      p.y += p.vy
      if (p.x < -10) p.x = w + 10
      else if (p.x > w + 10) p.x = -10
      if (p.y < -10) p.y = h + 10
      else if (p.y > h + 10) p.y = -10

      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${(p.baseAlpha + bass * 0.45).toFixed(3)})`
      ctx.fill()
    }

    // ---- 环形频谱柱 ----
    const innerR = this.discRadius + 32
    const half = this.barCount / 2
    ctx.lineWidth = 3
    ctx.strokeStyle = this.barColor
    ctx.lineCap = 'round'
    ctx.beginPath()
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

      ctx.moveTo(cx + cos * innerR, cy + sin * innerR)
      ctx.lineTo(cx + cos * (innerR + barLen), cy + sin * (innerR + barLen))
    }
    ctx.stroke()

    // ---- 旋转唱片 ----
    if (this._playing) this._rotation += this.rotationSpeed

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(this._rotation)

    // 黑胶底盘
    ctx.beginPath()
    ctx.arc(0, 0, this.discRadius + 24, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(5,5,5,0.75)'
    ctx.fill()

    // 黑胶纹路（同心细环）
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    for (let r = this.discRadius + 6; r <= this.discRadius + 22; r += 4) {
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.stroke()
    }

    // 封面或占位图
    if (this._coverImg) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(0, 0, this.discRadius, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(
        this._coverImg,
        -this.discRadius,
        -this.discRadius,
        this.discRadius * 2,
        this.discRadius * 2
      )
      ctx.restore()
    } else {
      this._drawPlaceholder(ctx)
    }

    // 中心孔
    ctx.beginPath()
    ctx.arc(0, 0, 7, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.95)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, 0, 3, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(34,34,34,0.8)'
    ctx.fill()

    ctx.restore()
  }

  /** 无封面时的占位图形（简单音符） */
  _drawPlaceholder(ctx) {
    ctx.beginPath()
    ctx.arc(0, 0, this.discRadius, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(30,27,75,0.9)' // indigo-950
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(129,140,248,0.3)'
    ctx.stroke()

    // 八分音符
    ctx.fillStyle = 'rgba(129,140,248,0.4)'
    ctx.beginPath()
    ctx.moveTo(-12, -18)
    ctx.lineTo(-12, 12)
    ctx.moveTo(-12, 12)
    ctx.bezierCurveTo(-12, 20, 0, 20, 0, 14)
    ctx.bezierCurveTo(0, 8, -12, 8, -12, 12)
    ctx.moveTo(-12, -18)
    ctx.lineTo(16, -24)
    ctx.lineTo(16, 0)
    ctx.moveTo(16, 0)
    ctx.bezierCurveTo(16, 8, 4, 8, 4, 2)
    ctx.bezierCurveTo(4, -4, 16, -4, 16, 0)
    ctx.fill()
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
   * @param {string|null} src 封面地址，null 显示占位
   */
  setCover(src) {
    this._coverVersion++
    const version = this._coverVersion

    if (!src) {
      this._coverImg = null
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (version !== this._coverVersion) return
      this._coverImg = img
    }
    img.onerror = () => {
      if (version !== this._coverVersion) return
      console.warn('[visualizer] 封面加载失败')
      this._coverImg = null
    }
    img.src = src
  }

  destroy() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect()
      this._resizeObserver = null
    }
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas)
    }
    this._particles = []
    this._coverImg = null
  }
}
