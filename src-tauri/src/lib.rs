mod db;
mod notes;

use notes::Note;
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

struct DbState(Mutex<Connection>);

fn map_err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

#[tauri::command]
fn list_notes(state: tauri::State<DbState>) -> Result<Vec<Note>, String> {
    let conn = state.0.lock().map_err(map_err)?;
    notes::list(&conn).map_err(map_err)
}

#[tauri::command]
fn get_note(state: tauri::State<DbState>, id: String) -> Result<Option<Note>, String> {
    let conn = state.0.lock().map_err(map_err)?;
    notes::get(&conn, &id).map_err(map_err)
}

#[tauri::command]
fn create_note(state: tauri::State<DbState>) -> Result<Note, String> {
    let conn = state.0.lock().map_err(map_err)?;
    notes::create(&conn).map_err(map_err)
}

#[tauri::command]
fn update_note(
    state: tauri::State<DbState>,
    id: String,
    content: String,
) -> Result<Note, String> {
    let conn = state.0.lock().map_err(map_err)?;
    notes::update(&conn, &id, &content).map_err(map_err)
}

#[tauri::command]
fn delete_note(state: tauri::State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(map_err)?;
    notes::delete(&conn, &id).map_err(map_err)
}

#[tauri::command]
fn search_notes(state: tauri::State<DbState>, query: String) -> Result<Vec<Note>, String> {
    let conn = state.0.lock().map_err(map_err)?;
    notes::search(&conn, &query).map_err(map_err)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            let db_path = dir.join("mendeleev.db");
            let conn = db::open(&db_path)?;
            app.manage(DbState(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_notes,
            get_note,
            create_note,
            update_note,
            delete_note,
            search_notes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
