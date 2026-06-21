use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Poe2Paths {
    pub game_directory: String,
    pub client_log_path: String,
    pub build_planner_directory: String,
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
            set_theme_preference
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
