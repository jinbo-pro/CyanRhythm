use std::path::Path;

use base64::{engine::general_purpose, Engine as _};
use lofty::file::AudioFile;
use lofty::prelude::*;
use lofty::probe::Probe;
use lofty::tag::ItemKey;
use sha1::{Digest, Sha1};

use crate::models::Song;

/// 根据路径生成稳定的 16 位十六进制 id（与 Node.js 版本完全兼容）
fn hash_id(rel_path: &str) -> String {
    let mut hasher = Sha1::new();
    hasher.update(rel_path.as_bytes());
    let result = hasher.finalize();
    let hex: String = result.iter().map(|b| format!("{:02x}", b)).collect();
    hex[..16].to_string()
}

/// 解析单个音频文件的元数据
///
/// 解析失败时返回带默认值的 Song（而非错误），与原 Node.js 后端行为一致。
/// `abs_path` 和 `rel_path` 均传入绝对路径（rel_path 用作稳定 id）。
pub fn parse_audio_metadata(abs_path: &Path, rel_path: &str) -> Song {
    let id = hash_id(rel_path);

    // 文件名（去扩展名）作为 title 兜底
    let file_name = abs_path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "未知曲目".to_string());

    // 尝试用 lofty 读取
    let tagged_file = match Probe::open(abs_path).and_then(|p| p.read()) {
        Ok(tf) => tf,
        Err(_) => {
            return Song {
                id,
                title: file_name,
                artist: "未知艺术家".into(),
                album_artist: "未知艺术家".into(),
                album: "未知专辑".into(),
                duration: 0,
                year: None,
                has_cover: false,
                cover: None,
                file_rel_path: rel_path.to_string(),
            };
        }
    };

    let duration = tagged_file.properties().duration().as_secs();

    // 取主标签（如 MP3 的 ID3v2），否则取第一个可用标签
    let tag = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag());

    let (title, artist, album_artist, album, year, cover) = if let Some(tag) = tag {
        let title = tag.title().map(|s| s.to_string()).unwrap_or_else(|| file_name.clone());
        let artist = tag
            .artist()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "未知艺术家".to_string());
        let album = tag
            .album()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "未知专辑".to_string());

        // album_artist：优先从 ItemKey 读取，回退到 artist
        let album_artist = tag
            .get(&ItemKey::AlbumArtist)
            .and_then(|item| item.value().text())
            .map(|s| s.to_string())
            .unwrap_or_else(|| artist.clone());

        let year = tag.year();

        // 封面：转 base64 data URL，随歌曲对象一起返回
        let cover = tag.pictures().first().map(|pic| {
            let mime = pic
                .mime_type()
                .map(|m| m.to_string())
                .unwrap_or_else(|| "image/jpeg".to_string());
            let b64 = general_purpose::STANDARD.encode(pic.data());
            format!("data:{};base64,{}", mime, b64)
        });

        (title, artist, album_artist, album, year, cover)
    } else {
        (
            file_name.clone(),
            "未知艺术家".to_string(),
            "未知艺术家".to_string(),
            "未知专辑".to_string(),
            None,
            None,
        )
    };

    Song {
        id,
        title,
        artist,
        album_artist,
        album,
        duration,
        year,
        has_cover: cover.is_some(),
        cover,
        file_rel_path: rel_path.to_string(),
    }
}

/// 提取专辑封面并返回 base64 data URL（供旧数据兼容：IndexedDB 中未存 cover 字段的旧歌曲）
pub fn get_cover_data_url(file_path: &str) -> Option<String> {
    let path = Path::new(file_path);

    let tagged_file = Probe::open(path).ok()?.read().ok()?;

    let tag = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag())?;

    let pic = tag.pictures().first()?;

    let mime = pic
        .mime_type()
        .map(|m| m.to_string())
        .unwrap_or_else(|| "image/jpeg".to_string());
    let b64 = general_purpose::STANDARD.encode(pic.data());
    Some(format!("data:{};base64,{}", mime, b64))
}

/// 从音频文件标签提取内嵌歌词
/// ID3 USLT 帧、Vorbis LYRICS 字段均映射到 ItemKey::Lyrics
/// 返回的文本若包含 [mm:ss] 时间标签则视为同步歌词，否则为纯文本
pub fn get_embedded_lyrics(file_path: &str) -> Option<String> {
    let path = Path::new(file_path);
    let tagged_file = Probe::open(path).ok()?.read().ok()?;

    let tag = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag())?;

    tag.get(&ItemKey::Lyrics)?
        .value()
        .text()
        .map(|s| s.to_string())
}
