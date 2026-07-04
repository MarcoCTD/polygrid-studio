use super::paths::{
    path_from_string, validate_existing_path, validate_new_path, validate_setup_base_path, FsError,
};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: Option<u64>,
    pub modified_at: Option<u64>,
    pub extension: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: Option<u64>,
    pub modified_at: Option<u64>,
    pub extension: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationLog {
    pub operation_type: String,
    pub source_path: String,
    pub target_path: Option<String>,
    pub is_undoable: bool,
}

const STANDARD_DIRECTORIES: &[&str] = &[
    "01_Finanzen",
    "01_Finanzen/Belege_2026",
    "01_Finanzen/Exporte",
    "02_Produkte",
    "03_Listings",
    "04_Auftraege",
    "05_Vorlagen",
    "06_Rechtliches",
    "07_Marktrecherche",
    "08_Content",
    "09_Archiv",
];

#[tauri::command]
pub fn list_directory(path: String, base_path: Option<String>) -> Result<Vec<FileEntry>, FsError> {
    let path = path_from_string(&path)?;
    let canonical_path = validate_existing_path(&path, base_path.as_deref())?;

    if !canonical_path.is_dir() {
        return Err(FsError::NotFound);
    }

    let mut entries = Vec::new();
    for entry in fs::read_dir(canonical_path)? {
        let entry = entry?;
        let metadata = entry.metadata()?;
        entries.push(file_entry_from_path(entry.path(), metadata)?);
    }

    entries.sort_by(|a, b| {
        b.is_directory
            .cmp(&a.is_directory)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

#[tauri::command]
pub fn get_file_info(path: String, base_path: Option<String>) -> Result<FileInfo, FsError> {
    let path = path_from_string(&path)?;
    let canonical_path = validate_existing_path(&path, base_path.as_deref())?;
    let metadata = fs::metadata(&canonical_path)?;
    file_info_from_path(canonical_path, metadata)
}

#[tauri::command]
pub fn create_directory(path: String, base_path: Option<String>) -> Result<(), FsError> {
    let path = path_from_string(&path)?;
    let validated_path = validate_new_path(&path, base_path.as_deref())?;
    fs::create_dir_all(validated_path)?;
    Ok(())
}

#[tauri::command]
pub fn open_in_explorer(path: String, base_path: Option<String>) -> Result<(), FsError> {
    let path = path_from_string(&path)?;
    let canonical_path = validate_existing_path(&path, base_path.as_deref())?;

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(canonical_path);
        command
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("explorer");
        command.arg(canonical_path);
        command
    };

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(canonical_path);
        command
    };

    let status = command.status()?;
    if status.success() {
        Ok(())
    } else {
        Err(FsError::Io(
            "Dateimanager konnte nicht geoeffnet werden.".to_string(),
        ))
    }
}

#[tauri::command]
pub fn check_path_exists(path: String, base_path: Option<String>) -> Result<bool, FsError> {
    let path = path_from_string(&path)?;

    if path.exists() {
        validate_existing_path(&path, base_path.as_deref())?;
        Ok(true)
    } else if let Some(parent) = path.parent() {
        validate_existing_path(parent, base_path.as_deref())?;
        Ok(false)
    } else {
        Err(FsError::PathOutsideBase)
    }
}

#[tauri::command]
pub fn ensure_onedrive_structure(base_path: String) -> Result<(), FsError> {
    let base_path = path_from_string(&base_path)?;
    let base_path = validate_setup_base_path(&base_path)?;

    fs::create_dir_all(&base_path)?;

    for directory in STANDARD_DIRECTORIES {
        fs::create_dir_all(base_path.join(directory))?;
    }

    Ok(())
}

#[tauri::command]
pub fn rename_file(
    base_path: String,
    old_path: String,
    new_path: String,
) -> Result<FileOperationLog, FsError> {
    let base = canonical_base(&base_path)?;
    let source = validate_source(&old_path, &base_path)?;
    let target = validate_target(&new_path, &base_path)?;

    fs::rename(&source, &target)?;

    Ok(FileOperationLog {
        operation_type: "rename".to_string(),
        source_path: relative_path(&source, &base)?,
        target_path: Some(relative_path(&target, &base)?),
        is_undoable: true,
    })
}

#[tauri::command]
pub fn move_file(
    base_path: String,
    source: String,
    target: String,
) -> Result<FileOperationLog, FsError> {
    let base = canonical_base(&base_path)?;
    let source = validate_source(&source, &base_path)?;
    let target = validate_target(&target, &base_path)?;

    fs::rename(&source, &target)?;

    Ok(FileOperationLog {
        operation_type: "move".to_string(),
        source_path: relative_path(&source, &base)?,
        target_path: Some(relative_path(&target, &base)?),
        is_undoable: true,
    })
}

#[tauri::command]
pub fn copy_file(
    base_path: String,
    source: String,
    target: String,
) -> Result<FileOperationLog, FsError> {
    let base = canonical_base(&base_path)?;
    let source = validate_source(&source, &base_path)?;
    let target = validate_target(&target, &base_path)?;

    if source.is_dir() {
        return Err(FsError::Io(
            "Ordner koennen im MVP nicht kopiert werden.".to_string(),
        ));
    }

    fs::copy(&source, &target)?;

    Ok(FileOperationLog {
        operation_type: "copy".to_string(),
        source_path: relative_path(&source, &base)?,
        target_path: Some(relative_path(&target, &base)?),
        is_undoable: true,
    })
}

#[tauri::command]
pub fn delete_to_archive(base_path: String, path: String) -> Result<FileOperationLog, FsError> {
    let base = canonical_base(&base_path)?;
    let source = validate_source(&path, &base_path)?;
    let relative_source = relative_path_buf(&source, &base)?;
    let archive_target = archive_target_path(&base, &relative_source)?;

    if let Some(parent) = archive_target.parent() {
        fs::create_dir_all(parent)?;
    }

    fs::rename(&source, &archive_target)?;

    Ok(FileOperationLog {
        operation_type: "archive".to_string(),
        source_path: relative_path_buf_to_string(&relative_source),
        target_path: Some(relative_path(&archive_target, &base)?),
        is_undoable: true,
    })
}

#[tauri::command]
pub fn undo_last_operation(
    base_path: String,
    operation_type: String,
    source_path: String,
    target_path: Option<String>,
) -> Result<(), FsError> {
    let base = canonical_base(&base_path)?;
    let source = base.join(source_path);
    let target = target_path.map(|target_path| base.join(target_path));

    match operation_type.as_str() {
        "rename" | "move" | "archive" => {
            let current = target.ok_or(FsError::NotFound)?;
            let current = validate_existing_path(&current, Some(&base_path))?;
            let original = validate_target_for_undo(&source, &base_path)?;
            fs::rename(current, original)?;
        }
        "copy" => {
            let copied = target.ok_or(FsError::NotFound)?;
            let copied = validate_existing_path(&copied, Some(&base_path))?;
            if copied.is_dir() {
                return Err(FsError::Io(
                    "Kopierte Ordner koennen im MVP nicht rueckgaengig gemacht werden.".to_string(),
                ));
            }
            fs::remove_file(copied)?;
        }
        _ => {
            return Err(FsError::Io(format!(
                "Operation '{}' kann nicht rueckgaengig gemacht werden.",
                operation_type
            )));
        }
    }

    let _ = base;
    Ok(())
}

fn file_entry_from_path(path: PathBuf, metadata: fs::Metadata) -> Result<FileEntry, FsError> {
    Ok(FileEntry {
        name: file_name(&path)?,
        path: path_to_string(&path),
        is_directory: metadata.is_dir(),
        size: file_size(&metadata),
        modified_at: modified_at(&metadata)?,
        extension: extension(&path),
    })
}

fn file_info_from_path(path: PathBuf, metadata: fs::Metadata) -> Result<FileInfo, FsError> {
    Ok(FileInfo {
        name: file_name(&path)?,
        path: path_to_string(&path),
        is_directory: metadata.is_dir(),
        size: file_size(&metadata),
        modified_at: modified_at(&metadata)?,
        extension: extension(&path),
    })
}

fn file_name(path: &Path) -> Result<String, FsError> {
    path.file_name()
        .map(|name| name.to_string_lossy().to_string())
        .ok_or(FsError::Io(
            "Dateiname konnte nicht gelesen werden.".to_string(),
        ))
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn file_size(metadata: &fs::Metadata) -> Option<u64> {
    if metadata.is_file() {
        Some(metadata.len())
    } else {
        None
    }
}

fn modified_at(metadata: &fs::Metadata) -> Result<Option<u64>, FsError> {
    let modified = match metadata.modified() {
        Ok(modified) => modified,
        Err(error) if error.kind() == std::io::ErrorKind::Unsupported => return Ok(None),
        Err(error) => return Err(FsError::from(error)),
    };

    let duration = modified
        .duration_since(UNIX_EPOCH)
        .map_err(|error| FsError::Io(error.to_string()))?;
    Ok(Some(duration.as_secs()))
}

fn extension(path: &Path) -> Option<String> {
    path.extension()
        .map(|extension| extension.to_string_lossy().to_string())
}

fn canonical_base(base_path: &str) -> Result<PathBuf, FsError> {
    let base = path_from_string(base_path)?;
    validate_existing_path(&base, None)
}

fn validate_source(path: &str, base_path: &str) -> Result<PathBuf, FsError> {
    let path = path_from_string(path)?;
    validate_existing_path(&path, Some(base_path))
}

fn validate_target(path: &str, base_path: &str) -> Result<PathBuf, FsError> {
    let path = path_from_string(path)?;
    validate_new_path(&path, Some(base_path))
}

fn validate_target_for_undo(path: &Path, base_path: &str) -> Result<PathBuf, FsError> {
    if path.exists() {
        return Err(FsError::AlreadyExists);
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    validate_new_path(path, Some(base_path))
}

fn relative_path(path: &Path, base: &Path) -> Result<String, FsError> {
    relative_path_buf(path, base).map(|path| relative_path_buf_to_string(&path))
}

fn relative_path_buf(path: &Path, base: &Path) -> Result<PathBuf, FsError> {
    path.strip_prefix(base)
        .map(PathBuf::from)
        .map_err(|_| FsError::PathOutsideBase)
}

fn relative_path_buf_to_string(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn archive_target_path(base: &Path, relative_source: &Path) -> Result<PathBuf, FsError> {
    let target = base.join("09_Archiv").join(relative_source);

    if !target.exists() {
        return Ok(target);
    }

    let parent = target.parent().ok_or(FsError::PathOutsideBase)?;
    let stem = target
        .file_stem()
        .map(|stem| stem.to_string_lossy().to_string())
        .ok_or(FsError::Io(
            "Archiv-Zielname konnte nicht erzeugt werden.".to_string(),
        ))?;
    let extension = target
        .extension()
        .map(|extension| format!(".{}", extension.to_string_lossy()))
        .unwrap_or_default();

    Ok(parent.join(format!("{}_{}{}", stem, timestamp_suffix()?, extension)))
}

fn timestamp_suffix() -> Result<String, FsError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| FsError::Io(error.to_string()))?
        .as_secs() as i64;
    let days = now.div_euclid(86_400);
    let seconds_of_day = now.rem_euclid(86_400);
    let (year, month, day) = civil_from_days(days);
    let hour = seconds_of_day / 3_600;
    let minute = (seconds_of_day % 3_600) / 60;
    let second = seconds_of_day % 60;

    Ok(format!(
        "{:04}-{:02}-{:02}_{:02}-{:02}-{:02}",
        year, month, day, hour, minute, second
    ))
}

fn civil_from_days(days_since_epoch: i64) -> (i64, i64, i64) {
    let z = days_since_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = mp + if mp < 10 { 3 } else { -9 };
    let year = y + if m <= 2 { 1 } else { 0 };

    (year, m, d)
}
