// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod browse;
mod config;
mod lyrics;
mod metadata;
mod models;
mod scanner;
mod sync;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use base64::{engine::general_purpose, Engine as _};
use tauri::{Emitter, Manager, State};

use models::{
    BrowseResult, FileInfo, LyricsResult, ScanResult, ScanStreamResult, SyncBackupInfo,
    SyncUploadResult,
};

/// 应用全局状态：管理扫描任务的取消标志
struct AppState {
    scan_cancelled: Arc<Mutex<HashMap<String, bool>>>,
}

// ── 目录浏览 ──

/// 浏览目录树：path 为空返回系统盘符列表，否则列出子目录
#[tauri::command]
fn browse_directories(path: String) -> Result<BrowseResult, String> {
    browse::browse_directories(&path)
}

// ── 媒体库扫描 ──

/// 非流式扫描：扫描目录下全部音频文件并解析元数据，一次性返回
#[tauri::command]
fn scan_library(path: String) -> Result<ScanResult, String> {
    let trimmed = path.trim();
    let abs_dir = std::path::PathBuf::from(trimmed);
    if !abs_dir.is_dir() {
        return Err(format!("路径不是一个目录：{}", trimmed));
    }

    let files = scanner::scan_audio_files(&abs_dir);
    let songs: Vec<models::Song> = files
        .iter()
        .map(|f| {
            let rel = f.to_string_lossy().to_string();
            metadata::parse_audio_metadata(f, &rel)
        })
        .collect();

    Ok(ScanResult {
        total: songs.len(),
        songs,
    })
}

/// 流式扫描：通过 Tauri 事件实时推送扫描进度，最终返回全部歌曲数据
///
/// 事件名为 `scan-event-{scan_id}`，前端通过 listen 监听。
/// 取消机制：前端调用 `cancel_scan` 命令设置取消标志，工作线程检测后提前退出。
#[tauri::command]
fn scan_library_stream(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    scan_id: String,
    path: String,
) -> Result<ScanStreamResult, String> {
    use std::sync::mpsc;

    let event_name = format!("scan-event-{}", scan_id);
    let cancelled = state.scan_cancelled.clone();

    // 重置取消标志
    {
        let mut map = cancelled.lock().unwrap();
        map.insert(scan_id.clone(), false);
    }

    // 取消检查闭包
    let check_cancelled = || {
        cancelled
            .lock()
            .unwrap()
            .get(&scan_id)
            .copied()
            .unwrap_or(false)
    };

    // 校验路径
    let trimmed = path.trim();
    let abs_dir = std::path::PathBuf::from(trimmed);
    if !abs_dir.is_dir() {
        cancelled.lock().unwrap().remove(&scan_id);
        return Err(format!("路径不是一个目录：{}", trimmed));
    }

    // 1. 递归扫描文件清单
    let files = scanner::scan_audio_files(&abs_dir);

    // 计算相对路径（更便于前端展示）
    let rel_files: Vec<String> = files
        .iter()
        .map(|f| {
            f.strip_prefix(&abs_dir)
                .unwrap_or(f)
                .to_string_lossy()
                .to_string()
        })
        .collect();

    // 推送 files 事件
    let _ = app.emit(
        &event_name,
        serde_json::json!({
            "type": "files",
            "total": files.len(),
            "files": rel_files,
        }),
    );

    if files.is_empty() {
        cancelled.lock().unwrap().remove(&scan_id);
        return Ok(ScanStreamResult {
            cancelled: false,
            songs: Vec::new(),
        });
    }

    // 2. 并发解析元数据（8 个工作线程，与原 Node.js 后端一致）
    let num_workers = std::cmp::min(8, files.len());
    let (tx, rx) = mpsc::channel::<(String, models::Song)>();

    let handles: Vec<_> = (0..num_workers)
        .map(|worker_id| {
            let tx = tx.clone();
            let cancelled = cancelled.clone();
            let scan_id = scan_id.clone();
            let abs_dir = abs_dir.clone();

            // 轮询分配文件给此 worker
            let worker_files: Vec<_> = files
                .iter()
                .enumerate()
                .filter(|(i, _)| i % num_workers == worker_id)
                .map(|(_, f)| f.clone())
                .collect();

            std::thread::spawn(move || {
                for file in worker_files {
                    // 检查取消标志
                    let is_cancelled = cancelled
                        .lock()
                        .unwrap()
                        .get(&scan_id)
                        .copied()
                        .unwrap_or(false);
                    if is_cancelled {
                        break;
                    }

                    // 相对路径仅用于进度事件展示
                    let rel = file
                        .strip_prefix(&abs_dir)
                        .unwrap_or(&file)
                        .to_string_lossy()
                        .to_string();
                    // fileRelPath 必须存储绝对路径，供前端 convertFileSrc 播放使用
                    let abs = file.to_string_lossy().to_string();
                    let song = metadata::parse_audio_metadata(&file, &abs);
                    let _ = tx.send((rel, song));
                }
            })
        })
        .collect();

    drop(tx); // 关闭原始 sender，使 rx 在所有 worker 完成后自然结束

    // 3. 接收结果并推送进度事件
    let mut songs = Vec::new();
    let mut done_count = 0;

    for (file, song) in rx {
        done_count += 1;
        songs.push(song);

        let _ = app.emit(
            &event_name,
            serde_json::json!({
                "type": "progress",
                "index": done_count,
                "file": file,
                "ok": true,
            }),
        );
    }

    // 等待所有工作线程结束
    for handle in handles {
        let _ = handle.join();
    }

    let was_cancelled = check_cancelled();

    // 清理取消标志
    cancelled.lock().unwrap().remove(&scan_id);

    Ok(ScanStreamResult {
        cancelled: was_cancelled,
        songs,
    })
}

