# 青律 CyanRhythm 开发者文档

> 本文档面向参与开发、调试或二次开发的技术人员。普通用户使用指南请参阅 [README.md](./README.md)。

---

## 开发原则

复杂能力全部采用成熟开源第三方库，禁止手写底层音频解析、文件遍历、播放内核逻辑。

## 架构迁移说明

本项目由早期 `Node.js + Express` monorepo 架构迁移至 `Tauri 2 + Rust` 架构。原 HTTP API + SSE 通信改为 Tauri `invoke` 命令 + Tauri Event；原音频流接口改为 Tauri `asset` 协议（`convertFileSrc`）直接加载本地文件。

---

## 一、技术架构

### 工程结构
单仓库结构，前后端共存于同一项目：

```
tauri-local-music/
├── src/              # 前端源码（Vue 3 + Vite）
├── src-tauri/        # Rust 后端（Tauri 2 原生模块）
├── index.html
├── vite.config.js
└── package.json
```

### 后端技术栈（src-tauri，Rust）
| 能力 | 库 | 说明 |
|---|---|---|
| 桌面框架 | `tauri` 2 | 原生后端 + WebView，替代 Electron/独立 Node 服务 |
| 音频元数据 | `lofty` | 解析 ID3/FLAC/Vorbis 等标签、封面、时长 |
| 目录遍历 | `walkdir` | 递归扫描音频文件，跳过隐藏目录 |
| 封面编码 | `base64` | 封面转 data URL，随歌曲对象持久化 |
| 歌曲 ID | `sha1` | 基于路径生成稳定 16 位十六进制 id |
| 数据同步加密 | `aes-gcm` + `sha2` | AES-128-GCM 加密，按用户名哈希分桶存入 AppData |
| 在线歌词 | `reqwest` | LRCLIB API 请求（`/get` 精确匹配 + `/search` 降级） |
| 序列化 | `serde` + `serde_json` | 前后端数据结构序列化/反序列化 |
| 系统目录 | `dirs` | 获取主目录、音乐目录、AppData |

### 前端技术栈（src，Vue 3）
| 能力 | 库 | 说明 |
|---|---|---|
| 构建工具 | `vite` | 开发热重载、生产构建 |
| 框架 | `vue` 3 | `<script setup>` 组合式 API + JSX 支持 |
| UI 组件 | `element-plus` | `el-table-v2` 虚拟滚动、`el-dialog`、`el-switch` 等 |
| 样式 | `tailwindcss` 4 | 原子化 CSS，`darkMode:'class'` 深浅主题 |
| 本地存储 | `idb` | IndexedDB Promise 封装，持久化全部数据 |
| 音频播放 | `howler` | 基于 Web Audio 的成熟封装 |
| 音频可视化 | 原生 Canvas 2D | 旋转黑胶 + 环形频谱柱 + 漂浮粒子动画 |
| EQ 均衡器 | Web Audio `BiquadFilterNode` | 10 段实时增益调节 |
| 状态管理 | `pinia` | 媒体库 / 播放器 / 播放列表 / 设置 / 统计 |
| 图标 | `@element-plus/icons-vue` + 自定义 SVG | SVG 经 `vite-svg-loader` 以组件引入 |
| 快捷键 | `@tauri-apps/plugin-global-shortcut` | Tauri 原生全局快捷键（替代 mousetrap） |
| 封面裁剪 | `cropperjs` | 元数据编辑器中的专辑封面裁剪 |
| 像素图标 | `identicon.js` | 无封面歌曲生成像素图标 |
| 实用工具 | `@vueuse/core` | 防抖、响应式工具函数 |
| Tauri 桥接 | `@tauri-apps/api` | `invoke` 调用 Rust 命令、`convertFileSrc` 本地文件加载 |

---

## 二、环境要求

- **Rust** ≥ 1.77（含 `cargo`）
- **Node.js** ≥ 20
- **pnpm** ≥ 9
- Tauri 2 系统依赖：参考 [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)

## 三、快速启动

```bash
# 安装前端依赖
pnpm install

# 开发模式（Vite 热重载 + Tauri 原生后端）
pnpm tauri-dev
```

`pnpm tauri-dev` 会自动：
1. 执行 `pnpm dev` 启动 Vite 开发服务器（固定端口 `1420`）
2. 编译 Rust 后端并打开桌面窗口

也可仅启动前端（用于纯 UI 调试，Tauri 命令不可用）：
```bash
pnpm dev
```

## 四、构建与打包

```bash
# 构建生产桌面应用（Windows 生成 .exe / .msi）
pnpm tauri-build
```

构建产物位于 `src-tauri/target/release/bundle/`。

---

## 五、项目结构

