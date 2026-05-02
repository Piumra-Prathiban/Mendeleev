use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub created_at: i64,
    pub updated_at: i64,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn derive_title(content: &str) -> String {
    content
        .lines()
        .next()
        .unwrap_or("")
        .trim()
        .chars()
        .take(120)
        .collect()
}

fn row_to_note(row: &rusqlite::Row) -> rusqlite::Result<Note> {
    Ok(Note {
        id: row.get(0)?,
        title: row.get(1)?,
        content: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

pub fn list(conn: &Connection) -> rusqlite::Result<Vec<Note>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, content, created_at, updated_at
         FROM notes ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map([], row_to_note)?;
    rows.collect()
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<Note>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, content, created_at, updated_at
         FROM notes WHERE id = ?1",
    )?;
    let mut rows = stmt.query(params![id])?;
    match rows.next()? {
        Some(row) => Ok(Some(row_to_note(row)?)),
        None => Ok(None),
    }
}

pub fn create(conn: &Connection) -> rusqlite::Result<Note> {
    let now = now_ms();
    let note = Note {
        id: Uuid::new_v4().to_string(),
        title: String::new(),
        content: String::new(),
        created_at: now,
        updated_at: now,
    };
    conn.execute(
        "INSERT INTO notes (id, title, content, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![note.id, note.title, note.content, note.created_at, note.updated_at],
    )?;
    Ok(note)
}

pub fn update(conn: &Connection, id: &str, content: &str) -> rusqlite::Result<Note> {
    let title = derive_title(content);
    let updated_at = now_ms();
    conn.execute(
        "UPDATE notes SET title = ?1, content = ?2, updated_at = ?3 WHERE id = ?4",
        params![title, content, updated_at, id],
    )?;
    get(conn, id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn search(conn: &Connection, query: &str) -> rusqlite::Result<Vec<Note>> {
    let pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT id, title, content, created_at, updated_at
         FROM notes
         WHERE title LIKE ?1 OR content LIKE ?1
         ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map(params![pattern], row_to_note)?;
    rows.collect()
}
