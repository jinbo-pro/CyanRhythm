use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes128Gcm, Key, Nonce};
use sha2::{Digest, Sha256};

use crate::models::{SyncBackupInfo, SyncMeta, SyncUploadResult};

/// 获取同步数据存储根目录（AppData 下的应用专属目录）
fn get_data_root() -> Result<PathBuf, String> {
    let base = dirs::data_dir().ok_or_else(|| "无法获取应用数据目录".to_string())?;
    Ok(base.join("CyanRhythm").join("sync-data"))
}

/// 从密码派生 AES-128-GCM 的 key 和 iv（与 Node.js 后端完全兼容）：
/// - key = SHA-256(password)[0..16]
/// - iv  = SHA-256(password)[20..32]（末尾 12 字节）
fn derive_key_iv(password: &str) -> ([u8; 16], [u8; 12]) {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    let hash = hasher.finalize();

    let mut key = [0u8; 16];
    key.copy_from_slice(&hash[0..16]);

    let mut iv = [0u8; 12];
    iv.copy_from_slice(&hash[20..32]);

    (key, iv)
}

/// AES-128-GCM 加密
///
/// 输出 = 密文 + GCM authTag（16 字节追加在末尾），与 Node.js 实现一致，
/// aes-gcm crate 的 encrypt 默认就是 ciphertext || tag 格式。
fn encrypt_buffer(data: &[u8], password: &str) -> Vec<u8> {
    let (key_bytes, iv) = derive_key_iv(password);
    let key = Key::<Aes128Gcm>::from_slice(&key_bytes);
    let cipher = Aes128Gcm::new(key);
    let nonce = Nonce::from_slice(&iv);
    cipher.encrypt(nonce, data).expect("AES-128-GCM 加密失败")
}

/// AES-128-GCM 解密（encrypt_buffer 的逆运算）
///
/// 输入为 密文 + authTag（末尾 16 字节），返回原始明文。
fn decrypt_buffer(data: &[u8], password: &str) -> Result<Vec<u8>, String> {
    let (key_bytes, iv) = derive_key_iv(password);
    let key = Key::<Aes128Gcm>::from_slice(&key_bytes);
    let cipher = Aes128Gcm::new(key);
    let nonce = Nonce::from_slice(&iv);
    cipher
        .decrypt(nonce, data)
        .map_err(|_| "密码错误，解密失败".to_string())
}

/// 用户名哈希分桶：SHA-256 取前 16 个十六进制字符
fn hash_username(username: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(username.as_bytes());
    let hash = hasher.finalize();
    let hex: String = hash.iter().map(|b| format!("{:02x}", b)).collect();
    hex[..16].to_string()
}

/// 当前时间的毫秒时间戳字符串（用于 meta.uploadedAt）
fn now_millis_str() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

/// 上传（保存）同步数据到本地 AppData 目录
///
/// 按用户名哈希分桶保存到 `<data_root>/<hash>/`，加密后写入 data.bin，
/// 同时写入 meta.json 记录加密状态与时间戳。直接覆盖已有数据。
pub fn upload(data: &[u8], username: &str, password: &str) -> Result<SyncUploadResult, String> {
    let username = username.trim();
    if username.is_empty() {
        return Err("用户名不能为空".to_string());
    }

    let bucket = hash_username(username);
    let bucket_dir = get_data_root()?.join(&bucket);
    std::fs::create_dir_all(&bucket_dir).map_err(|e| format!("创建目录失败：{}", e))?;

    let meta = SyncMeta {
        encrypted: !password.is_empty(),
        uploaded_at: now_millis_str(),
        username: username.to_string(),
    };

    let final_data = if password.is_empty() {
        data.to_vec()
    } else {
        encrypt_buffer(data, password)
    };

    let data_path = bucket_dir.join("data.bin");
    let meta_path = bucket_dir.join("meta.json");

    std::fs::write(&data_path, &final_data).map_err(|e| format!("写入数据失败：{}", e))?;
    let meta_json =
        serde_json::to_string_pretty(&meta).map_err(|e| format!("序列化元数据失败：{}", e))?;
    std::fs::write(&meta_path, meta_json).map_err(|e| format!("写入元数据失败：{}", e))?;

    Ok(SyncUploadResult {
        ok: true,
        bucket,
        encrypted: meta.encrypted,
        size: final_data.len(),
    })
}

/// 下载（读取）同步数据
///
/// 按用户名哈希分桶读取 data.bin，加密则解密后返回原始字节。
pub fn download(username: &str, password: &str) -> Result<Vec<u8>, String> {
    let username = username.trim();
    if username.is_empty() {
        return Err("用户名不能为空".to_string());
    }

    let bucket = hash_username(username);
    let bucket_dir = get_data_root()?.join(&bucket);
    let data_path = bucket_dir.join("data.bin");

    if !data_path.exists() {
        return Err("暂无该用户的同步数据".to_string());
    }

    let file_data = std::fs::read(&data_path).map_err(|e| format!("读取数据失败：{}", e))?;

    // 读取 meta.json 判断是否加密
    let meta_path = bucket_dir.join("meta.json");
    let encrypted = std::fs::read_to_string(&meta_path)
        .ok()
        .and_then(|s| serde_json::from_str::<SyncMeta>(&s).ok())
        .map(|m| m.encrypted)
        .unwrap_or(false);

    if encrypted {
        if password.is_empty() {
            return Err("该数据已加密，请输入密码".to_string());
        }
        decrypt_buffer(&file_data, password)
    } else {
        Ok(file_data)
    }
}

/// 查询指定用户名的备份信息（路径、大小、加密状态、上传时间）
///
/// 备份不存在时返回 `exists: false`，不报错。
pub fn get_backup_info(username: &str) -> Result<SyncBackupInfo, String> {
    let username = username.trim();
    if username.is_empty() {
        return Err("用户名不能为空".to_string());
    }

    let bucket = hash_username(username);
    let bucket_dir = get_data_root()?.join(&bucket);
    let data_path = bucket_dir.join("data.bin");
    let meta_path = bucket_dir.join("meta.json");

    if !data_path.exists() {
        return Ok(SyncBackupInfo {
            exists: false,
            username: username.to_string(),
            encrypted: false,
            uploaded_at: String::new(),
            size: 0,
            path: String::new(),
        });
    }

    // 读取 meta.json 获取加密状态与上传时间
    let meta = std::fs::read_to_string(&meta_path)
        .ok()
        .and_then(|s| serde_json::from_str::<SyncMeta>(&s).ok());

    let (encrypted, uploaded_at) = meta
        .as_ref()
        .map(|m| (m.encrypted, m.uploaded_at.clone()))
        .unwrap_or((false, String::new()));

    let size = std::fs::metadata(&data_path).map(|m| m.len()).unwrap_or(0);

    Ok(SyncBackupInfo {
        exists: true,
        username: username.to_string(),
        encrypted,
        uploaded_at,
        size,
        path: bucket_dir.to_string_lossy().to_string(),
    })
}

/// 删除指定用户名的备份数据（整个分桶目录）
///
/// 备份不存在时静默返回成功（幂等）。
pub fn delete_backup(username: &str) -> Result<(), String> {
    let username = username.trim();
    if username.is_empty() {
        return Err("用户名不能为空".to_string());
    }

    let bucket = hash_username(username);
    let bucket_dir = get_data_root()?.join(&bucket);

    if bucket_dir.exists() {
        std::fs::remove_dir_all(&bucket_dir).map_err(|e| format!("删除备份失败：{}", e))?;
    }

    Ok(())
}