```
tauri-local-music/
├── package.json                 # 前端依赖 + 脚本
├── vite.config.js               # tailwind/vue/vueJsx/svgLoader + @ 别名
├── index.html
├── src/                         # ── 前端 ──
│   ├── main.js                  # 应用入口（Pinia/路由/Element Plus 注册 + 持久化恢复）
│   ├── App.vue                  # 根布局（侧栏 + 主区域 + 播放栏 + 全局弹窗）
│   ├── style.css
│   ├── router/index.js          # 路由（歌曲/专辑/歌手/文件夹/播放列表/统计 + 详情复用）
│   ├── api/index.js             # Tauri invoke 封装 + scanLibraryStream(Event)
│   ├── db/
│   │   ├── index.js             # idb 封装（含 deleteDB 全库清空）
│   │   └── repositories/        # library / playlists / settings / progress / stats
│   ├── stores/                  # Pinia: library / player / playlist / settings / stats
│   ├── composables/
│   │   ├── usePlayer.js         # 播放控制 + formatTime
│   │   ├── useImport.js         # 多目录导入管理 + 流式扫描状态
│   │   ├── useTheme.js          # 深浅主题切换
│   │   ├── useShortcuts.js      # 全局快捷键绑定
│   │   ├── useEqualizer.js      # EQ BiquadFilterNode 控制
│   │   ├── useAudioAnalyser.js  # 频谱分析（供可视化）
│   │   └── useLyrics.js         # 歌词加载与同步滚动
│   ├── utils/
│   │   ├── path.js              # 前端路径工具（Win/Unix 兼容）
│   │   ├── lrcParser.js         # LRC 歌词解析
│   │   ├── identicon.js         # 像素图标生成
│   │   └── eventBus.js          # mitt 事件总线
│   ├── components/
│   │   ├── layout/              # Sidebar / PlayerBar
│   │   ├── song/                # SongTable(虚拟滚动 JSX) / AddToPlaylistPopover
│   │   ├── player/              # PlayerDetail / AudioVisualizer(Canvas 2D) / LyricsPanel
│   │   └── common/              # SettingsDialog/(拆分子模块) / MetadataEditor
│   │                            #   CoverCropper / EqDialog / AlbumCover / 等
│   └── views/                   # SongsView / AlbumsView / ArtistsView
│                                #   FoldersView / PlaylistView / StatsView
├── src-tauri/                   # ── Rust 后端 ──
│   ├── Cargo.toml               # Rust 依赖
│   ├── tauri.conf.json          # Tauri 配置（asset 协议、窗口、打包）
│   ├── capabilities/default.json# 权限配置（fs / opener / core）
│   ├── build.rs
│   └── src/
│       ├── main.rs              # 入口
│       ├── lib.rs               # Tauri 命令注册 + 流式扫描核心逻辑
│       ├── browse.rs            # 目录浏览（盘符/快捷入口/子目录）
│       ├── scanner.rs           # 递归扫描音频文件（walkdir）
│       ├── metadata.rs          # 音频元数据解析（lofty）+ 封面提取 + 写入
│       ├── lyrics.rs            # 歌词获取（内嵌/本地.lrc/在线 LRCLIB）
│       ├── config.rs            # 应用配置读写（LRCLIB 地址等，AppData/config.json）
│       ├── sync.rs              # 本地数据同步（AES-128-GCM 加密）
│       └── models.rs            # 数据结构定义（Song / DirEntry / 等）
└── public/
```

---

## 六、Tauri 命令清单（前后端通信）

前端通过 `@tauri-apps/api/core` 的 `invoke` 调用以下 Rust 命令：

| 命令 | 参数 | 说明 |
|---|---|---|
| `browse_directories` | `{ path }` | 浏览目录树（path 为空返回盘符/快捷入口） |
| `scan_library` | `{ path }` | 非流式扫描，一次性返回歌曲元数据 |
| `scan_library_stream` | `{ scanId, path }` | **流式扫描**：通过 `scan-event-{id}` 事件推送 files→progress，命令返回全部歌曲 |
| `cancel_scan` | `{ scanId }` | 取消正在进行的流式扫描 |
| `get_file_info` | `{ filePath }` | 读取文件详情（大小、创建/修改时间、扩展名） |
| `get_cover_data_url` | `{ filePath }` | 提取封面为 base64 data URL（兼容旧数据） |
| `get_embedded_lyrics` | `{ filePath }` | 仅读取内嵌歌词（不触发在线请求） |
| `get_lyrics` | `{ filePath, title, artist, album, duration }` | 按优先级获取歌词（内嵌→本地.lrc→在线） |
| `get_online_lyrics` | `{ title, artist, album, duration }` | 仅在线获取歌词（元数据编辑器手动触发） |
| `update_audio_metadata` | `{ filePath, title?, ... }` | 写入音频标签（标题/艺术家/歌词/封面等，lofty） |
| `get_app_config` | — | 读取应用配置（LRCLIB 地址等，缺失返回默认值） |
| `save_app_config` | `{ config }` | 保存应用配置到 `AppData/CyanRhythm/config.json` |
| `sync_upload` | `{ dataBase64, username, password }` | 备份数据到 AppData（可选加密） |
| `sync_download` | `{ username, password }` | 从 AppData 恢复数据（加密则解密） |
| `sync_get_backup_info` | `{ username }` | 查询备份信息（路径/大小/加密状态/时间） |
| `sync_delete_backup` | `{ username }` | 删除指定用户名的备份 |
| `get_current_username` | — | 获取系统用户名（用于上传弹窗默认填充） |

