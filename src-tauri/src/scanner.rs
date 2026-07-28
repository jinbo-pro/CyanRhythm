use std::path::Path;
use walkdir::WalkDir;

/// 受支持的音频文件扩展名（小写）
const AUDIO_EXTENSIONS: &[&str] = &[".mp3", ".flac", ".wav", ".aac", ".m4a"];

/// 判断文件名是否为受支持的音频文件
pub fn is_audio_file(file_name: &str) -> bool {
    let lower = file_name.to_lowercase();
    AUDIO_EXTENSIONS.iter().any(|ext| lower.ends_with(ext))
}

/// 递归扫描目录下所有受支持的音频文件
///
/// 无权限或不存在的内容会被静默跳过。
pub fn scan_audio_files(root: &Path) -> Vec<std::path::PathBuf> {
    let mut results = Vec::new();

    for entry in WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            // 跳过隐藏目录/文件（以 . 开头），减少无用遍历
            e.file_name()
                .to_str()
                .map(|s| !s.starts_with('.'))
                .unwrap_or(true)
        })
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            let name = entry.file_name().to_string_lossy();
            if is_audio_file(&name) {
                results.push(entry.path().to_path_buf());
            }
        }
    }

    results
}
