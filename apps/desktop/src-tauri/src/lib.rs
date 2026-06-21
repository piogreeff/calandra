use std::path::{Path, PathBuf};
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

fn path_to_string(path: PathBuf) -> String {
    path.to_string_lossy().into_owned()
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