/// 取消正在进行的流式扫描
#[tauri::command]
fn cancel_scan(scan_id: String, state: State<'_, AppState>) {
    if let Ok(mut map) = state.scan_cancelled.lock() {
        map.insert(scan_id, true);
    }
}

// ── 文件详情（按需实时读取） ──

/// 读取音频文件的详情（文件名、大小、创建/修改时间、扩展名）
///
/// 仅在用户主动点击「详情」时调用，避免扫描阶段无关开销。
#[tauri::command]
fn get_file_info(file_path: String) -> Result<FileInfo, String> {
    let path = std::path::Path::new(&file_path);
    let metadata = std::fs::metadata(path).map_err(|e| format!("无法读取文件信息：{}", e))?;

    let file_name = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let extension = path
        .extension()
        .map(|s| s.to_string_lossy().to_uppercase())
        .unwrap_or_default();

    let created_at = metadata
        .created()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64);
    let modified_at = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64);

    Ok(FileInfo {
        path: file_path,
        file_name,
        file_size: metadata.len(),
        created_at,
        modified_at,
        extension,
    })
}

// ── 封面提取 ──

/// 从音频文件中提取封面并返回 base64 data URL（兼容旧数据）
#[tauri::command]
fn get_cover_data_url(file_path: String) -> Result<Option<String>, String> {
    Ok(metadata::get_cover_data_url(&file_path))
}

/// 仅获取内嵌歌词（不触发在线请求，供编辑器加载当前歌词）
#[tauri::command]
fn get_embedded_lyrics(file_path: String) -> Result<Option<String>, String> {
    Ok(metadata::get_embedded_lyrics(&file_path))
}

// ── 元数据编辑（写入标签） ──

/// 更新音频文件元数据（标题、艺术家、专辑、专辑艺术家、年份、歌词、封面）
///
/// 仅更新传入的字段，null 字段保持原值。写入成功后返回重新解析的 Song。
#[tauri::command]
fn update_audio_metadata(
    file_path: String,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    album_artist: Option<String>,
    year: Option<String>,
    lyrics: Option<String>,
    cover_base64: Option<String>,
) -> Result<models::Song, String> {
    let path = std::path::PathBuf::from(&file_path);
    metadata::update_audio_metadata(
        &path,
        title.as_deref(),
        artist.as_deref(),
        album.as_deref(),
        album_artist.as_deref(),
        year.as_deref(),
        lyrics.as_deref(),
        cover_base64.as_deref(),
    )
}

