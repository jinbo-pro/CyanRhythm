use serde::{Deserialize, Serialize};

/// 歌曲对象：与前端 IndexedDB 中存储的结构完全一致
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Song {
    pub id: String,
    pub title: String,
    pub artist: String,
    #[serde(rename = "albumArtist")]
    pub album_artist: String,
    pub album: String,
    pub duration: u64,
    pub year: Option<u32>,
    #[serde(rename = "hasCover")]
    pub has_cover: bool,
    /// base64 data URL（如 `data:image/jpeg;base64,...`），随歌曲一起持久化
    pub cover: Option<String>,
    /// 实际存储的是绝对路径，供音频播放使用
    #[serde(rename = "fileRelPath")]
    pub file_rel_path: String,
}

/// 目录浏览条目
#[derive(Debug, Clone, Serialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    #[serde(rename = "hasSubdirs")]
    pub has_subdirs: bool,
    /// 仅快捷入口（主目录、音乐文件夹）标记为 true
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quick: Option<bool>,
}

/// 目录浏览结果
#[derive(Debug, Clone, Serialize)]
pub struct BrowseResult {
    pub path: String,
    pub dirs: Vec<DirEntry>,
}

/// 非流式扫描结果
#[derive(Debug, Clone, Serialize)]
pub struct ScanResult {
    pub total: usize,
    pub songs: Vec<Song>,
}

/// 流式扫描返回值（事件通过 Tauri event 推送，这里是命令最终返回值）
#[derive(Debug, Clone, Serialize)]
pub struct ScanStreamResult {
    pub cancelled: bool,
    pub songs: Vec<Song>,
}

/// 数据同步上传结果
#[derive(Debug, Clone, Serialize)]
pub struct SyncUploadResult {
    pub ok: bool,
    pub bucket: String,
    pub encrypted: bool,
    pub size: usize,
}

/// 同步元数据（meta.json）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncMeta {
    #[serde(rename = "encrypted")]
    pub encrypted: bool,
    #[serde(rename = "uploadedAt")]
    pub uploaded_at: String,
    pub username: String,
}

/// 备份信息（供前端展示备份状态与文件路径）
#[derive(Debug, Clone, Serialize)]
pub struct SyncBackupInfo {
    /// 备份是否存在
    pub exists: bool,
    /// 用户名
    pub username: String,
    /// 是否加密
    pub encrypted: bool,
    /// 上传时间（毫秒时间戳字符串）
    #[serde(rename = "uploadedAt")]
    pub uploaded_at: String,
    /// 备份文件大小（字节）
    pub size: u64,
    /// 备份所在目录的完整路径
    pub path: String,
}

// 流式扫描事件通过 serde_json::json! 在 lib.rs 中直接构造，此处不额外定义结构体。

/// 音频文件详情（按需实时读取，非持久化数据）
#[derive(Debug, Clone, Serialize)]
pub struct FileInfo {
    /// 完整路径
    pub path: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "fileSize")]
    pub file_size: u64,
    /// 创建时间（Unix 毫秒时间戳，不支持的平台为 None）
    #[serde(rename = "createdAt")]
    pub created_at: Option<u64>,
    /// 修改时间（Unix 毫秒时间戳）
    #[serde(rename = "modifiedAt")]
    pub modified_at: Option<u64>,
    /// 扩展名（大写，如 "MP3"）
    pub extension: String,
}

/// 歌词获取结果（统一出口）
#[derive(Debug, Clone, Serialize)]
pub struct LyricsResult {
    /// 来源："embedded" | "file" | "online" | "none"
    pub source: String,
    /// 带时间轴的 LRC 文本（可能为空）
    #[serde(rename = "syncedLyrics")]
    pub synced_lyrics: Option<String>,
    /// 纯文本歌词（无时间轴，lrclib plainLyrics）
    #[serde(rename = "plainLyrics")]
    pub plain_lyrics: Option<String>,
}
