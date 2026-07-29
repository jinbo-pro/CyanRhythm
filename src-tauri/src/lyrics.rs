use std::path::Path;
use std::time::Duration;

use crate::metadata;
use crate::models::LyricsResult;

const LRCLIB_BASE: &str = "https://lrclib.net/api";

/// 1. 内嵌歌词：从音频文件标签提取（USLT/SYLT）
fn fetch_embedded(file_path: &str) -> Option<LyricsResult> {
    let raw = metadata::get_embedded_lyrics(file_path)?;
    Some(build_result("embedded", raw))
}

/// 2. 同名 .lrc 文件（song.mp3 → song.lrc）
fn fetch_local_lrc(file_path: &str) -> Option<LyricsResult> {
    let p = Path::new(file_path);
    let lrc = p.with_extension("lrc");
    let content = std::fs::read_to_string(&lrc).ok()?;
    Some(build_result("file", content))
}

/// 将原始歌词文本按是否含时间标签拆分为 synced / plain
fn build_result(source: &str, raw: String) -> LyricsResult {
    // 简易判断：包含形如 [mm:ss] 的时间标签视为同步歌词
    let is_synced = raw.lines().any(|line| {
        let bytes = line.as_bytes();
        if bytes.len() < 4 || bytes[0] != b'[' {
            return false;
        }
        // [数字 + 可选冒号/点
        bytes[1..]
            .iter()
            .take_while(|&&b| b != b']')
            .all(|&b| b.is_ascii_digit() || b == b':' || b == b'.' || b == b' ')
            && bytes.iter().any(|&b| b == b']')
    });

    if is_synced {
        LyricsResult {
            source: source.to_string(),
            synced_lyrics: Some(raw),
            plain_lyrics: None,
        }
    } else {
        LyricsResult {
            source: source.to_string(),
            synced_lyrics: None,
            plain_lyrics: Some(raw),
        }
    }
}

/// 构建 ureq Agent（复用连接池 + 超时）
fn build_agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(8))
        .build()
}

/// 3. 在线 lrclib（精确匹配）
fn fetch_online(
    agent: &ureq::Agent,
    title: &str,
    artist: &str,
    album: &str,
    duration: u64,
) -> Option<LyricsResult> {
    // 先尝试 /get 精确匹配
    let resp = agent
        .get(&format!("{}/get", LRCLIB_BASE))
        .query("track_name", title)
        .query("artist_name", artist)
        .query("album_name", album)
        .query("duration", &duration.to_string())
        .call();

    match resp {
        Ok(response) => {
            let json: serde_json::Value = response.into_json().ok()?;
            Some(parse_lrclib_json(json, "online"))
        }
        Err(ureq::Error::Status(404, _)) => {
            // 降级为 search
            search_online(agent, title, artist)
        }
        Err(_) => None,
    }
}

/// /get 未命中时的降级搜索（取第一条有 syncedLyrics 的结果）
fn search_online(agent: &ureq::Agent, title: &str, artist: &str) -> Option<LyricsResult> {
    let resp = agent
        .get(&format!("{}/search", LRCLIB_BASE))
        .query("track_name", title)
        .query("artist_name", artist)
        .call();

    let arr: Vec<serde_json::Value> = match resp {
        Ok(r) => r.into_json().ok()?,
        Err(_) => return None,
    };
    if arr.is_empty() {
        return None;
    }
    // 优先取第一条有 syncedLyrics 的，否则取第一条
    let best = arr
        .iter()
        .find(|v| {
            v.get("syncedLyrics")
                .and_then(|s| s.as_str())
                .is_some_and(|s| !s.is_empty())
        })
        .or_else(|| arr.first())?;
    Some(parse_lrclib_json(best.clone(), "online"))
}

/// 从 lrclib JSON 对象提取歌词
fn parse_lrclib_json(json: serde_json::Value, source: &str) -> LyricsResult {
    LyricsResult {
        source: source.to_string(),
        synced_lyrics: json
            .get("syncedLyrics")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(String::from),
        plain_lyrics: json
            .get("plainLyrics")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(String::from),
    }
}

/// 组合入口：按优先级依次尝试 内嵌 → 本地 .lrc → 在线 lrclib
pub fn get_lyrics(
    file_path: &str,
    title: &str,
    artist: &str,
    album: &str,
    duration: u64,
) -> LyricsResult {
    // 1. 内嵌歌词
    if let Some(r) = fetch_embedded(file_path) {
        return r;
    }
    // 2. 本地 .lrc 文件
    if let Some(r) = fetch_local_lrc(file_path) {
        return r;
    }
    // 3. 在线 lrclib
    let agent = build_agent();
    if let Some(r) = fetch_online(&agent, title, artist, album, duration) {
        return r;
    }

    LyricsResult {
        source: "none".to_string(),
        synced_lyrics: None,
        plain_lyrics: None,
    }
}