// ── 歌词获取 ──

/// 获取歌词（按 内嵌 → 本地 .lrc → 在线 lrclib 优先级获取）
#[tauri::command]
async fn get_lyrics(
    file_path: String,
    title: String,
    artist: String,
    album: String,
    duration: u64,
) -> Result<LyricsResult, String> {
    Ok(lyrics::get_lyrics(&file_path, &title, &artist, &album, duration).await)
}

/// 仅在线获取歌词（元数据编辑器手动触发，跳过内嵌/本地 .lrc）
#[tauri::command]
async fn get_online_lyrics(
    title: String,
    artist: String,
    album: String,
    duration: u64,
) -> Result<LyricsResult, String> {
    Ok(lyrics::get_online_lyrics(&title, &artist, &album, duration).await)
}

// ── 应用配置 ──

/// 读取应用配置（LRCLIB 地址等），配置文件不存在时返回默认值
#[tauri::command]
fn get_app_config() -> config::AppConfig {
    config::load_config()
}

/// 保存应用配置到文件
#[tauri::command]
fn save_app_config(config: config::AppConfig) -> Result<(), String> {
    config::save_config(&config)
}

// ── 数据同步 ──

/// 上传同步数据（保存到本地 AppData，可选 AES-128-GCM 加密）
///
/// 前端传入 base64 编码的数据，Rust 端解码后保存。
#[tauri::command]
fn sync_upload(
    data_base64: String,
    username: String,
    password: String,
) -> Result<SyncUploadResult, String> {
    let data = general_purpose::STANDARD
        .decode(&data_base64)
        .map_err(|e| format!("Base64解码失败：{}", e))?;
    sync::upload(&data, &username, &password)
}

/// 下载同步数据（从本地 AppData 读取，加密则解密后返回 JSON）
#[tauri::command]
fn sync_download(username: String, password: String) -> Result<serde_json::Value, String> {
    let data = sync::download(&username, &password)?;
    serde_json::from_slice(&data).map_err(|e| format!("数据解析失败：{}", e))
}

/// 查询备份信息（路径、大小、加密状态、上传时间）
#[tauri::command]
fn sync_get_backup_info(username: String) -> Result<SyncBackupInfo, String> {
    sync::get_backup_info(&username)
}

/// 删除指定用户名的备份
#[tauri::command]
fn sync_delete_backup(username: String) -> Result<(), String> {
    sync::delete_backup(&username)
}

/// 获取当前系统用户名（用于上传弹窗默认填充）
#[tauri::command]
fn get_current_username() -> Option<String> {
    // 优先从环境变量获取（Windows: USERNAME，Unix: USER）
    if let Ok(name) = std::env::var("USERNAME").or_else(|_| std::env::var("USER")) {
        return Some(name);
    }
    // 回退：从主目录路径提取最后一段作为用户名
    dirs::home_dir().and_then(|p| p.file_name().map(|s| s.to_string_lossy().to_string()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            scan_cancelled: Arc::new(Mutex::new(HashMap::new())),
        })
        .invoke_handler(tauri::generate_handler![
            browse_directories,
            scan_library,
            scan_library_stream,
            cancel_scan,
            get_file_info,
            update_audio_metadata,
            get_cover_data_url,
            get_embedded_lyrics,
            get_lyrics,
            get_online_lyrics,
            sync_upload,
            sync_download,
            sync_get_backup_info,
            sync_delete_backup,
            get_current_username,
            get_app_config,
            save_app_config,
        ])
        .setup(|app| {
            // 安全兜底：如果前端 10 秒内未调用 show()（如 JS 加载失败），
            // 强制显示窗口，避免用户看到永远空白的应用
            if let Some(window) = app.get_webview_window("main") {
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(10));
                    let _ = window.show();
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
