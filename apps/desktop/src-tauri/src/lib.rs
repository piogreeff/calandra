use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Poe2Paths {
    pub game_directory: String,
    pub client_log_path: String,
    pub build_planner_directory: String,
}

#[tauri::command]
fn get_default_poe2_paths() -> Result<Poe2Paths, String> {
    let home_directory = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .ok_or_else(|| "Unable to resolve the user home directory".to_string())?;

    Ok(resolve_default_poe2_paths(PathBuf::from(home_directory)))
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
        .invoke_handler(tauri::generate_handler![get_default_poe2_paths])
        .run(tauri::generate_context!())
        .expect("error while running Calandra desktop shell");
}

fn path_to_string(path: PathBuf) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

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
}
