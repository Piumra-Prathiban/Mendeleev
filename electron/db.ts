import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Note } from "../src/types";

let db: SqlJsDatabase;
let dbPath: string;

export async function openDb(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  dbPath = filePath;
  const SQL = await initSqlJs();

  if (fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run("PRAGMA journal_mode = WAL");
  db.run(`CREATE TABLE IF NOT EXISTS notes (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  db.run("CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC)");
  try {
    db.run("ALTER TABLE notes ADD COLUMN deleted_at INTEGER");
  } catch {
    /* column already exists */
  }
  persist();
}

function persist() {
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

const deriveTitle = (content: string) =>
  (content.split("\n", 1)[0] ?? "").trim().slice(0, 120);

function selectAll<T>(sql: string, params?: unknown[]): T[] {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as T);
  stmt.free();
  return rows;
}

function selectOne<T>(sql: string, params?: unknown[]): T | null {
  const rows = selectAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function run(sql: string, params?: unknown[]) {
  if (params) {
    db.run(sql, params);
  } else {
    db.run(sql);
  }
  persist();
}

export function closeDb() {
  db.close();
}

export function listNotes(): Note[] {
  return selectAll<Note>(
    "SELECT id, title, content, created_at, updated_at FROM notes WHERE deleted_at IS NULL ORDER BY updated_at DESC",
  );
}

export function getNote(id: string): Note | null {
  return selectOne<Note>(
    "SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ? AND deleted_at IS NULL",
    [id],
  );
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
  run(
    "INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    [note.id, note.title, note.content, note.created_at, note.updated_at],
  );
  return note;
}

export function updateNote(id: string, content: string): Note {
  const title = deriveTitle(content);
  const updated_at = Date.now();
  run("UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?", [
    title,
    content,
    updated_at,
    id,
  ]);
  const note = getNote(id);
  if (!note) throw new Error(`Note ${id} not found after update`);
  return note;
}

export function deleteNote(id: string): void {
  run("UPDATE notes SET deleted_at = ? WHERE id = ?", [Date.now(), id]);
}

export function listTrashedNotes(): (Note & { deleted_at: number })[] {
  return selectAll<(Note & { deleted_at: number })>(
    "SELECT id, title, content, created_at, updated_at, deleted_at FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC",
  );
}

export function restoreNote(id: string): void {
  run("UPDATE notes SET deleted_at = NULL WHERE id = ?", [id]);
}

export function permanentDeleteNote(id: string): void {
  run("DELETE FROM notes WHERE id = ?", [id]);
}

export function emptyTrash(): void {
  run("DELETE FROM notes WHERE deleted_at IS NOT NULL");
}

export function replaceNotes(notes: Note[]): void {
  db.run("BEGIN TRANSACTION");
  try {
    db.run("DELETE FROM notes");
    const stmt = db.prepare(
      "INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    );
    for (const n of notes) {
      stmt.run([n.id, n.title, n.content, n.created_at, n.updated_at]);
    }
    stmt.free();
    db.run("COMMIT");
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
  persist();
}

export function searchNotes(query: string): Note[] {
  const pattern = `%${query}%`;
  return selectAll<Note>(
    `SELECT id, title, content, created_at, updated_at FROM notes
     WHERE deleted_at IS NULL AND (title LIKE ? OR content LIKE ?)
     ORDER BY updated_at DESC`,
    [pattern, pattern],
  );
}
