use super::paths::{
    path_from_string, validate_existing_path, validate_new_path, validate_setup_base_path, FsError,
};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;

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
