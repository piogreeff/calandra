use std::path::{Component, Path, PathBuf};
use tauri::Manager;

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Poe2Paths {
    pub game_directory: String,
    pub client_log_path: String,
    pub build_planner_directory: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildFileWritePlan {
    pub action_id: String,
    pub output_path: String,
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientLogAppendResult {
    pub cursor_offset: usize,
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardTextCapture {
    pub action_id: String,
    pub captured_at: String,
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalBackupFileRequest {
    pub kind: String,
    pub source_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalBackupEntry {
    pub kind: String,
    pub source_path: String,
    pub destination_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalBackupPlan {
    pub action_id: String,
    pub captured_at: String,
    pub backup_root: String,
    pub entries: Vec<LocalBackupEntry>,
}

#[derive(Debug, Default, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopSettings {
    theme_preference: Option<String>,
}

#[tauri::command]
fn get_default_poe2_paths() -> Result<Poe2Paths, String> {
    let home_directory = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .ok_or_else(|| "Unable to resolve the user home directory".to_string())?;

    Ok(resolve_default_poe2_paths(PathBuf::from(home_directory)))
}

#[tauri::command]
fn get_theme_preference(app: tauri::AppHandle) -> Result<Option<String>, String> {
    read_theme_preference_from_path(desktop_settings_path(&app)?)
}

#[tauri::command]
fn set_theme_preference(app: tauri::AppHandle, theme: String) -> Result<(), String> {
    write_theme_preference_to_path(desktop_settings_path(&app)?, &theme)
}

#[tauri::command]
fn write_build_file(
    build_planner_directory: String,
    file_name: String,
    content: String,
    action_id: String,
    user_initiated: bool,
) -> Result<BuildFileWritePlan, String> {
    write_build_file_to_path(
        build_planner_directory,
        file_name,
        content,
        action_id,
        user_initiated,
    )
}

#[tauri::command]
fn read_client_log_append(
    client_log_path: String,
    offset: usize,
) -> Result<ClientLogAppendResult, String> {
    read_client_log_append_from_path(client_log_path, offset)
}

#[tauri::command]
fn capture_clipboard_text(
    action_id: String,
    captured_at: String,
    user_initiated: bool,
) -> Result<ClipboardTextCapture, String> {
    capture_clipboard_text_from_reader(
        action_id,
        captured_at,
        user_initiated,
        read_system_clipboard_text,
    )
}

#[tauri::command]
fn copy_local_config_backup(
    game_directory: String,
    backup_directory: String,
    action_id: String,
    captured_at: String,
    user_initiated: bool,
    files: Vec<LocalBackupFileRequest>,
) -> Result<LocalBackupPlan, String> {
    copy_local_config_backup_to_path(
        game_directory,
        backup_directory,
        action_id,
        captured_at,
        user_initiated,
        files,
    )
}

#[tauri::command]
fn discover_local_config_backup_files(
    game_directory: String,
) -> Result<Vec<LocalBackupFileRequest>, String> {
    discover_local_config_backup_files_from_path(game_directory)
}

pub fn resolve_default_poe2_paths(home_directory: impl AsRef<Path>) -> Poe2Paths {
    let game_directory = home_directory
        .as_ref()
        .join("Documents")
        .join("My Games")
        .join("Path of Exile 2");
    let client_log_path = game_directory.join("Client.txt");
    let build_planner_directory = game_directory.join("BuildPlanner");

    Poe2Paths {
        game_directory: path_to_string(game_directory),
        client_log_path: path_to_string(client_log_path),
        build_planner_directory: path_to_string(build_planner_directory),
    }
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_default_poe2_paths,
            get_theme_preference,
            set_theme_preference,
            capture_clipboard_text,
            copy_local_config_backup,
            discover_local_config_backup_files,
            read_client_log_append,
            write_build_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Calandra desktop shell");
}

fn desktop_settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_config_dir()
        .map_err(|error| format!("Unable to resolve app config directory: {error}"))?
        .join("settings.json"))
}

fn read_theme_preference_from_path(path: impl AsRef<Path>) -> Result<Option<String>, String> {
    let path = path.as_ref();

    if !path.exists() {
        return Ok(None);
    }

    let settings = read_desktop_settings(path)?;

    Ok(settings.theme_preference)
}

fn write_theme_preference_to_path(path: impl AsRef<Path>, theme: &str) -> Result<(), String> {
    let path = path.as_ref();
    let mut settings = if path.exists() {
        read_desktop_settings(path)?
    } else {
        DesktopSettings::default()
    };

    settings.theme_preference = Some(theme.to_string());

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Unable to create settings directory: {error}"))?;
    }

    let contents = serde_json::to_string_pretty(&settings)
        .map_err(|error| format!("Unable to serialize desktop settings: {error}"))?;

    std::fs::write(path, contents)
        .map_err(|error| format!("Unable to write desktop settings: {error}"))
}

fn read_desktop_settings(path: &Path) -> Result<DesktopSettings, String> {
    let contents = std::fs::read_to_string(path)
        .map_err(|error| format!("Unable to read desktop settings: {error}"))?;

    serde_json::from_str(&contents)
        .map_err(|error| format!("Unable to parse desktop settings: {error}"))
}

fn read_client_log_append_from_path(
    client_log_path: String,
    offset: usize,
) -> Result<ClientLogAppendResult, String> {
    let path = PathBuf::from(client_log_path);
    if !is_poe2_client_txt_path(&path) {
        return Err("Client.txt read path must be the PoE2 Client.txt file".to_string());
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|error| format!("Unable to read Client.txt: {error}"))?;
    let starting_offset = if offset <= content.len() && content.is_char_boundary(offset) {
        offset
    } else {
        0
    };
    let appended_content = &content[starting_offset..];
    let complete_length = complete_line_length(appended_content);

    Ok(ClientLogAppendResult {
        cursor_offset: starting_offset + complete_length,
        content: appended_content[..complete_length].to_string(),
    })
}

fn capture_clipboard_text_from_reader(
    action_id: String,
    captured_at: String,
    user_initiated: bool,
    read_clipboard_text: impl FnOnce() -> Result<String, String>,
) -> Result<ClipboardTextCapture, String> {
    if !user_initiated {
        return Err("Clipboard text capture must be initiated by a user action".to_string());
    }

    let action_id = action_id.trim().to_string();
    if action_id.is_empty() {
        return Err("Clipboard text capture requires an action id".to_string());
    }

    let captured_at = captured_at.trim().to_string();
    if captured_at.is_empty() {
        return Err("Clipboard text capture requires a timestamp".to_string());
    }

    let text = read_clipboard_text()?;
    if text.trim().is_empty() {
        return Err("Clipboard text is empty".to_string());
    }

    Ok(ClipboardTextCapture {
        action_id,
        captured_at,
        text,
    })
}

fn copy_local_config_backup_to_path(
    game_directory: String,
    backup_directory: String,
    action_id: String,
    captured_at: String,
    user_initiated: bool,
    files: Vec<LocalBackupFileRequest>,
) -> Result<LocalBackupPlan, String> {
    let plan = plan_local_config_backup(
        game_directory,
        backup_directory,
        action_id,
        captured_at,
        user_initiated,
        files,
    )?;

    for entry in &plan.entries {
        let destination_path = PathBuf::from(&entry.destination_path);
        if let Some(parent) = destination_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|error| format!("Unable to create backup directory: {error}"))?;
        }
        std::fs::copy(&entry.source_path, &entry.destination_path)
            .map_err(|error| format!("Unable to copy backup file: {error}"))?;
    }

    Ok(plan)
}

