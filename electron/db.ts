import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Note } from "../src/types";

let db: Database.Database;

export function openDb(dbPath: string) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      content    TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
  `);
  try {
    db.exec("ALTER TABLE notes ADD COLUMN deleted_at INTEGER");
  } catch {}
}

export function closeDb() {
  db.close();
}

const deriveTitle = (content: string) =>
  (content.split("\n", 1)[0] ?? "").trim().slice(0, 120);

export function listNotes(): Note[] {
  return db
    .prepare("SELECT id, title, content, created_at, updated_at FROM notes WHERE deleted_at IS NULL ORDER BY updated_at DESC")
    .all() as Note[];
}

export function getNote(id: string): Note | null {
  return (db
    .prepare("SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ? AND deleted_at IS NULL")
    .get(id) as Note | undefined) ?? null;
}

export function createNote(): Note {
  const now = Date.now();
  const note: Note = {
    id: randomUUID(),
    title: "",
    content: "",
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    "INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).run(note.id, note.title, note.content, note.created_at, note.updated_at);
  return note;
}

export function updateNote(id: string, content: string): Note {
  const title = deriveTitle(content);
  const updated_at = Date.now();
  db.prepare("UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?").run(
    title,
    content,
    updated_at,
    id
  );
  const note = getNote(id);
  if (!note) throw new Error(`Note ${id} not found after update`);
  return note;
}

export function deleteNote(id: string): void {
  db.prepare("UPDATE notes SET deleted_at = ? WHERE id = ?").run(Date.now(), id);
}

export function listTrashedNotes(): (Note & { deleted_at: number })[] {
  return db
    .prepare("SELECT id, title, content, created_at, updated_at, deleted_at FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC")
    .all() as (Note & { deleted_at: number })[];
}

export function restoreNote(id: string): void {
  db.prepare("UPDATE notes SET deleted_at = NULL WHERE id = ?").run(id);
}

export function permanentDeleteNote(id: string): void {
  db.prepare("DELETE FROM notes WHERE id = ?").run(id);
}

export function emptyTrash(): void {
  db.prepare("DELETE FROM notes WHERE deleted_at IS NOT NULL").run();
}

export function replaceNotes(notes: Note[]): void {
  const replace = db.transaction((nextNotes: Note[]) => {
    db.prepare("DELETE FROM notes").run();
    const insert = db.prepare(
      "INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    );
    for (const note of nextNotes) {
      insert.run(note.id, note.title, note.content, note.created_at, note.updated_at);
    }
  });
  replace(notes);
}

export function searchNotes(query: string): Note[] {
  const pattern = `%${query}%`;
  return db
    .prepare(
      `SELECT id, title, content, created_at, updated_at FROM notes
       WHERE deleted_at IS NULL AND (title LIKE ? OR content LIKE ?)
       ORDER BY updated_at DESC`
    )
    .all(pattern, pattern) as Note[];
}
