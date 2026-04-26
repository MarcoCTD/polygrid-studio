use serde::Serialize;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum FsError {
    PathOutsideBase,
    NotFound,
    PermissionDenied,
    AlreadyExists,
    Io(String),
}

impl From<io::Error> for FsError {
    fn from(error: io::Error) -> Self {
        match error.kind() {
            io::ErrorKind::NotFound => FsError::NotFound,
            io::ErrorKind::PermissionDenied => FsError::PermissionDenied,
            io::ErrorKind::AlreadyExists => FsError::AlreadyExists,
            _ => FsError::Io(error.to_string()),
        }
    }
}

pub fn path_from_string(path: &str) -> Result<PathBuf, FsError> {
    let path = PathBuf::from(path);
    if path.is_absolute() {
        Ok(path)
    } else {
        Err(FsError::PathOutsideBase)
    }
}

pub fn validate_existing_path(path: &Path, base_path: Option<&str>) -> Result<PathBuf, FsError> {
    let canonical_path = fs::canonicalize(path)?;
    validate_against_base(&canonical_path, base_path)?;
    Ok(canonical_path)
}

pub fn validate_new_path(path: &Path, base_path: Option<&str>) -> Result<PathBuf, FsError> {
    if path.exists() {
        return Err(FsError::AlreadyExists);
    }

    let parent = path.parent().ok_or(FsError::PathOutsideBase)?;
    let canonical_parent = fs::canonicalize(parent)?;
    validate_against_base(&canonical_parent, base_path)?;
    Ok(path.to_path_buf())
}

pub fn validate_setup_base_path(path: &Path) -> Result<PathBuf, FsError> {
    if !path.is_absolute() {
        return Err(FsError::PathOutsideBase);
    }

    Ok(path.to_path_buf())
}

fn validate_against_base(path: &Path, base_path: Option<&str>) -> Result<(), FsError> {
    let Some(base_path) = base_path else {
        return Ok(());
    };

    let base = path_from_string(base_path)?;
    let canonical_base = fs::canonicalize(base)?;

    if path.starts_with(canonical_base) {
        Ok(())
    } else {
        Err(FsError::PathOutsideBase)
    }
}
