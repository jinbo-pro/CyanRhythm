# 本地音乐播放器（Tauri + Vue 3）

一款**纯本地运行的桌面音乐播放器**，无云端服务、不联网，仅访问用户本地音频文件。采用 Tauri 2 将 Rust 原生后端与 Vue 3 前端打包为单一桌面应用，前端基于 IndexedDB 持久化全部数据。

开发原则：复杂能力全部采用成熟开源第三方库，禁止手写底层音频解析、文件遍历、播放内核逻辑。

> 本项目由早期 `Node.js + Express` monorepo 架构迁移至 `Tauri 2 + Rust` 架构。原 HTTP API + SSE 通信改为 Tauri `invoke` 命令 + Tauri Event；原音频流接口改为 Tauri `asset` 协议（`convertFileSrc`）直接加载本地文件。

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
| 音频可视化 | `pixi.js` | WebGL 频谱音浪动画 |
| EQ 均衡器 | Web Audio `BiquadFilterNode` | 10 段实时增益调节 |
| 状态管理 | `pinia` | 媒体库 / 播放器 / 播放列表 / 设置 / 统计 |
| 图标 | `@element-plus/icons-vue` + 自定义 SVG | SVG 经 `vite-svg-loader` 以组件引入 |
| 快捷键 | `mousetrap` | 全局播放控制快捷键 |
| Tauri 桥接 | `@tauri-apps/api` | `invoke` 调用 Rust 命令、`convertFileSrc` 本地文件加载 |

---

## 二、核心功能

### 1. 本地音乐导入 & 多目录管理
- 支持**浏览电脑任意目录**（盘符 + 快捷入口 + 手动输入路径）
- 导入采用 **Tauri Event 流式扫描**：先推送文件清单，再并发解析并逐条上报进度
- 支持格式：**mp3 / flac / wav / aac / m4a**
- 解析元信息：歌曲名、歌手、专辑、专辑艺术家、时长、发行年份、专辑封面
- 封面以 **base64 内嵌**到歌曲对象，随 IndexedDB 持久化（刷新无需再解析）
- **多目录管理**：支持添加多个目录，每个目录可独立「更新」（重新扫描替换）或「删除」（移除目录及其歌曲）
- 导入管理面板使用 `el-table-v2` 虚拟表格展示全部文件，无数量上限

### 2. 播放器控制
- 播放 / 暂停、上一曲、下一曲
- 播放进度拖拽调节
- 音量调节、静音切换
- 三种播放模式：顺序播放 / 单曲循环 / 随机播放（自定义 SVG 图标）

### 3. 播放列表 & 收藏
- 新建、删除、重命名自定义播放列表（支持排序字段）
- 内置「我的收藏」播放列表（爱心图标一键收藏）
- 歌曲添加至播放列表、从列表移除

### 4. EQ 均衡器 & 音频可视化
- 10 段均衡器（BiquadFilterNode），支持启用/禁用、增益滑块、预设
- 播放详情页 Pixi.js 驱动的实时频谱音浪动画

### 5. 播放统计
- 记录每首歌曲的播放次数与累计播放时长
- 独立的统计视图，支持数据可视化

### 6. 本地数据同步（备份/恢复）
- 将全部数据（歌曲、播放列表、统计、进度）备份到本地 AppData 目录
- 按用户名分桶，支持 AES-128-GCM 密码加密
- 从 AppData 恢复数据，覆盖本地

### 7. 全局快捷键
- 播放/暂停、上一曲、下一曲（默认 `Space` / `←` / `→`，可在设置中自定义）

### 8. 本地数据持久化（IndexedDB）
刷新/重启后自动恢复：
- 全部歌曲数据（元数据 + 内嵌封面 base64）
- 已扫描目录列表
- 用户自定义播放列表（含排序、歌曲 id）
- 播放器配置（音量、播放模式、主题、列表显示开关、EQ 配置、快捷键）
- 上次播放歌曲与播放进度
- 播放统计数据

---

## 三、环境要求

- **Rust** ≥ 1.77（含 `cargo`）
- **Node.js** ≥ 20
- **pnpm** ≥ 9
- Tauri 2 系统依赖：参考 [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)

## 四、快速启动

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

## 五、构建与打包

