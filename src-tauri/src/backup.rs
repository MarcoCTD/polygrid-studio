use crate::filesystem::paths::FsError;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub filename: String,
    pub size_bytes: u64,
    pub created_at: String,
}

const MAX_BACKUPS_DEFAULT: usize = 30;
const MAX_PRE_MIGRATION_BACKUPS: usize = 10;

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, FsError> {
    app.path()
        .app_data_dir()
        .map_err(|err| FsError::Io(err.to_string()))
}

fn backup_dir(app: &AppHandle) -> Result<PathBuf, FsError> {
    Ok(app_data_dir(app)?.join("backups"))
}

fn pre_migration_backup_dir(app: &AppHandle) -> Result<PathBuf, FsError> {
    Ok(app_data_dir(app)?.join("pre_migration_backups"))
}

fn database_path(app: &AppHandle) -> Result<PathBuf, FsError> {
    Ok(app_data_dir(app)?.join("polygrid.db"))
}

fn unix_timestamp() -> Result<u64, FsError> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|err| FsError::Io(err.to_string()))?
        .as_secs())
}

fn backup_info_from_path(path: PathBuf) -> Result<BackupInfo, FsError> {
    let metadata = fs::metadata(&path)?;
    let filename = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or(FsError::NotFound)?
        .to_string();
    let created_at = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|| "0".to_string());

    Ok(BackupInfo {
        filename,
        size_bytes: metadata.len(),
        created_at,
    })
}

fn sorted_backups(dir: &Path, prefix: &str) -> Result<Vec<BackupInfo>, FsError> {
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut backups = Vec::new();
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file()
            && path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with(prefix) && name.ends_with(".db"))
        {
            backups.push(backup_info_from_path(path)?);
        }
    }
    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(backups)
}

fn prune_old_backups(dir: &Path, prefix: &str, max_count: usize) -> Result<(), FsError> {
    let backups = sorted_backups(dir, prefix)?;
    for backup in backups.into_iter().skip(max_count) {
        let path = dir.join(backup.filename);
        if path.exists() {
            fs::remove_file(path)?;
        }
    }
    Ok(())
}

fn copy_database_backup(app: &AppHandle, backup_path: &Path) -> Result<(), FsError> {
    let source = database_path(app)?;
    if !source.exists() {
        return Err(FsError::NotFound);
    }

    fs::copy(source, backup_path)?;
    Ok(())
}

fn sanitize_filename_timestamp(timestamp: &str) -> String {
    timestamp
        .chars()
        .map(|character| match character {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' => character,
            _ => '-',
        })
        .collect()
}

#[tauri::command]
pub fn create_backup(app: AppHandle) -> Result<String, FsError> {
    let dir = backup_dir(&app)?;
    fs::create_dir_all(&dir)?;

    let timestamp = unix_timestamp()?;
    let backup_path = dir.join(format!("polygrid_backup_{timestamp}.db"));
    copy_database_backup(&app, &backup_path)?;
    prune_old_backups(&dir, "polygrid_backup_", MAX_BACKUPS_DEFAULT)?;

    Ok(backup_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn list_backups(app: AppHandle) -> Result<Vec<BackupInfo>, FsError> {
    let dir = backup_dir(&app)?;
    sorted_backups(&dir, "polygrid_backup_").map(|backups| backups.into_iter().take(10).collect())
}

#[tauri::command]
pub fn delete_backup(app: AppHandle, filename: String) -> Result<(), FsError> {
    let requested_path = PathBuf::from(&filename);
    let safe_filename = requested_path
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| *name == filename)
        .map(str::to_string)
        .ok_or(FsError::PathOutsideBase)?;
    let path = backup_dir(&app)?.join(&safe_filename);
    if !path.exists() {
        return Err(FsError::NotFound);
    }
    fs::remove_file(path)?;
    Ok(())
}

#[tauri::command]
pub fn get_backup_directory(app: AppHandle) -> Result<String, FsError> {
    let dir = backup_dir(&app)?;
    fs::create_dir_all(&dir)?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_pre_migration_backup(app: AppHandle, timestamp: String) -> Result<String, FsError> {
    let dir = pre_migration_backup_dir(&app)?;
    let safe_timestamp = sanitize_filename_timestamp(&timestamp);
    let backup_path = dir.join(format!("polygrid_pre_migration_{safe_timestamp}.db"));

    println!(
        "[Backup] Pre-migration backup started: path={}, timestamp={timestamp}",
        backup_path.to_string_lossy()
    );

    if let Err(error) = fs::create_dir_all(&dir) {
        eprintln!(
            "[Backup] Pre-migration backup failed: path={}, timestamp={timestamp}, error={error}",
            backup_path.to_string_lossy()
        );
        return Err(error.into());
    }

    if let Err(error) = copy_database_backup(&app, &backup_path) {
        eprintln!(
            "[Backup] Pre-migration backup failed: path={}, timestamp={timestamp}, error={error:?}",
            backup_path.to_string_lossy()
        );
        return Err(error);
    }

    if let Err(error) =
        prune_old_backups(&dir, "polygrid_pre_migration_", MAX_PRE_MIGRATION_BACKUPS)
    {
        eprintln!(
            "[Backup] Pre-migration backup failed during retention: path={}, timestamp={timestamp}, error={error:?}",
            backup_path.to_string_lossy()
        );
        return Err(error);
    }

    println!(
        "[Backup] Pre-migration backup completed: path={}, timestamp={timestamp}",
        backup_path.to_string_lossy()
    );

    Ok(backup_path.to_string_lossy().to_string())
}
