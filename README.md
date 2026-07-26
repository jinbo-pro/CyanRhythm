# 本地音乐播放器｜AI开发需求文档
## 项目概述
开发一款**纯本地运行桌面音乐播放器**，无云端服务，仅访问用户本地音频文件。整体采用 pnpm monorepo 架构拆分前后端；后端 Node+Express 负责文件扫描、音频元信息读取、文件流接口；前端 Vite+Vue3 实现 iTunes 风格可视化界面，基于 IndexedDB 持久化播放器数据。
开发原则：复杂能力全部采用成熟开源第三方库，禁止手写底层音频解析、文件遍历、播放内核逻辑。

## 一、整体技术架构
### 工程结构
pnpm monorepo 项目，packages 拆分两个工作空间：
- `packages/backend`：Node.js Express 后端服务
- `packages/frontend`：Vite + Vue3 前端应用

### 后端技术栈（packages/backend）
1. 运行环境：Node.js
2. Web服务框架：Express
3. 文件操作：node 原生 fs/promises
4. 能力范围：本地目录扫描、音频文件元数据（ID3标签、专辑封面）解析、音频文件流式输出接口
5. 规范：使用成熟库解析音频标签，不手写ID3解析逻辑

### 前端技术栈（packages/frontend）
1. 构建工具：Vite
2. 框架：Vue3 + `<script setup>` 组合式API（含 JSX 支持）
3. UI组件库：Element Plus（el-table-v2 虚拟滚动表格、el-dialog、el-switch 等）
4. 样式：TailwindCSS，UI风格参考 iTunes
5. 本地存储：idb（IndexedDB封装库）
6. 音频播放：Howler.js（基于 Web Audio / HTML5 Audio 的成熟封装）
7. 状态管理：Pinia
8. 图标：Element Plus Icons + 自定义 SVG（vite-svg-loader，组件形式引入）
9. 额外：支持浅色/深色主题切换

## 二、核心功能清单
### 1. 本地音乐导入 & 媒体库管理
- 支持**选择电脑任意目录**（盘符浏览 + 快捷入口），后端递归扫描音频文件
- 导入采用 SSE 流式扫描，实时显示进度
- 支持格式：mp3、flac、wav、aac、m4a 主流音频格式
- 解析音频元信息：歌曲名、歌手、专辑、时长、专辑封面、发行年份
- 封面以 base64 内嵌到歌曲对象，随 IndexedDB 持久化（刷新无需再请求后端）
- 媒体库多视图：歌曲列表、专辑封面墙、歌手分类、**文件夹分类**（iTunes布局逻辑）

### 2. 播放器基础控制
- 播放 / 暂停
- 上一曲、下一曲切换
- 播放进度拖拽调节
- 音量调节、静音切换

### 3. 播放模式切换
- 顺序播放
- 单曲循环
- 随机播放

### 4. 播放队列 & 自定义播放列表
- 当前临时播放队列展示
- 新建、删除、重命名自定义播放列表
- 歌曲添加至播放列表、从列表移除歌曲

### 5. 本地数据持久化（前端 idb）
持久化存储数据，刷新页面/重启项目不丢失：
- 用户所有自定义播放列表（含名称、排序字段 sort、歌曲 id 列表）
- 播放器配置（音量、默认播放模式、主题模式、**列表显示个性化开关**）
- 上次播放位置、当前播放歌曲
- 全部歌曲数据（元数据 + 内嵌封面 base64）

### 6. 设置中心
- 列表显示个性化：显示封面 / 显示专辑列 / 显示序号（全局开关）
- 数据管理：导出全部音乐数据为 JSON、从 JSON 导入（覆盖现有数据）
- 危险操作：清空所有数据（二次确认）

## 三、UI界面规范
整体视觉参考 iTunes 经典播放器布局：
1. 左侧侧边栏：媒体库分类 + 用户播放列表导航
2. 主区域：歌曲表格 / 专辑封面墙，视图切换按钮
3. 页面底部：常驻播放控制栏（播放器底座，永不消失）
4. 支持深色/浅色主题切换
5. 布局留白充足，简约现代风格

## 四、开发约束与硬性规则
1. **禁止手搓底层复杂逻辑**：音频标签解析、文件递归遍历、播放调度等全部使用成熟第三方开源库；
2. 全程前后端接口通信，前端不直接访问本地文件系统（安全沙箱限制）；
3. 项目纯离线运行，无任何网络请求、不上传任何本地文件；
4. 代码结构高内聚低耦合，接口统一规范，增加注释；
5. 代码遵循ESModule规范，统一代码格式化风格；
6. 所有依赖写明版本，提供完整启动、开发、构建脚本。

## 五、需要产出内容（向AI下达开发指令）
请依据本文档需求，依次输出以下内容：
1. monorepo 完整项目目录树形结构
2. 根目录 & packages下各模块 package.json 完整配置、所需依赖清单
3. 后端：
   - 路由接口清单（RESTful）
   - 核心服务代码：文件扫描、音频元信息解析、音频流接口
