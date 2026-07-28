use std::path::{Path, PathBuf};

use crate::models::{BrowseResult, DirEntry};

/// 判断给定字符串是否为绝对路径（兼容 Windows 盘符与 POSIX）
pub fn is_absolute_path(p: &str) -> bool {
    !p.is_empty() && Path::new(p).is_absolute()
}

/// 列出系统可访问的"根节点"，供前端文件夹选择器作为起点。
///
/// - Windows：返回存在的盘符（C:\ ~ Z:\），外加用户主目录与默认音乐目录
/// - POSIX：返回根 '/'，外加主目录与音乐目录
fn list_system_roots() -> Vec<DirEntry> {
    let mut roots = Vec::new();

    // 1. 快捷入口：主目录
    if let Some(home) = dirs::home_dir() {
        let home_str = home.to_string_lossy().to_string();
        roots.push(DirEntry {
            name: "主目录".to_string(),
            path: home_str,
            has_subdirs: true,
            quick: Some(true),
        });

        // 2. 快捷入口：默认音乐目录（若与主目录不同）
        if let Some(music) = dirs::audio_dir() {
            if music != home {
                roots.push(DirEntry {
                    name: "音乐文件夹".to_string(),
                    path: music.to_string_lossy().to_string(),
                    has_subdirs: true,
                    quick: Some(true),
                });
            }
        }
    }

    // 3. 系统盘符 / 根
    #[cfg(target_os = "windows")]
    {
        for letter in b'A'..=b'Z' {
            let drive = format!("{}:\\", letter as char);
            if Path::new(&drive).is_dir() {
                roots.push(DirEntry {
                    name: format!("{}: 盘", letter as char),
                    path: drive,
                    has_subdirs: true,
                    quick: None,
                });
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        roots.push(DirEntry {
            name: "/".to_string(),
            path: "/".to_string(),
            has_subdirs: true,
            quick: None,
        });
    }

    roots
}

/// 判断目录是否还含有子目录（用于前端展开箭头展示）
fn has_subdirectories(path: &Path) -> bool {
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                return true;
            }
        }
    }
    false
}

/// 列出指定目录下的子目录
fn list_subdirectories(abs_path: &str) -> Result<Vec<DirEntry>, String> {
    let path = PathBuf::from(abs_path);
    if !path.is_dir() {
        return Err(format!("路径不是一个目录：{}", abs_path));
    }

    let entries = std::fs::read_dir(&path).map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            "目录不存在或无法访问".to_string()
        } else {
            format!("读取目录失败：{}", e)
        }
    })?;

    let mut dirs: Vec<DirEntry> = entries
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().map(|ft| ft.is_dir()).unwrap_or(false))
        .map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let full = e.path().to_string_lossy().to_string();
            let has_subdirs = has_subdirectories(&e.path());
            DirEntry {
                name,
                path: full,
                has_subdirs,
                quick: None,
            }
        })
        .collect();

    dirs.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(dirs)
}

/// 浏览目录树入口：
/// - path 为空或非绝对路径：返回系统盘符/根节点列表
/// - path 为绝对路径：列出该目录下的子目录
pub fn browse_directories(path: &str) -> Result<BrowseResult, String> {
    let trimmed = path.trim();

    if trimmed.is_empty() || !is_absolute_path(trimmed) {
        let dirs = list_system_roots();
        return Ok(BrowseResult {
            path: String::new(),
            dirs,
        });
    }

    let dirs = list_subdirectories(trimmed)?;
    Ok(BrowseResult {
        path: trimmed.to_string(),
        dirs,
    })
}
