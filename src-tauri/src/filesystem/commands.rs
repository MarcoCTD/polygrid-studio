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

/// Schreibt eine Exportdatei (z.B. EÜR-xlsx, Modul 14). Überschreiben ist
/// gewollt (Export kann neu erzeugt werden). Mit `base_path` wird gegen den
/// OneDrive-Basisordner validiert; `None` gilt für Ziele aus dem nativen
/// Speichern-Dialog. Liefert den endgültigen absoluten Pfad zurück.
#[tauri::command]
pub fn write_export_file(
    path: String,
    base_path: Option<String>,
    contents: Vec<u8>,
) -> Result<String, FsError> {
    let path = path_from_string(&path)?;
    let parent = path.parent().ok_or(FsError::PathOutsideBase)?;
    let canonical_parent = validate_existing_path(parent, base_path.as_deref())?;
    let file_name = path.file_name().ok_or(FsError::Io(
        "Dateiname konnte nicht gelesen werden.".to_string(),
    ))?;
    let target = canonical_parent.join(file_name);

    fs::write(&target, &contents)?;
    Ok(path_to_string(&target))
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

/// Importiert eine Datei von ausserhalb des OneDrive-Basisordners in die Basis.
/// Die Quelle wird nur gelesen und bleibt unveraendert (Kopie, nie Verschieben);
/// eine Basis-Validierung findet fuer die Quelle bewusst NICHT statt. Das Ziel
/// wird dagegen strikt validiert: `target_folder` ist ein relativer Pfad
/// innerhalb der Basis, Traversal (`..`, absolute Pfade) wird abgelehnt.
/// Bei Namenskonflikt wird `-1`, `-2`, ... vor der Endung angehaengt,
/// bestehende Dateien werden nie ueberschrieben.
#[tauri::command]
pub fn import_file_to_base(
    base_path: String,
    source: String,
    target_folder: String,
    file_name: String,
) -> Result<FileOperationLog, FsError> {
    let base = canonical_base(&base_path)?;
    let source_path = path_from_string(&source)?;
    let source_path = fs::canonicalize(&source_path)?;

    if source_path.is_dir() {
        return Err(FsError::Io(
            "Ordner koennen nicht importiert werden.".to_string(),
        ));
    }

    let file_name = validate_import_file_name(&file_name)?;
    let target_dir = resolve_import_target_dir(&base, &target_folder)?;
    let final_target = conflict_free_target(&target_dir, file_name)?;

    fs::copy(&source_path, &final_target)?;

    Ok(FileOperationLog {
        operation_type: "import".to_string(),
        // Die Quelle liegt ausserhalb der Basis, daher absoluter Pfad im Log.
        source_path: path_to_string(&source_path),
        target_path: Some(relative_path(&final_target, &base)?),
        is_undoable: false,
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

fn validate_import_file_name(file_name: &str) -> Result<&str, FsError> {
    let trimmed = file_name.trim();
    if trimmed.is_empty()
        || trimmed == "."
        || trimmed == ".."
        || trimmed.contains('/')
        || trimmed.contains('\\')
    {
        return Err(FsError::Io(
            "Ungueltiger Dateiname fuer den Import.".to_string(),
        ));
    }
    Ok(trimmed)
}

fn resolve_import_target_dir(base: &Path, target_folder: &str) -> Result<PathBuf, FsError> {
    let relative = Path::new(target_folder);
    let only_normal_components = relative
        .components()
        .all(|component| matches!(component, std::path::Component::Normal(_)));
    if relative.as_os_str().is_empty() || relative.is_absolute() || !only_normal_components {
        return Err(FsError::PathOutsideBase);
    }

    let target_dir = base.join(relative);
    fs::create_dir_all(&target_dir)?;

    // Nach dem Anlegen kanonisieren: faengt Symlinks ab, die aus der Basis fuehren.
    let canonical = fs::canonicalize(&target_dir)?;
    if canonical.starts_with(base) {
        Ok(canonical)
    } else {
        Err(FsError::PathOutsideBase)
    }
}

fn conflict_free_target(target_dir: &Path, file_name: &str) -> Result<PathBuf, FsError> {
    let first = target_dir.join(file_name);
    if !first.exists() {
        return Ok(first);
    }

    let (stem, extension) = split_file_name(file_name);
    for suffix in 1..=999 {
        let candidate = target_dir.join(format!("{}-{}{}", stem, suffix, extension));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(FsError::Io(
        "Kein freier Dateiname am Zielort gefunden.".to_string(),
    ))
}

fn split_file_name(file_name: &str) -> (String, String) {
    match file_name.rfind('.') {
        Some(index) if index > 0 => (
            file_name[..index].to_string(),
            file_name[index..].to_string(),
        ),
        _ => (file_name.to_string(), String::new()),
    }
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    static TEST_DIR_COUNTER: AtomicU32 = AtomicU32::new(0);

    /// Eindeutiges Testverzeichnis unterhalb des System-Temp-Ordners.
    fn make_test_dir(label: &str) -> PathBuf {
        let counter = TEST_DIR_COUNTER.fetch_add(1, Ordering::SeqCst);
        let dir = std::env::temp_dir().join(format!(
            "polygrid-import-test-{}-{}-{}",
            std::process::id(),
            counter,
            label
        ));
        fs::create_dir_all(&dir).expect("Testverzeichnis anlegen");
        dir
    }

    #[test]
    fn split_file_name_trennt_stamm_und_endung() {
        assert_eq!(
            split_file_name("foto.png"),
            ("foto".to_string(), ".png".to_string())
        );
        assert_eq!(
            split_file_name("archiv.tar.gz"),
            ("archiv.tar".to_string(), ".gz".to_string())
        );
        assert_eq!(
            split_file_name("ohne-endung"),
            ("ohne-endung".to_string(), String::new())
        );
        assert_eq!(
            split_file_name(".gitignore"),
            (".gitignore".to_string(), String::new())
        );
    }

    #[test]
    fn conflict_free_target_haengt_suffixe_an() {
        let dir = make_test_dir("conflict");
        fs::write(dir.join("foto.png"), b"a").unwrap();
        fs::write(dir.join("foto-1.png"), b"b").unwrap();

        let target = conflict_free_target(&dir, "foto.png").unwrap();
        assert_eq!(target, dir.join("foto-2.png"));

        let frei = conflict_free_target(&dir, "neu.png").unwrap();
        assert_eq!(frei, dir.join("neu.png"));

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn resolve_import_target_dir_lehnt_traversal_ab() {
        let base = make_test_dir("traversal-base");
        let base = fs::canonicalize(&base).unwrap();

        assert!(matches!(
            resolve_import_target_dir(&base, "../ausserhalb"),
            Err(FsError::PathOutsideBase)
        ));
        assert!(matches!(
            resolve_import_target_dir(&base, "/etc"),
            Err(FsError::PathOutsideBase)
        ));
        assert!(matches!(
            resolve_import_target_dir(&base, "02_Produkte/../../raus"),
            Err(FsError::PathOutsideBase)
        ));
        assert!(matches!(
            resolve_import_target_dir(&base, ""),
            Err(FsError::PathOutsideBase)
        ));

        let ok = resolve_import_target_dir(&base, "01_Finanzen/Belege_2026").unwrap();
        assert!(ok.starts_with(&base));
        assert!(ok.is_dir());

        fs::remove_dir_all(&base).unwrap();
    }

    #[test]
    fn import_file_to_base_kopiert_und_laesst_original_stehen() {
        let base = make_test_dir("import-base");
        let extern_dir = make_test_dir("import-extern");
        let source = extern_dir.join("beleg.pdf");
        fs::write(&source, b"inhalt").unwrap();

        let log = import_file_to_base(
            base.to_string_lossy().to_string(),
            source.to_string_lossy().to_string(),
            "01_Finanzen/Belege_2026".to_string(),
            "beleg.pdf".to_string(),
        )
        .unwrap();

        assert_eq!(log.operation_type, "import");
        assert_eq!(
            log.target_path.as_deref(),
            Some("01_Finanzen/Belege_2026/beleg.pdf")
        );
        assert!(!log.is_undoable);
        // Original bleibt erhalten, Kopie existiert mit gleichem Inhalt.
        assert!(source.exists());
        let base_canonical = fs::canonicalize(&base).unwrap();
        let copy = base_canonical.join("01_Finanzen/Belege_2026/beleg.pdf");
        assert_eq!(fs::read(&copy).unwrap(), b"inhalt");

        fs::remove_dir_all(&base).unwrap();
        fs::remove_dir_all(&extern_dir).unwrap();
    }

    #[test]
    fn import_file_to_base_loest_namenskonflikt() {
        let base = make_test_dir("konflikt-base");
        let extern_dir = make_test_dir("konflikt-extern");
        let source = extern_dir.join("foto.png");
        fs::write(&source, b"neu").unwrap();

        let ziel_dir = base.join("02_Produkte/vase/Bilder");
        fs::create_dir_all(&ziel_dir).unwrap();
        fs::write(ziel_dir.join("foto.png"), b"alt").unwrap();

        let log = import_file_to_base(
            base.to_string_lossy().to_string(),
            source.to_string_lossy().to_string(),
            "02_Produkte/vase/Bilder".to_string(),
            "foto.png".to_string(),
        )
        .unwrap();

        assert_eq!(
            log.target_path.as_deref(),
            Some("02_Produkte/vase/Bilder/foto-1.png")
        );
        // Bestehende Datei wurde nicht ueberschrieben.
        assert_eq!(fs::read(ziel_dir.join("foto.png")).unwrap(), b"alt");
        assert_eq!(fs::read(ziel_dir.join("foto-1.png")).unwrap(), b"neu");

        fs::remove_dir_all(&base).unwrap();
        fs::remove_dir_all(&extern_dir).unwrap();
    }

    #[test]
    fn import_file_to_base_fehler_bei_fehlender_quelle() {
        let base = make_test_dir("fehler-base");

        let result = import_file_to_base(
            base.to_string_lossy().to_string(),
            base.join("gibt-es-nicht.pdf").to_string_lossy().to_string(),
            "04_Auftraege".to_string(),
            "gibt-es-nicht.pdf".to_string(),
        );
        assert!(matches!(result, Err(FsError::NotFound)));

        fs::remove_dir_all(&base).unwrap();
    }
}