fn plan_local_config_backup(
    game_directory: String,
    backup_directory: String,
    action_id: String,
    captured_at: String,
    user_initiated: bool,
    files: Vec<LocalBackupFileRequest>,
) -> Result<LocalBackupPlan, String> {
    if !user_initiated {
        return Err("Local backup must be initiated by a user action".to_string());
    }

    let action_id = action_id.trim().to_string();
    if action_id.is_empty() {
        return Err("Local backup requires an action id".to_string());
    }

    if files.is_empty() {
        return Err("Local backup requires at least one file".to_string());
    }

    let captured_at = captured_at.trim().to_string();
    if captured_at.is_empty() {
        return Err("Local backup requires a timestamp".to_string());
    }

    let game_directory = normalize_path_lexically(PathBuf::from(game_directory));
    let backup_root = normalize_path_lexically(
        PathBuf::from(backup_directory)
            .join("Path of Exile 2")
            .join(normalize_backup_timestamp(&captured_at)),
    );

    let entries = files
        .into_iter()
        .map(|file| {
            let source_path = normalize_path_lexically(PathBuf::from(file.source_path));
            if !is_path_inside_directory(&source_path, &game_directory) {
                return Err(
                    "Local backup source path must stay inside the PoE2 directory".to_string(),
                );
            }

            let relative_path = source_path.strip_prefix(&game_directory).map_err(|_| {
                "Local backup source path must stay inside the PoE2 directory".to_string()
            })?;
            let destination_path = normalize_path_lexically(backup_root.join(relative_path));
            if !is_path_inside_directory(&destination_path, &backup_root) {
                return Err(
                    "Local backup destination path must stay inside the backup root".to_string(),
                );
            }

            Ok(LocalBackupEntry {
                kind: file.kind,
                source_path: path_to_string(source_path),
                destination_path: path_to_string(destination_path),
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    Ok(LocalBackupPlan {
        action_id,
        captured_at,
        backup_root: path_to_string(backup_root),
        entries,
    })
}

fn discover_local_config_backup_files_from_path(
    game_directory: String,
) -> Result<Vec<LocalBackupFileRequest>, String> {
    let game_directory = normalize_path_lexically(PathBuf::from(game_directory));
    let build_planner_directory = game_directory.join("BuildPlanner");
    let overlay_config_path = game_directory.join("Calandra").join("overlay.json");
    let mut files = Vec::new();

    files.extend(discover_directory_files(
        &game_directory,
        ".filter",
        "loot-filter",
    )?);
    files.extend(discover_directory_files(
        &build_planner_directory,
        ".build",
        "build-file",
    )?);

    if is_regular_file(&overlay_config_path)? {
        files.push(LocalBackupFileRequest {
            kind: "overlay-config".to_string(),
            source_path: path_to_string(overlay_config_path),
        });
    }

    Ok(files)
}

fn write_build_file_to_path(
    build_planner_directory: String,
    file_name: String,
    content: String,
    action_id: String,
    user_initiated: bool,
) -> Result<BuildFileWritePlan, String> {
    let plan = plan_build_file_write(
        build_planner_directory,
        file_name,
        content,
        action_id,
        user_initiated,
    )?;

    let output_path = PathBuf::from(&plan.output_path);
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Unable to create BuildPlanner directory: {error}"))?;
    }
    std::fs::write(&output_path, &plan.content)
        .map_err(|error| format!("Unable to write .build file: {error}"))?;

    Ok(plan)
}

fn plan_build_file_write(
    build_planner_directory: String,
    file_name: String,
    content: String,
    action_id: String,
    user_initiated: bool,
) -> Result<BuildFileWritePlan, String> {
    if !user_initiated {
        return Err(".build export must be initiated by a user action".to_string());
    }

    let action_id = action_id.trim().to_string();
    if action_id.is_empty() {
        return Err(".build export requires an action id".to_string());
    }

    let file_name = normalize_build_file_name(&file_name)?;
    let base_directory = PathBuf::from(build_planner_directory);
    if !is_build_planner_directory(&base_directory) {
        return Err(".build export directory must be the PoE2 BuildPlanner directory".to_string());
    }
    let output_path = base_directory.join(file_name);

    Ok(BuildFileWritePlan {
        action_id,
        output_path: path_to_string(output_path),
        content,
    })
}

fn normalize_build_file_name(file_name: &str) -> Result<String, String> {
    let trimmed = file_name.trim();
    if trimmed.is_empty() {
        return Err(".build export requires a file name".to_string());
    }

    if trimmed.contains('\\') || trimmed.contains('/') || trimmed.contains(':') {
        return Err(".build export file name must not contain path separators".to_string());
    }

    Ok(if trimmed.to_lowercase().ends_with(".build") {
        trimmed.to_string()
    } else {
        format!("{trimmed}.build")
    })
}

fn is_build_planner_directory(path: &Path) -> bool {
    path_has_suffix(path, &["path of exile 2", "buildplanner"])
}

fn is_poe2_client_txt_path(path: &Path) -> bool {
    path_has_suffix(path, &["path of exile 2", "client.txt"])
}

fn path_has_suffix(path: &Path, suffix: &[&str]) -> bool {
    let components = path
        .components()
        .filter_map(|component| component.as_os_str().to_str())
        .map(|component| component.to_ascii_lowercase())
        .collect::<Vec<_>>();

    components.ends_with(
        &suffix
            .iter()
            .map(|component| component.to_string())
            .collect::<Vec<_>>(),
    )
}

fn complete_line_length(content: &str) -> usize {
    content
        .rfind('\n')
        .map(|last_newline_index| last_newline_index + 1)
        .unwrap_or(0)
}

fn normalize_backup_timestamp(captured_at: &str) -> String {
    captured_at.replace([':', '.'], "-")
}

fn is_path_inside_directory(path: &Path, directory: &Path) -> bool {
    path != directory && path.starts_with(directory)
}

fn normalize_path_lexically(path: PathBuf) -> PathBuf {
    let mut normalized = PathBuf::new();

    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            _ => normalized.push(component.as_os_str()),
        }
    }

    normalized
}

fn discover_directory_files(
    directory: &Path,
    extension: &str,
    kind: &str,
) -> Result<Vec<LocalBackupFileRequest>, String> {
    let entries = match std::fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(format!("Unable to read local backup directory: {error}")),
    };

    let mut files = entries
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let file_type = entry.file_type().ok()?;
            if !file_type.is_file() {
                return None;
            }

            let file_name = entry.file_name().to_string_lossy().to_ascii_lowercase();
            if !file_name.ends_with(extension) {
                return None;
            }

            Some(LocalBackupFileRequest {
                kind: kind.to_string(),
                source_path: path_to_string(entry.path()),
            })
        })
        .collect::<Vec<_>>();

    files.sort_by(|left, right| left.source_path.cmp(&right.source_path));

    Ok(files)
}

