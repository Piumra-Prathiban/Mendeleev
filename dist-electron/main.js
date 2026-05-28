"use strict";
const electron = require("electron");
const electronUpdater = require("electron-updater");
const path = require("node:path");
const node_url = require("node:url");
const fs = require("node:fs");
const Database = require("better-sqlite3");
const node_crypto = require("node:crypto");
const BACKUP_VERSION = 1;
const AUTO_BACKUP_LIMIT = 14;
const pad = (value) => String(value).padStart(2, "0");
function timestamp(date = /* @__PURE__ */ new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}
function dateStamp(date = /* @__PURE__ */ new Date()) {
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-");
}
function ensureJsonPath(filePath) {
  return filePath.toLowerCase().endsWith(".json") ? filePath : `${filePath}.json`;
}
function writeBackup(filePath, notes) {
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const payload = {
    app: "Mendeleev",
    version: BACKUP_VERSION,
    createdAt,
    notes
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), "utf8");
  fs.renameSync(tempPath, filePath);
  return { path: filePath, noteCount: notes.length, createdAt };
}
function backupSummary(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.notes) || typeof parsed.createdAt !== "string") return null;
    return { path: filePath, noteCount: parsed.notes.length, createdAt: parsed.createdAt };
  } catch {
    return null;
  }
}
function listBackupFiles(backupDir) {
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir).filter((name) => name.endsWith(".json")).map((name) => path.join(backupDir, name)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}
function pruneAutomaticBackups(backupDir) {
  const files = listBackupFiles(backupDir).filter(
    (filePath) => path.basename(filePath).startsWith("mendeleev-auto-")
  );
  for (const filePath of files.slice(AUTO_BACKUP_LIMIT)) {
    fs.unlinkSync(filePath);
  }
}
function validateNote(value) {
  if (!value || typeof value !== "object") throw new Error("Backup contains an invalid note.");
  const note = value;
  if (typeof note.id !== "string" || typeof note.title !== "string" || typeof note.content !== "string" || typeof note.created_at !== "number" || typeof note.updated_at !== "number") {
    throw new Error("Backup contains an invalid note.");
  }
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    created_at: note.created_at,
    updated_at: note.updated_at
  };
}
function createManualBackup(filePath, notes) {
  return writeBackup(ensureJsonPath(filePath), notes);
}
function createAutomaticBackup(backupDir, notes) {
  const filePath = path.join(backupDir, `mendeleev-auto-${dateStamp()}.json`);
  if (fs.existsSync(filePath)) return backupSummary(filePath);
  const result = writeBackup(filePath, notes);
  pruneAutomaticBackups(backupDir);
  return result;
}
function createSafetyBackup(backupDir, notes) {
  return writeBackup(path.join(backupDir, `mendeleev-before-restore-${timestamp()}.json`), notes);
}
function readBackup(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (parsed.app !== "Mendeleev" || parsed.version !== BACKUP_VERSION) {
    throw new Error("This is not a supported Mendeleev backup file.");
  }
  if (!Array.isArray(parsed.notes)) throw new Error("Backup file does not contain notes.");
  return parsed.notes.map(validateNote);
}
function getBackupInfo(backupDir) {
  const latestBackup = listBackupFiles(backupDir).map(backupSummary).find((summary) => summary !== null) ?? null;
  return { backupDir, latestBackup };
}
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
function replaceNotes(notes) {
  const replace = db.transaction((nextNotes) => {
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
  const userDataPath = electron.app.getPath("userData");
  const dbPath = path.join(userDataPath, "mendeleev.db");
  const backupDir = path.join(userDataPath, "backups");
  openDb(dbPath);
  createAutomaticBackup(backupDir, listNotes());
  electron.ipcMain.handle("notes:list", () => listNotes());
  electron.ipcMain.handle("notes:get", (_e, id) => getNote(id));
  electron.ipcMain.handle("notes:create", () => createNote());
  electron.ipcMain.handle("notes:update", (_e, id, content) => updateNote(id, content));
  electron.ipcMain.handle("notes:delete", (_e, id) => deleteNote(id));
  electron.ipcMain.handle("notes:search", (_e, query) => searchNotes(query));
  electron.ipcMain.handle("backups:info", () => getBackupInfo(backupDir));
  electron.ipcMain.handle("backups:export", async () => {
    const result = await electron.dialog.showSaveDialog(win ?? void 0, {
      title: "Export Notes Backup",
      defaultPath: `mendeleev-backup-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`,
      filters: [{ name: "Mendeleev Backup", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePath) return null;
    return createManualBackup(result.filePath, listNotes());
  });
  electron.ipcMain.handle("backups:restore", async () => {
    const result = await electron.dialog.showOpenDialog(win ?? void 0, {
      title: "Restore Notes Backup",
      properties: ["openFile"],
      filters: [{ name: "Mendeleev Backup", extensions: ["json"] }]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const notes = readBackup(result.filePaths[0]);
    createSafetyBackup(backupDir, listNotes());
    replaceNotes(notes);
    return { path: result.filePaths[0], noteCount: notes.length, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
  });
  createWindow();
  if (!process.env.ELECTRON_RENDERER_URL) {
    electronUpdater.autoUpdater.checkForUpdatesAndNotify();
    electronUpdater.autoUpdater.on("update-downloaded", () => {
      electron.dialog.showMessageBox({
        type: "info",
        title: "Update ready",
        message: "A new version of Mendeleev has been downloaded. Restart now to install it?",
        buttons: ["Restart", "Later"],
        defaultId: 0
      }).then(({ response }) => {
        if (response === 0) electronUpdater.autoUpdater.quitAndInstall();
      });
    });
  }
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
