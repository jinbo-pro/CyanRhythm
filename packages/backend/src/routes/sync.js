import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import multer from 'multer'

export const syncRouter = Router()

// 数据存储根目录 ./data（相对于服务运行目录）
const DATA_DIR = path.resolve(process.cwd(), './data')

// 内存上传中间件（不落临时磁盘，直接拿到 Buffer）
const upload = multer({ storage: multer.memoryStorage() })

/**
 * AES-128-GCM 加密
 * 密码经 SHA-256 取前 16 字节为 key、后 12 字节为 iv，
 * 输出 = 密文 + GCM authTag（与浏览器端 aesDecrypt 互为逆运算）。
 * @param {Buffer} data 待加密的数据
 * @param {string} password 加密密码
 * @returns {Buffer} 加密后的 Buffer（密文 + authTag）
 */
function encryptBuffer(data, password) {
  const hashBuffer = crypto.createHash('sha256').update(Buffer.from(password, 'utf8')).digest()
  const hashU8 = new Uint8Array(hashBuffer)
  const key = hashU8.slice(0, 16)
  const iv = hashU8.slice(-12)
  const cipher = crypto.createCipheriv('aes-128-gcm', key, iv)
  const encryptedData = Buffer.concat([cipher.update(data), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([encryptedData, authTag])
}

/**
 * AES-128-GCM 解密（encryptBuffer 的逆运算）
 * @param {Buffer} data 加密后的 Buffer（密文 + authTag）
 * @param {string} password 加密密码
 * @returns {Buffer} 解密后的原始数据
 */
function decryptBuffer(data, password) {
  const hashBuffer = crypto.createHash('sha256').update(Buffer.from(password, 'utf8')).digest()
  const hashU8 = new Uint8Array(hashBuffer)
  const key = hashU8.slice(0, 16)
  const iv = hashU8.slice(-12)
  // authTag 固定位于末尾 16 字节
  const authTag = data.subarray(-16)
  const encryptedData = data.subarray(0, -16)
  const decipher = crypto.createDecipheriv('aes-128-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encryptedData), decipher.final()])
}

/**
 * 用户名哈希分桶：SHA-256 取前 16 个十六进制字符，作为 ./data 下的子目录名。
 * @param {string} username
 * @returns {string}
 */
function hashUsername(username) {
  return crypto.createHash('sha256').update(username, 'utf8').digest('hex').slice(0, 16)
}

/**
 * POST /api/sync/upload
 * multipart form 字段：
 *  - file：数据文件（必填）
 *  - username：用户名（必填）
 *  - password：密码（选填，有则加密）
 * 按用户名哈希分桶保存到 ./data/<hash>/，直接覆盖。
 */
syncRouter.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    const username = (req.body?.username || '').trim()
    const password = req.body?.password || ''

    if (!username) {
      const err = new Error('用户名不能为空')
      err.status = 400
      throw err
    }
    if (!req.file) {
      const err = new Error('未收到上传文件')
      err.status = 400
      throw err
    }

    const bucket = hashUsername(username)
    const bucketDir = path.resolve(DATA_DIR, bucket)
    fs.mkdirSync(bucketDir, { recursive: true })

    let fileBuffer = req.file.buffer
    const meta = { encrypted: false, uploadedAt: new Date().toISOString(), username }

    if (password) {
      fileBuffer = encryptBuffer(fileBuffer, password)
      meta.encrypted = true
    }

    fs.writeFileSync(path.resolve(bucketDir, 'data.bin'), fileBuffer)
    fs.writeFileSync(path.resolve(bucketDir, 'meta.json'), JSON.stringify(meta, null, 2))

    res.json({ ok: true, bucket, encrypted: meta.encrypted, size: fileBuffer.length })
  } catch (e) {
    next(e)
  }
})

/**
 * GET /api/sync/download?username=&password=
 * 按用户名哈希分桶读取数据，加密则解密后以 JSON 返回。
 */
syncRouter.get('/download', async (req, res, next) => {
  try {
    const username = (req.query.username || '').toString().trim()
    const password = (req.query.password || '').toString()

    if (!username) {
      const err = new Error('用户名不能为空')
      err.status = 400
      throw err
    }

    const bucket = hashUsername(username)
    const bucketDir = path.resolve(DATA_DIR, bucket)
    const dataFile = path.resolve(bucketDir, 'data.bin')

    if (!fs.existsSync(dataFile)) {
      const err = new Error('服务器上暂无该用户的同步数据')
      err.status = 404
      throw err
    }

    let fileBuffer = fs.readFileSync(dataFile)

    // 读取 meta.json 判断是否加密
    let encrypted = false
    const metaFile = path.resolve(bucketDir, 'meta.json')
    try {
      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'))
      encrypted = !!meta.encrypted
    } catch {
      /* meta.json 不存在则按未加密处理 */
    }

    if (encrypted) {
      if (!password) {
        const err = new Error('该数据已加密，请输入密码')
        err.status = 403
        throw err
      }
      try {
        fileBuffer = decryptBuffer(fileBuffer, password)
      } catch {
        const err = new Error('密码错误，解密失败')
        err.status = 403
        throw err
      }
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.send(fileBuffer)
  } catch (e) {
    next(e)
  }
})