```bash
# 构建生产桌面应用（Windows 生成 .exe / .msi）
pnpm tauri-build
```

构建产物位于 `src-tauri/target/release/bundle/`。

## 六、使用流程

1. 启动应用后，点击侧栏底部「导入音乐」按钮打开**导入管理面板**
2. 点击「添加目录」，在文件夹选择器中浏览（盘符 / 快捷入口 / 手动输入），选择包含音频文件的文件夹
3. 流式扫描实时显示：发现文件数、解析进度、成功/失败数
4. 在「歌曲 / 专辑 / 歌手 / 文件夹」视图中浏览，点击播放
5. 可对已导入的目录执行「更新」（重新扫描）或「删除」（移除目录及歌曲）
6. 左侧侧边栏可新建/编辑/删除自定义播放列表，歌曲行内「+」加入列表、爱心收藏
7. 底部播放栏：播放控制、进度拖拽、音量、播放模式、EQ 均衡器入口
8. 点击播放栏打开全屏播放详情（频谱可视化动画）
9. 设置面板：快捷键自定义、列表显示项、数据同步、清空数据

---

## 七、项目结构

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
│   │   └── useAudioAnalyser.js  # 频谱分析（供可视化）
│   ├── utils/
│   │   ├── path.js              # 前端路径工具（Win/Unix 兼容）
│   │   └── eventBus.js          # mitt 事件总线
│   ├── components/
│   │   ├── layout/              # Sidebar / PlayerBar
│   │   ├── song/                # SongTable(虚拟滚动 JSX) / AddToPlaylistPopover
│   │   ├── player/              # PlayerDetail / AudioVisualizer(Pixi.js)
│   │   └── common/              # SettingsDialog / ImportProgressDialog / FolderPicker
│   │                            #   PlaylistEditor / EqDialog / AlbumCover / 等
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
│       ├── metadata.rs          # 音频元数据解析（lofty）+ 封面提取
│       ├── sync.rs              # 本地数据同步（AES-128-GCM 加密）
│       └── models.rs            # 数据结构定义（Song / DirEntry / 等）
└── public/
```

---

## 八、Tauri 命令清单（前后端通信）

前端通过 `@tauri-apps/api/core` 的 `invoke` 调用以下 Rust 命令：

| 命令 | 参数 | 说明 |
|---|---|---|
| `browse_directories` | `{ path }` | 浏览目录树（path 为空返回盘符/快捷入口） |
| `scan_library` | `{ path }` | 非流式扫描，一次性返回歌曲元数据 |
| `scan_library_stream` | `{ scanId, path }` | **流式扫描**：通过 `scan-event-{id}` 事件推送 files→progress，命令返回全部歌曲 |
| `cancel_scan` | `{ scanId }` | 取消正在进行的流式扫描 |
| `get_cover_data_url` | `{ filePath }` | 提取封面为 base64 data URL（兼容旧数据） |
| `sync_upload` | `{ dataBase64, username, password }` | 备份数据到 AppData（可选加密） |
| `sync_download` | `{ username, password }` | 从 AppData 恢复数据（加密则解密） |

音频文件加载不经过命令，而是通过 `convertFileSrc(filePath)` 转为 `asset://` 协议 URL，由 WebView 直接加载（支持 Range/seek）。

---

## 九、架构与实现要点

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

### 虚拟滚动表格
- `SongTable` 与导入管理面板均使用 `el-table-v2` + `el-auto-resizer`
- 列 `cellRenderer` 用 JSX 编写（`<script setup lang="jsx">`），只渲染可视区行

### 数据持久化注意点
- **Vue 3 响应式对象存入 IndexedDB 前必须用 `toRaw` 脱壳或展开为普通数组**——Proxy 无法被结构化克隆算法序列化
- 设置项防抖写库（400ms），避免拖动滑块频繁 IO
- 清空数据直接 `deleteDB` 删除整个数据库并重建，无需逐表清空

### 数据同步加密
- 密码经 SHA-256 派生 key（前 16 字节）和 iv（末尾 12 字节）
- AES-128-GCM 加密，密文 + authTag 追加存储
- 按用户名 SHA-256 哈希分桶存入 `AppData/com.lijin.tauri-local-music/sync-data/`

---

## 十、推荐 IDE 配置

- [VS Code](https://code.visualstudio.com/)
- [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
