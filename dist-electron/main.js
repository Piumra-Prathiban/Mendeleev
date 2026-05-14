"use strict";
const electron = require("electron");
const path = require("node:path");
const node_url = require("node:url");
const Database = require("better-sqlite3");
const node_crypto = require("node:crypto");
const fs = require("node:fs");
let db;
function openDb(dbPath) {
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
}
const deriveTitle = (content) => (content.split("\n", 1)[0] ?? "").trim().slice(0, 120);
function listNotes() {
  return db.prepare("SELECT id, title, content, created_at, updated_at FROM notes ORDER BY updated_at DESC").all();
}
function getNote(id) {
  return db.prepare("SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ?").get(id) ?? null;
}
function createNote() {
  const now = Date.now();
  const note = {
    id: node_crypto.randomUUID(),
    title: "",
    content: "",
    created_at: now,
    updated_at: now
  };
  db.prepare(
    "INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).run(note.id, note.title, note.content, note.created_at, note.updated_at);
  return note;
}
function updateNote(id, content) {
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
function deleteNote(id) {
  db.prepare("DELETE FROM notes WHERE id = ?").run(id);
}
function searchNotes(query) {
  const pattern = `%${query}%`;
  return db.prepare(
    `SELECT id, title, content, created_at, updated_at FROM notes
       WHERE title LIKE ? OR content LIKE ?
       ORDER BY updated_at DESC`
  ).all(pattern, pattern);
}
const DEFAULTS = { width: 1100, height: 720 };
const SAVE_DEBOUNCE_MS = 250;
function isFinitePositive(n) {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}
function isOnScreen(b) {
  if (b.x === void 0 || b.y === void 0) return true;
  return electron.screen.getAllDisplays().some((d) => {
    const { x, y, width, height } = d.workArea;
    return b.x >= x && b.y >= y && b.x + b.width <= x + width && b.y + b.height <= y + height;
  });
}
function loadWindowBounds() {
  const file = path.join(electron.app.getPath("userData"), "window-state.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (!isFinitePositive(parsed.width) || !isFinitePositive(parsed.height)) return DEFAULTS;
    const bounds = {
      width: parsed.width,
      height: parsed.height,
      x: isFinitePositive(parsed.x) ? parsed.x : void 0,
      y: isFinitePositive(parsed.y) ? parsed.y : void 0
    };
    return isOnScreen(bounds) ? bounds : { width: bounds.width, height: bounds.height };
  } catch {
    return DEFAULTS;
  }
}
function trackWindowBounds(win2) {
  const file = path.join(electron.app.getPath("userData"), "window-state.json");
  let timer = null;
  const persist = () => {
    if (win2.isDestroyed() || win2.isMinimized() || win2.isFullScreen()) return;
    try {
      fs.writeFileSync(file, JSON.stringify(win2.getNormalBounds()));
    } catch {
    }
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(persist, SAVE_DEBOUNCE_MS);
  };
  win2.on("resize", schedule);
  win2.on("move", schedule);
  win2.on("close", () => {
    if (timer) clearTimeout(timer);
    persist();
  });
}
const __dirname$1 = path.dirname(node_url.fileURLToPath(require("url").pathToFileURL(__filename).href));
let win = null;
function createWindow() {
  const bounds = loadWindowBounds();
  win = new electron.BrowserWindow({
    title: "Mendeleev",
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: "#ffffff",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname$1, "preload.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  trackWindowBounds(win);
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname$1, "../dist/renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  const dbPath = path.join(electron.app.getPath("userData"), "mendeleev.db");
  openDb(dbPath);
  electron.ipcMain.handle("notes:list", () => listNotes());
  electron.ipcMain.handle("notes:get", (_e, id) => getNote(id));
  electron.ipcMain.handle("notes:create", () => createNote());
  electron.ipcMain.handle("notes:update", (_e, id, content) => updateNote(id, content));
  electron.ipcMain.handle("notes:delete", (_e, id) => deleteNote(id));
  electron.ipcMain.handle("notes:search", (_e, query) => searchNotes(query));
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