4. 前端：
   - Pinia状态设计（媒体库、播放器、播放列表、全局设置）
   - IndexedDB(idb) 数据表结构与封装工具
   - 页面、公共组件代码（侧边栏、底部播放器、歌曲列表、专辑墙）
5. 项目启动命令说明、开发调试方式
6. 关键第三方库选型说明与使用示例

## 六、禁止实现内容
1. 不引入云音乐搜索、在线音源、歌词联网下载功能；
2. 不开发音频格式转换、音频编辑功能；
3. 不使用Electron（当前方案：后端独立node服务 + web前端访问）；
4. 不做复杂权限、多用户管理。

---

# 实现说明与启动指南（已实现）

## 环境要求
- Node.js ≥ 20（推荐使用 [.nvmrc](.nvmrc) 指定版本）
- pnpm ≥ 9（已验证 pnpm 11）

## 快速启动

```bash
# 1. 安装依赖（根目录执行，自动安装两个 workspace）
pnpm install

# 2. 一键同时启动前后端（推荐）
pnpm dev
```

`pnpm dev` 执行流程：
1. 先跑 `resolve:port` 脚本，用 get-port 探测可用端口并写入 `packages/backend/.port`、同步写入 `packages/frontend/.env.local`（`VITE_BACKEND_PORT`）
2. 使用 concurrently 并发启动后端（nodemon）与前端（vite）

启动后：
- 前端：http://localhost:5173
- 后端：端口为探测出的可用端口（默认回退 18080），前端已通过 Vite proxy 自动转发 `/api`

也可分别启动：
```bash
pnpm dev:backend   # 仅后端（nodemon 热重载）
pnpm dev:frontend  # 仅前端
```

## 音乐根目录配置
后端默认以系统音乐目录（如 `C:\Users\<你>\Music`）为「快捷入口」默认起点。可通过环境变量指定：

```powershell
# PowerShell
$env:MUSIC_ROOT="D:\\我的音乐"; pnpm dev
```
```bash
# bash
MUSIC_ROOT=/path/to/music pnpm dev
```
> 注意：当前版本**支持浏览与导入电脑上的任意目录**（盘符浏览 + 快捷入口），MUSIC_ROOT 仅作为文件选择器的默认起点，不再限定扫描范围。

## 使用流程
1. 打开 http://localhost:5173 ，点击右上角「导入音乐」
2. 在弹出的文件夹选择器中浏览（支持盘符 / 快捷入口 / 任意目录），选择一个包含音频文件的文件夹，点击「导入此文件夹」
3. SSE 流式扫描：实时显示发现文件数、解析进度，后端递归扫描 `mp3/flac/wav/aac/m4a` 并解析元数据（标题/歌手/专辑/时长/年份/封面）
4. 在「歌曲 / 专辑 / 歌手 / 文件夹」视图中浏览，双击或点击播放
5. 左侧侧边栏可新建/重命名/删除自定义播放列表，歌曲可加入列表
6. 底部播放栏：播放控制、进度拖拽、音量、静音、播放模式（顺序/单曲循环/随机，自定义 SVG 图标）
7. 右上角太阳/月亮图标切换深浅主题
8. 「设置」弹窗：列表显示个性化开关、数据导入导出、清空数据

刷新或重启后：全部歌曲数据、自定义播放列表、播放器配置（音量/模式/主题/列表显示项）、上次播放歌曲与进度均自动恢复（IndexedDB 持久化）。

## 构建与生产运行
```bash
pnpm build         # 构建前端到 packages/frontend/dist
pnpm start         # 启动后端生产服务（node）
```

## 项目结构
```
local-music/
├── package.json              # 根：workspace 与 dev/build/start 脚本
├── pnpm-workspace.yaml       # workspace + 构建脚本白名单
├── .nvmrc
├── .gitignore                # 忽略 node_modules/dist 及 .port/.env.local
└── packages/
    ├── backend/              # @local-music/backend
    │   ├── .port             # dev 启动时由 resolve-port 脚本写入（git 忽略）
    │   ├── scripts/resolve-port.mjs  # get-port 探测可用端口并写入 .port / 前端 .env.local
    │   └── src/
    │       ├── index.js      # 入口
    │       ├── app.js        # Express 装配（cors/路由/错误处理）
    │       ├── config.js     # 端口探测/音乐根目录/任意路径解析/系统盘符枚举
    │       ├── utils/audioFormats.js
    │       ├── services/scanner.js   # 递归扫描 + 目录浏览
    │       ├── services/metadata.js  # music-metadata 解析 + 封面 base64 内嵌
    │       └── routes/        # browse / library(scan, scan-stream SSE) / audio(range) / cover
    └── frontend/             # @local-music/frontend
        ├── .env.local        # dev 启动时由 resolve-port 写入 VITE_BACKEND_PORT（git 忽略）
        ├── vite.config.js    # tailwind/vue/vueJsx/viteSvgLoader + proxy
        ├── jsconfig.json     # @ 别名 + svg 模块声明
        └── src/
            ├── main.js / App.vue / style.css
            ├── svg.d.ts               # *.svg 模块类型声明（组件/URL）
            ├── router/        # 路由（歌曲/专辑/歌手/文件夹/播放列表 + 详情复用 SongsView）
            ├── api/           # axios 封装 + scanLibraryStream(SSE)
            ├── db/            # idb 封装 + repositories(library/playlists/settings/progress)
            ├── stores/        # Pinia: library(含 albums/artists/folders) / player / playlist / settings
            ├── composables/   # useTheme / usePlayer / useImport
            ├── utils/path.js  # 前端路径工具（兼容 Win/Unix，供文件夹分组用）
            ├── assets/icons/  # 自定义 SVG 图标（play-sequence/loop/shuffle.svg）
            ├── components/
            │   ├── layout/    # Sidebar / PlayerBar
            │   ├── song/      # SongTable(JSX)/ AddToPlaylistPopover
            │   └── common/    # SettingsDialog / PlaylistEditor / FolderPicker / ImportProgressDialog / AlbumCover / EmptyGuide / PlayModeIcon
            └── views/         # SongsView / AlbumsView / ArtistsView / FoldersView / PlaylistView
```