音频文件加载不经过命令，而是通过 `convertFileSrc(filePath)` 转为 `asset://` 协议 URL，由 WebView 直接加载（支持 Range/seek）。

---

## 七、架构与实现要点

### 本地文件访问（asset 协议）
- `tauri.conf.json` 中启用 `assetProtocol`，scope 设为 `["**"]`
- 歌曲的 `fileRelPath` 存储绝对路径，前端用 `convertFileSrc()` 转为可播放 URL
- **禁止**将本地文件路径拼成 `http://` 请求——Tauri 沙箱中不存在 HTTP 后端

### 流式扫描
- 前端生成 `scanId`，通过 `listen('scan-event-{id}')` 监听事件
- Rust 端 8 个工作线程并发解析，通过 `app.emit` 推送进度
- 前端 `AbortController` 触发取消，调用 `cancel_scan` 设置标志位

### 封面策略
- 扫描时即用 `lofty` 提取封面转 base64 data URL，内嵌进歌曲对象持久化
- 刷新后前端直接从 IndexedDB 读取，无需再调用 Rust 提取
- `get_cover_data_url` 命令仅用于兼容未存封面字段的旧数据

### 媒体库分组
- `library` store 派生 getter：`albums`（按专辑）、`artists`（按歌手）、`folders`（按 `fileRelPath` 所在目录）
- 专辑/歌手/文件夹**详情页复用 SongsView**，通过 route name 区分过滤

### 歌词获取优先级
- Rust 端 `lyrics.rs` 按优先级获取：内嵌标签（USLT/SYLT）→ 同名 .lrc 文件 → 在线 LRCLIB（`/get` 精确匹配，未命中降级 `/search`）
- LRCLIB 地址从 `config.rs` 读取（`AppData/CyanRhythm/config.json`），缺失/为空时回退默认值 `https://lrclib.net/api`
- 前端 `useLyrics.js` + `lrcParser.js` 解析 LRC 时间轴实现同步滚动

### 虚拟滚动表格
- `SongTable` 与导入管理面板均使用 `el-table-v2` + `el-auto-resizer`
- 列 `cellRenderer` 用 JSX 编写（`<script setup lang="jsx">`），只渲染可视区行
- 支持标题、文件名列点击表头排序（`sortable`），通过 `@column-sort` 事件维护 `sortState` 驱动 `sortedSongs` computed

### 数据持久化注意点
- **Vue 3 响应式对象存入 IndexedDB 前必须用 `toRaw` 脱壳或展开为普通数组**——Proxy 无法被结构化克隆算法序列化
- 设置项防抖写库（400ms），避免拖动滑块频繁 IO
- 清空数据直接 `deleteDB` 删除整个数据库并重建，无需逐表清空

### 数据同步加密
- 密码经 SHA-256 派生 key（前 16 字节）和 iv（末尾 12 字节）
- AES-128-GCM 加密，密文 + authTag 追加存储
- 按用户名 SHA-256 哈希分桶存入 `AppData/CyanRhythm/sync-data/`

### 应用配置外部化
- LRCLIB 地址等配置不再硬编码在源码中，而是读写 `AppData/CyanRhythm/config.json`
- `config.rs` 提供 `load_config`/`save_config`/`get_lrclib_base`，配置缺失或解析失败时返回默认值，保证程序不异常

### 设置面板模块化
- `SettingsDialog` 拆分为独立子模块（`GeneralPanel` / `AppConfigPanel` / `ShortcutsPanel` / `SyncPanel` / `DangerPanel`），主容器仅负责 `el-drawer` + `el-collapse` 框架与展开状态
- 各面板自带所需逻辑（store/db/api），通过 `@` 路径别名引用，抽屉打开时通过 `:open` prop 联动加载数据

---

## 八、推荐 IDE 配置

- [VS Code](https://code.visualstudio.com/)
- [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
