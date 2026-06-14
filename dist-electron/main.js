//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let electron = require("electron");
let node_fs = require("node:fs");
node_fs = __toESM(node_fs);
let electron_updater = require("electron-updater");
let node_path = require("node:path");
node_path = __toESM(node_path);
let sql_js = require("sql.js");
sql_js = __toESM(sql_js);
let node_crypto = require("node:crypto");
//#region electron/backup.ts
var BACKUP_VERSION = 1;
var AUTO_BACKUP_LIMIT = 14;
var pad = (value) => String(value).padStart(2, "0");
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
	return [
		date.getFullYear(),
		pad(date.getMonth() + 1),
		pad(date.getDate())
	].join("-");
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
	node_fs.default.mkdirSync(node_path.default.dirname(filePath), { recursive: true });
	const tempPath = `${filePath}.tmp`;
	node_fs.default.writeFileSync(tempPath, JSON.stringify(payload, null, 2), "utf8");
	node_fs.default.renameSync(tempPath, filePath);
	return {
		path: filePath,
		noteCount: notes.length,
		createdAt
	};
}
function backupSummary(filePath) {
	try {
		const raw = node_fs.default.readFileSync(filePath, "utf8");
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed.notes) || typeof parsed.createdAt !== "string") return null;
		return {
			path: filePath,
			noteCount: parsed.notes.length,
			createdAt: parsed.createdAt
		};
	} catch {
		return null;
	}
}
function listBackupFiles(backupDir) {
	if (!node_fs.default.existsSync(backupDir)) return [];
	return node_fs.default.readdirSync(backupDir).filter((name) => name.endsWith(".json")).map((name) => node_path.default.join(backupDir, name)).sort((a, b) => node_fs.default.statSync(b).mtimeMs - node_fs.default.statSync(a).mtimeMs);
}
function pruneAutomaticBackups(backupDir) {
	const files = listBackupFiles(backupDir).filter((filePath) => node_path.default.basename(filePath).startsWith("mendeleev-auto-"));
	for (const filePath of files.slice(AUTO_BACKUP_LIMIT)) node_fs.default.unlinkSync(filePath);
}
function validateNote(value) {
	if (!value || typeof value !== "object") throw new Error("Backup contains an invalid note.");
	const note = value;
	if (typeof note.id !== "string" || typeof note.title !== "string" || typeof note.content !== "string" || typeof note.created_at !== "number" || typeof note.updated_at !== "number") throw new Error("Backup contains an invalid note.");
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
	const filePath = node_path.default.join(backupDir, `mendeleev-auto-${dateStamp()}.json`);
	if (node_fs.default.existsSync(filePath)) return backupSummary(filePath);
	const result = writeBackup(filePath, notes);
	pruneAutomaticBackups(backupDir);
	return result;
}
function createSafetyBackup(backupDir, notes) {
	return writeBackup(node_path.default.join(backupDir, `mendeleev-before-restore-${timestamp()}.json`), notes);
}
function readBackup(filePath) {
	const raw = node_fs.default.readFileSync(filePath, "utf8");
	const parsed = JSON.parse(raw);
	if (parsed.app !== "Mendeleev" || parsed.version !== BACKUP_VERSION) throw new Error("This is not a supported Mendeleev backup file.");
	if (!Array.isArray(parsed.notes)) throw new Error("Backup file does not contain notes.");
	return parsed.notes.map(validateNote);
}
function getBackupInfo(backupDir) {
	return {
		backupDir,
		latestBackup: listBackupFiles(backupDir).map(backupSummary).find((summary) => summary !== null) ?? null
	};
}
//#endregion
//#region electron/db.ts
var db;
var dbPath;
async function openDb(filePath) {
	node_fs.default.mkdirSync(node_path.default.dirname(filePath), { recursive: true });
	dbPath = filePath;
	const SQL = await (0, sql_js.default)();
	if (node_fs.default.existsSync(filePath)) {
		const buffer = node_fs.default.readFileSync(filePath);
		db = new SQL.Database(buffer);
	} else db = new SQL.Database();
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
	} catch {}
	persist();
}
function persist() {
	node_fs.default.writeFileSync(dbPath, Buffer.from(db.export()));
}
var deriveTitle = (content) => (content.split("\n", 1)[0] ?? "").trim().slice(0, 120);
function selectAll(sql, params) {
	const stmt = db.prepare(sql);
	if (params) stmt.bind(params);
	const rows = [];
	while (stmt.step()) rows.push(stmt.getAsObject());
	stmt.free();
	return rows;
}
function selectOne(sql, params) {
	const rows = selectAll(sql, params);
	return rows.length > 0 ? rows[0] : null;
}
function run(sql, params) {
	if (params) db.run(sql, params);
	else db.run(sql);
	persist();
}
function listNotes() {
	return selectAll("SELECT id, title, content, created_at, updated_at FROM notes WHERE deleted_at IS NULL ORDER BY updated_at DESC");
}
function getNote(id) {
	return selectOne("SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ? AND deleted_at IS NULL", [id]);
}
function createNote() {
	const now = Date.now();
	const note = {
		id: (0, node_crypto.randomUUID)(),
		title: "",
		content: "",
		created_at: now,
		updated_at: now
	};
	run("INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [
		note.id,
		note.title,
		note.content,
		note.created_at,
		note.updated_at
	]);
	return note;
}
function updateNote(id, content) {
	run("UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?", [
		deriveTitle(content),
		content,
		Date.now(),
		id
	]);
	const note = getNote(id);
	if (!note) throw new Error(`Note ${id} not found after update`);
	return note;
}
function deleteNote(id) {
	run("UPDATE notes SET deleted_at = ? WHERE id = ?", [Date.now(), id]);
}
function listTrashedNotes() {
	return selectAll("SELECT id, title, content, created_at, updated_at, deleted_at FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC");
}
function restoreNote(id) {
	run("UPDATE notes SET deleted_at = NULL WHERE id = ?", [id]);
}
function permanentDeleteNote(id) {
	run("DELETE FROM notes WHERE id = ?", [id]);
}
function emptyTrash() {
	run("DELETE FROM notes WHERE deleted_at IS NOT NULL");
}
function replaceNotes(notes) {
	db.run("BEGIN TRANSACTION");
	try {
		db.run("DELETE FROM notes");
		const stmt = db.prepare("INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)");
		for (const n of notes) stmt.run([
			n.id,
			n.title,
			n.content,
			n.created_at,
			n.updated_at
		]);
		stmt.free();
		db.run("COMMIT");
	} catch (e) {
		db.run("ROLLBACK");
		throw e;
	}
	persist();
}
function searchNotes(query) {
	const pattern = `%${query}%`;
	return selectAll(`SELECT id, title, content, created_at, updated_at FROM notes
     WHERE deleted_at IS NULL AND (title LIKE ? OR content LIKE ?)
     ORDER BY updated_at DESC`, [pattern, pattern]);
}
//#endregion
//#region electron/window-state.ts
var DEFAULTS = {
	width: 1100,
	height: 720
};
var SAVE_DEBOUNCE_MS = 250;
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
	const file = node_path.default.join(electron.app.getPath("userData"), "window-state.json");
	try {
		const parsed = JSON.parse((0, node_fs.readFileSync)(file, "utf-8"));
		if (!isFinitePositive(parsed.width) || !isFinitePositive(parsed.height)) return DEFAULTS;
		const bounds = {
			width: parsed.width,
			height: parsed.height,
			x: isFinitePositive(parsed.x) ? parsed.x : void 0,
			y: isFinitePositive(parsed.y) ? parsed.y : void 0
		};
		return isOnScreen(bounds) ? bounds : {
			width: bounds.width,
			height: bounds.height
		};
	} catch {
		return DEFAULTS;
	}
}
function trackWindowBounds(win) {
	const file = node_path.default.join(electron.app.getPath("userData"), "window-state.json");
	let timer = null;
	const persist = () => {
		if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
		try {
			(0, node_fs.writeFileSync)(file, JSON.stringify(win.getNormalBounds()));
		} catch {}
	};
	const schedule = () => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(persist, SAVE_DEBOUNCE_MS);
	};
	win.on("resize", schedule);
	win.on("move", schedule);
	win.on("close", () => {
		if (timer) clearTimeout(timer);
		persist();
	});
}
//#endregion
//#region electron/main.ts
var win = null;
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
			preload: node_path.default.join(__dirname, "preload.cjs"),
			sandbox: true,
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	trackWindowBounds(win);
	if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL);
	else win.loadFile(node_path.default.join(__dirname, "../dist/renderer/index.html"));
}
electron.app.whenReady().then(async () => {
	const userDataPath = electron.app.getPath("userData");
	const dbPath = node_path.default.join(userDataPath, "mendeleev.db");
	const backupDir = node_path.default.join(userDataPath, "backups");
	await openDb(dbPath);
	createAutomaticBackup(backupDir, listNotes());
	electron.ipcMain.handle("notes:list", () => listNotes());
	electron.ipcMain.handle("notes:get", (_e, id) => getNote(id));
	electron.ipcMain.handle("notes:create", () => createNote());
	electron.ipcMain.handle("notes:update", (_e, id, content) => updateNote(id, content));
	electron.ipcMain.handle("notes:delete", (_e, id) => deleteNote(id));
	electron.ipcMain.handle("notes:search", (_e, query) => searchNotes(query));
	electron.ipcMain.handle("notes:trash-list", () => listTrashedNotes());
	electron.ipcMain.handle("notes:restore", (_e, id) => restoreNote(id));
	electron.ipcMain.handle("notes:permanent-delete", (_e, id) => permanentDeleteNote(id));
	electron.ipcMain.handle("notes:empty-trash", () => emptyTrash());
	electron.ipcMain.handle("notes:export-txt", async (_e, title, content) => {
		const safeName = (title.trim() || "Untitled").replace(/[/\\:*?"<>|]/g, "-");
		const result = await electron.dialog.showSaveDialog(win ?? void 0, {
			title: "Export Note as Text",
			defaultPath: `${safeName}.txt`,
			filters: [{
				name: "Plain Text",
				extensions: ["txt"]
			}]
		});
		if (result.canceled || !result.filePath) return null;
		node_fs.default.writeFileSync(result.filePath, content, "utf-8");
		return result.filePath;
	});
	electron.ipcMain.handle("backups:info", () => getBackupInfo(backupDir));
	electron.ipcMain.handle("backups:export", async () => {
		const result = await electron.dialog.showSaveDialog(win ?? void 0, {
			title: "Export Notes Backup",
			defaultPath: `mendeleev-backup-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`,
			filters: [{
				name: "Mendeleev Backup",
				extensions: ["json"]
			}]
		});
		if (result.canceled || !result.filePath) return null;
		return createManualBackup(result.filePath, listNotes());
	});
	electron.ipcMain.handle("backups:restore", async () => {
		const result = await electron.dialog.showOpenDialog(win ?? void 0, {
			title: "Restore Notes Backup",
			properties: ["openFile"],
			filters: [{
				name: "Mendeleev Backup",
				extensions: ["json"]
			}]
		});
		if (result.canceled || result.filePaths.length === 0) return null;
		const notes = readBackup(result.filePaths[0]);
		createSafetyBackup(backupDir, listNotes());
		replaceNotes(notes);
		return {
			path: result.filePaths[0],
			noteCount: notes.length,
			createdAt: (/* @__PURE__ */ new Date()).toISOString()
		};
	});
	createWindow();
	if (!process.env.ELECTRON_RENDERER_URL) {
		electron_updater.autoUpdater.checkForUpdatesAndNotify();
		electron_updater.autoUpdater.on("update-downloaded", () => {
			electron.dialog.showMessageBox({
				type: "info",
				title: "Update ready",
				message: "A new version of Mendeleev has been downloaded. Restart now to install it?",
				buttons: ["Restart", "Later"],
				defaultId: 0
			}).then(({ response }) => {
				if (response === 0) electron_updater.autoUpdater.quitAndInstall();
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
//#endregion