fn is_regular_file(path: &Path) -> Result<bool, String> {
    match std::fs::symlink_metadata(path) {
        Ok(metadata) => Ok(metadata.is_file()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(format!("Unable to inspect local backup file: {error}")),
    }
}

fn path_to_string(path: PathBuf) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(windows)]
fn read_system_clipboard_text() -> Result<String, String> {
    clipboard_win::get_clipboard_string()
        .map_err(|error| format!("Unable to read Windows clipboard text: {error}"))
}

#[cfg(not(windows))]
fn read_system_clipboard_text() -> Result<String, String> {
    Err("Clipboard text capture is only supported in the Windows desktop shell".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    #[cfg(windows)]
    fn resolves_default_poe2_paths_under_documents() {
        let paths = resolve_default_poe2_paths(PathBuf::from(r"C:\Users\Pio"));

        assert_eq!(
            paths.game_directory,
            r"C:\Users\Pio\Documents\My Games\Path of Exile 2"
        );
        assert_eq!(
            paths.client_log_path,
            r"C:\Users\Pio\Documents\My Games\Path of Exile 2\Client.txt"
        );
        assert_eq!(
            paths.build_planner_directory,
            r"C:\Users\Pio\Documents\My Games\Path of Exile 2\BuildPlanner"
        );
    }

    #[test]
    fn reads_missing_theme_preference_as_none() {
        let path = unique_settings_path("missing-theme");

        assert_eq!(read_theme_preference_from_path(&path).unwrap(), None);
    }

    #[test]
    fn round_trips_theme_preference_to_desktop_settings_file() {
        let path = unique_settings_path("theme-round-trip");

        write_theme_preference_to_path(&path, "luxury").unwrap();

        assert_eq!(
            read_theme_preference_from_path(&path).unwrap(),
            Some("luxury".to_string())
        );
        assert!(std::fs::read_to_string(&path)
            .unwrap()
            .contains("\"themePreference\": \"luxury\""));

        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn plans_user_initiated_build_file_write_inside_buildplanner() {
        let plan = plan_build_file_write(
            r"C:\Users\Pio\Documents\My Games\Path of Exile 2\BuildPlanner".to_string(),
            "Storm Monk".to_string(),
            "[build]\nname=Storm Monk\n".to_string(),
            "advisor-export-001".to_string(),
            true,
        )
        .unwrap();

        assert_eq!(plan.action_id, "advisor-export-001");
        assert_eq!(plan.content, "[build]\nname=Storm Monk\n");
        assert!(plan.output_path.ends_with(r"BuildPlanner\Storm Monk.build"));
    }

    #[test]
    fn rejects_background_build_file_writes() {
        let error = plan_build_file_write(
            r"C:\Users\Pio\Documents\My Games\Path of Exile 2\BuildPlanner".to_string(),
            "Storm Monk".to_string(),
            "[build]\n".to_string(),
            "background-export".to_string(),
            false,
        )
        .unwrap_err();

        assert_eq!(error, ".build export must be initiated by a user action");
    }

    #[test]
    fn rejects_build_file_names_with_path_separators() {
        let error = plan_build_file_write(
            r"C:\Users\Pio\Documents\My Games\Path of Exile 2\BuildPlanner".to_string(),
            r"..\Client.txt".to_string(),
            "[build]\n".to_string(),
            "advisor-export-002".to_string(),
            true,
        )
        .unwrap_err();

        assert_eq!(
            error,
            ".build export file name must not contain path separators"
        );
    }

    #[test]
    fn rejects_build_file_writes_outside_poe2_buildplanner() {
        let error = plan_build_file_write(
            r"C:\Users\Pio\Desktop\BuildPlanner".to_string(),
            "Storm Monk".to_string(),
            "[build]\n".to_string(),
            "advisor-export-003".to_string(),
            true,
        )
        .unwrap_err();

        assert_eq!(
            error,
            ".build export directory must be the PoE2 BuildPlanner directory"
        );
    }

    #[test]
    fn writes_user_initiated_build_file() {
        let path = unique_settings_path("build-writer");
        let build_planner_directory = path
            .parent()
            .unwrap()
            .join("Path of Exile 2")
            .join("BuildPlanner");

        let plan = write_build_file_to_path(
            path_to_string(build_planner_directory.clone()),
            "Storm Monk".to_string(),
            "[build]\nname=Storm Monk\n".to_string(),
            "advisor-export-004".to_string(),
            true,
        )
        .unwrap();

        assert_eq!(
            std::fs::read_to_string(&plan.output_path).unwrap(),
            "[build]\nname=Storm Monk\n"
        );

        let _ = std::fs::remove_dir_all(path.parent().unwrap());
    }

    #[test]
    fn reads_only_complete_appended_client_log_content() {
        let path = unique_settings_path("client-log-append")
            .parent()
            .unwrap()
            .join("Path of Exile 2")
            .join("Client.txt");
        let before =
            "2026/06/21 13:52:10 12345678 abc [INFO Client 1234] : You have entered Clearfell.\n";
        let complete =
            "2026/06/21 13:52:11 12345679 abc [INFO Client 1234] : You have entered The Riverbank.\n";
        let partial = "2026/06/21 13:52:12 12345680 abc [INFO Client 1234] : You have entered ";

        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, format!("{before}{complete}{partial}")).unwrap();

        let result =
            read_client_log_append_from_path(path_to_string(path.clone()), before.len()).unwrap();

        assert_eq!(result.cursor_offset, before.len() + complete.len());
        assert_eq!(result.content, complete);

        let _ = std::fs::remove_dir_all(path.parent().unwrap().parent().unwrap());
    }

    #[test]
    fn resets_client_log_cursor_after_truncation() {
        let path = unique_settings_path("client-log-rotated")
            .parent()
            .unwrap()
            .join("Path of Exile 2")
            .join("Client.txt");
        let content =
            "2026/06/21 13:52:11 12345679 abc [INFO Client 1234] : You have entered The Riverbank.\n";

        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, content).unwrap();

        let result = read_client_log_append_from_path(path_to_string(path.clone()), 200).unwrap();

        assert_eq!(result.cursor_offset, content.len());
        assert_eq!(result.content, content);

        let _ = std::fs::remove_dir_all(path.parent().unwrap().parent().unwrap());
    }

    #[test]
    fn rejects_client_log_reads_outside_poe2_client_txt() {
        let error = read_client_log_append_from_path(
            r"C:\Users\Pio\Documents\secret\Client.txt".to_string(),
            0,
        )
        .unwrap_err();

        assert_eq!(
            error,
            "Client.txt read path must be the PoE2 Client.txt file"
        );
    }

    #[test]
    fn captures_user_initiated_clipboard_text() {
        let capture = capture_clipboard_text_from_reader(
            "clipboard-001".to_string(),
            "2026-06-21T18:45:00.000Z".to_string(),
            true,
            || Ok("Item Class: Wands\nRarity: Magic\nStorm Wand\n".to_string()),
        )
        .unwrap();

        assert_eq!(capture.action_id, "clipboard-001");
        assert_eq!(capture.captured_at, "2026-06-21T18:45:00.000Z");
        assert_eq!(
            capture.text,
            "Item Class: Wands\nRarity: Magic\nStorm Wand\n"
        );
    }

    #[test]
    fn rejects_background_clipboard_text_capture() {
        let error = capture_clipboard_text_from_reader(
            "background-clipboard".to_string(),
            "2026-06-21T18:45:00.000Z".to_string(),
            false,
            || Ok("Item Class: Wands\nRarity: Magic\nStorm Wand\n".to_string()),
        )
        .unwrap_err();

        assert_eq!(
            error,
            "Clipboard text capture must be initiated by a user action"
        );
    }

    #[test]
    fn rejects_empty_clipboard_text_capture() {
        let error = capture_clipboard_text_from_reader(
            "clipboard-002".to_string(),
            "2026-06-21T18:45:00.000Z".to_string(),
            true,
            || Ok("   ".to_string()),
        )
        .unwrap_err();

        assert_eq!(error, "Clipboard text is empty");
    }

    #[test]
    fn plans_user_initiated_local_config_backup() {
        let game_directory = PathBuf::from(r"C:\Users\Pio\Documents\My Games\Path of Exile 2");
        let plan = plan_local_config_backup(
            path_to_string(game_directory.clone()),
            r"D:\Calandra Backups".to_string(),
            "backup-001".to_string(),
            "2026-06-21T15:00:00.000Z".to_string(),
            true,
            vec![
                LocalBackupFileRequest {
                    kind: "loot-filter".to_string(),
                    source_path: path_to_string(game_directory.join("NeverSink.filter")),
                },
                LocalBackupFileRequest {
                    kind: "build-file".to_string(),
                    source_path: path_to_string(
                        game_directory.join("BuildPlanner").join("Storm Monk.build"),
                    ),
                },
            ],
        )
        .unwrap();

        assert_eq!(plan.action_id, "backup-001");
        assert_eq!(plan.captured_at, "2026-06-21T15:00:00.000Z");
        assert!(plan
            .backup_root
            .ends_with(r"Path of Exile 2\2026-06-21T15-00-00-000Z"));
        assert!(plan.entries[0]
            .destination_path
            .ends_with(r"2026-06-21T15-00-00-000Z\NeverSink.filter"));
        assert!(plan.entries[1]
            .destination_path
            .ends_with(r"2026-06-21T15-00-00-000Z\BuildPlanner\Storm Monk.build"));
    }

    #[test]
    fn rejects_background_local_config_backup() {
        let error = plan_local_config_backup(
            r"C:\Users\Pio\Documents\My Games\Path of Exile 2".to_string(),
            r"D:\Calandra Backups".to_string(),
            "background-backup".to_string(),
            "2026-06-21T15:00:00.000Z".to_string(),
            false,
            vec![LocalBackupFileRequest {
                kind: "loot-filter".to_string(),
                source_path: r"C:\Users\Pio\Documents\My Games\Path of Exile 2\NeverSink.filter"
                    .to_string(),
            }],
        )
        .unwrap_err();

        assert_eq!(error, "Local backup must be initiated by a user action");
    }

    #[test]
    fn rejects_local_config_backup_sources_outside_poe2_directory() {
        let error = plan_local_config_backup(
            r"C:\Users\Pio\Documents\My Games\Path of Exile 2".to_string(),
            r"D:\Calandra Backups".to_string(),
            "backup-002".to_string(),
            "2026-06-21T15:00:00.000Z".to_string(),
            true,
            vec![LocalBackupFileRequest {
                kind: "overlay-config".to_string(),
                source_path: r"C:\Users\Pio\Documents\secret.txt".to_string(),
            }],
        )
        .unwrap_err();

        assert_eq!(
            error,
            "Local backup source path must stay inside the PoE2 directory"
        );
    }

    #[test]
    fn copies_local_config_backup_files() {
        let root = unique_settings_path("local-backup")
            .parent()
            .unwrap()
            .to_path_buf();
        let game_directory = root.join("Path of Exile 2");
        let backup_directory = root.join("Calandra Backups");
        let filter_path = game_directory.join("NeverSink.filter");
        let build_path = game_directory.join("BuildPlanner").join("Storm Monk.build");

        std::fs::create_dir_all(filter_path.parent().unwrap()).unwrap();
        std::fs::create_dir_all(build_path.parent().unwrap()).unwrap();
        std::fs::write(&filter_path, "filter").unwrap();
        std::fs::write(&build_path, "[build]\n").unwrap();

        let plan = copy_local_config_backup_to_path(
            path_to_string(game_directory.clone()),
            path_to_string(backup_directory.clone()),
            "backup-003".to_string(),
            "2026-06-21T15:00:00.000Z".to_string(),
            true,
            vec![
                LocalBackupFileRequest {
                    kind: "loot-filter".to_string(),
                    source_path: path_to_string(filter_path),
                },
                LocalBackupFileRequest {
                    kind: "build-file".to_string(),
                    source_path: path_to_string(build_path),
                },
            ],
        )
        .unwrap();

        assert_eq!(
            std::fs::read_to_string(PathBuf::from(&plan.entries[0].destination_path)).unwrap(),
            "filter"
        );
        assert_eq!(
            std::fs::read_to_string(PathBuf::from(&plan.entries[1].destination_path)).unwrap(),
            "[build]\n"
        );

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn discovers_supported_local_config_backup_files() {
        let root = unique_settings_path("local-backup-discovery")
            .parent()
            .unwrap()
            .to_path_buf();
        let game_directory = root.join("Path of Exile 2");
        let filter_path = game_directory.join("NeverSink.filter");
        let build_path = game_directory.join("BuildPlanner").join("Storm Monk.build");
        let overlay_path = game_directory.join("Calandra").join("overlay.json");
        let ignored_log_path = game_directory.join("Client.txt");
        let ignored_nested_filter_path = game_directory.join("Filters").join("nested.filter");

        std::fs::create_dir_all(filter_path.parent().unwrap()).unwrap();
        std::fs::create_dir_all(build_path.parent().unwrap()).unwrap();
        std::fs::create_dir_all(overlay_path.parent().unwrap()).unwrap();
        std::fs::create_dir_all(ignored_nested_filter_path.parent().unwrap()).unwrap();
        std::fs::write(&filter_path, "filter").unwrap();
        std::fs::write(&build_path, "[build]\n").unwrap();
        std::fs::write(&overlay_path, "{\"opacity\":0.8}\n").unwrap();
        std::fs::write(&ignored_log_path, "log").unwrap();
        std::fs::write(&ignored_nested_filter_path, "nested").unwrap();

        let files =
            discover_local_config_backup_files_from_path(path_to_string(game_directory)).unwrap();

        assert_eq!(
            files,
            vec![
                LocalBackupFileRequest {
                    kind: "loot-filter".to_string(),
                    source_path: path_to_string(filter_path),
                },
                LocalBackupFileRequest {
                    kind: "build-file".to_string(),
                    source_path: path_to_string(build_path),
                },
                LocalBackupFileRequest {
                    kind: "overlay-config".to_string(),
                    source_path: path_to_string(overlay_path),
                },
            ]
        );

        let _ = std::fs::remove_dir_all(root);
    }

    fn unique_settings_path(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();

        std::env::temp_dir()
            .join(format!("calandra-{name}-{}-{nanos}", std::process::id()))
            .join("settings.json")
    }
}
