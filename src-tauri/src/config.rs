use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// LRCLIB 默认 API 地址
pub const DEFAULT_LRCLIB_BASE: &str = "https://lrclib.net/api";

/// 应用配置（持久化到 AppData/CyanRhythm/config.json）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// LRCLIB API 基础地址
    #[serde(rename = "lrclibBase", default = "default_lrclib_base")]
    pub lrclib_base: String,
}

fn default_lrclib_base() -> String {
    DEFAULT_LRCLIB_BASE.to_string()
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            lrclib_base: DEFAULT_LRCLIB_BASE.to_string(),
        }
    }
}

/// 获取应用配置目录（AppData 下的应用专属目录）
fn get_config_root() -> Result<PathBuf, String> {
    let base = dirs::data_dir().ok_or_else(|| "无法获取应用数据目录".to_string())?;
    Ok(base.join("CyanRhythm"))
}

/// 获取配置文件路径
fn get_config_path() -> Result<PathBuf, String> {
    Ok(get_config_root()?.join("config.json"))
}

/// 读取配置文件，不存在或解析失败时返回默认配置，避免程序异常
pub fn load_config() -> AppConfig {
    let path = match get_config_path() {
        Ok(p) => p,
        Err(_) => return AppConfig::default(),
    };
    match std::fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str::<AppConfig>(&content).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    }
}

/// 保存配置到文件
pub fn save_config(config: &AppConfig) -> Result<(), String> {
    let dir = get_config_root()?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建配置目录失败：{}", e))?;
    let path = get_config_path()?;
    let json =
        serde_json::to_string_pretty(config).map_err(|e| format!("序列化配置失败：{}", e))?;
    std::fs::write(&path, json).map_err(|e| format!("写入配置文件失败：{}", e))?;
    Ok(())
}

/// 获取 LRCLIB 基础地址（读取配置，失败或为空时返回默认值）
pub fn get_lrclib_base() -> String {
    let config = load_config();
    let base = config.lrclib_base.trim();
    if base.is_empty() {
        DEFAULT_LRCLIB_BASE.to_string()
    } else {
        base.to_string()
    }
}