## 后端 API 清单
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/browse?path=` | 列出目录下的子文件夹（path 为空返回系统盘符/快捷入口）|
| POST | `/api/library/scan` | body `{ path }`，递归扫描并返回歌曲元数据数组 |
| POST | `/api/library/scan-stream` | body `{ path }`，**SSE 流式扫描**：files→progress→done 事件 |
| GET | `/api/audio?file=` | 音频流式输出（支持 HTTP Range，供进度拖拽）|
| GET | `/api/cover?file=` | 输出专辑封面图片 |

## 关键第三方库选型
| 能力 | 库 | 说明 |
|---|---|---|
| Web 服务 | express | 成熟稳定的 Node Web 框架 |
| 音频元数据 | music-metadata | 解析 ID3/FLAC/Vorbis 标签、封面、时长，不手写解析 |
| 端口探测 | get-port | dev 启动自动探测可用端口，避免端口冲突 |
| UI 组件 | element-plus | el-table-v2 虚拟滚动表格、el-dialog、el-switch 等 |
| JSX | @vitejs/plugin-vue-jsx | SFC 内用 JSX 编写 cellRenderer，替代 h() 嵌套 |
| SVG 图标 | vite-svg-loader | `.svg` 默认以组件形式引入，`fill=none, stroke=currentColor` |
| 音频播放 | howler | 基于 Web Audio 的成熟封装，支持 seek/流式/格式丰富 |
| 本地存储 | idb | IndexedDB Promise 封装，持久化播放列表/配置/进度/歌曲 |
| 状态管理 | pinia | Vue3 官方推荐状态库 |
| 样式 | tailwindcss | 原子化 CSS，配合 `darkMode:'class'` 实现深浅主题 |

## 架构与实现要点

### 端口与代理（dev）
- 根 `pnpm dev` 先执行 `resolve:port`：用 get-port 探测可用端口 → 写入 `packages/backend/.port` 与 `packages/frontend/.env.local`（`VITE_BACKEND_PORT`）
- Vite 读取 `.env.local` 配置 proxy，将 `/api` 转发到后端探测出的端口
- 生产环境（`pnpm start`）后端回退默认端口 18080

### 扫描与封面策略
- 导入采用 **SSE 流式扫描**（`POST /api/library/scan-stream`）：先上报文件清单，再并发解析并逐条推送进度，最后回传入库结果
- 封面在扫描时即转为 **base64 data URL 内嵌到歌曲对象**，随 IndexedDB 持久化；前端刷新后直接从本地读取，无需再请求 `/api/cover`

### 媒体库分组
- `library` store 派生三个 getter：`albums`（按专辑）、`artists`（按歌手）、`folders`（按歌曲所在目录，基于 `fileRelPath` 提取）
- 专辑/歌手/文件夹**详情页复用 SongsView**，通过 route name 区分过滤逻辑

### 歌曲表格（SongTable）
- 使用 `el-table-v2` 虚拟滚动，列 `cellRenderer` 用 **JSX** 编写（`<script setup lang="jsx">`），替代 h() 嵌套
- 显示项（封面/专辑列/序号）由 **settings store 全局个性化开关**控制，不随组件 props 传入

### 自定义图标
- 播放模式图标（顺序/单曲循环/随机）为自定义 SVG，存于 `src/assets/icons/`，经 `vite-svg-loader` 以组件引入
- SVG 统一 `fill="none" stroke="currentColor"`，颜色继承父级、尺寸继承 font-size（兼容 `el-icon :size`）

### 数据持久化注意点
- Vue3 响应式对象存入 IndexedDB 前需用 `toRaw` 脱壳（见 `library._persist`）
- 设置项防抖写库（400ms），避免拖动滑块频繁 IO