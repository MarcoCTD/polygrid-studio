mod ai;
mod backup;
mod filesystem;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            ai::keychain::keychain_set,
            ai::keychain::keychain_get,
            ai::keychain::keychain_delete,
            ai::keychain::set_api_key,
            ai::keychain::get_api_key,
            ai::keychain::delete_api_key,
            ai::commands::ai_generate_text,
            ai::commands::ai_generate_structured,
            ai::commands::ai_test_connection,
            ai::commands::ai_list_ollama_models,
            ai::commands::ai_estimate_cost,
            filesystem::commands::list_directory,
            filesystem::commands::get_file_info,
            filesystem::commands::create_directory,
            filesystem::commands::open_in_explorer,
            filesystem::commands::check_path_exists,
            filesystem::commands::ensure_onedrive_structure,
            backup::create_backup,
            backup::list_backups,
            backup::delete_backup,
            backup::get_backup_directory,
            backup::create_pre_migration_backup,
            filesystem::commands::rename_file,
            filesystem::commands::move_file,
            filesystem::commands::copy_file,
            filesystem::commands::delete_to_archive,
            filesystem::commands::undo_last_operation
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
