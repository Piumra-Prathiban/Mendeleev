import { app, BrowserWindow, dialog, ipcMain } from "electron";
import fs from "node:fs";
import { autoUpdater } from "electron-updater";
import path from "node:path";
import {
  createAutomaticBackup,
  createManualBackup,
  createSafetyBackup,
  getBackupInfo,
  readBackup,
} from "./backup";
import {
  openDb,
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  replaceNotes,
  searchNotes,
  listTrashedNotes,
  restoreNote,
  permanentDeleteNote,
  emptyTrash,
} from "./db";
import { loadWindowBounds, trackWindowBounds } from "./window-state";

let win: BrowserWindow | null = null;

function createWindow() {
  const bounds = loadWindowBounds();
  win = new BrowserWindow({
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
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  trackWindowBounds(win);

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../dist/renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  const userDataPath = app.getPath("userData");
  const dbPath = path.join(userDataPath, "mendeleev.db");
  const backupDir = path.join(userDataPath, "backups");
  await openDb(dbPath);
  createAutomaticBackup(backupDir, listNotes());

  ipcMain.handle("notes:list", () => listNotes());
  ipcMain.handle("notes:get", (_e, id: string) => getNote(id));
  ipcMain.handle("notes:create", () => createNote());
  ipcMain.handle("notes:update", (_e, id: string, content: string) => updateNote(id, content));
  ipcMain.handle("notes:delete", (_e, id: string) => deleteNote(id));
  ipcMain.handle("notes:search", (_e, query: string) => searchNotes(query));
  ipcMain.handle("notes:trash-list", () => listTrashedNotes());
  ipcMain.handle("notes:restore", (_e, id: string) => restoreNote(id));
  ipcMain.handle("notes:permanent-delete", (_e, id: string) => permanentDeleteNote(id));
  ipcMain.handle("notes:empty-trash", () => emptyTrash());
  ipcMain.handle("notes:export-txt", async (_e, title: string, content: string) => {
    const safeName = (title.trim() || "Untitled").replace(/[/\\:*?"<>|]/g, "-");
    const result = await dialog.showSaveDialog(win ?? undefined, {
      title: "Export Note as Text",
      defaultPath: `${safeName}.txt`,
      filters: [{ name: "Plain Text", extensions: ["txt"] }],
    });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, content, "utf-8");
    return result.filePath;
  });
  ipcMain.handle("backups:info", () => getBackupInfo(backupDir));
  ipcMain.handle("backups:export", async () => {
    const result = await dialog.showSaveDialog(win ?? undefined, {
      title: "Export Notes Backup",
      defaultPath: `mendeleev-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "Mendeleev Backup", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return null;
    return createManualBackup(result.filePath, listNotes());
  });
  ipcMain.handle("backups:restore", async () => {
    const result = await dialog.showOpenDialog(win ?? undefined, {
      title: "Restore Notes Backup",
      properties: ["openFile"],
      filters: [{ name: "Mendeleev Backup", extensions: ["json"] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const notes = readBackup(result.filePaths[0]);
    createSafetyBackup(backupDir, listNotes());
    replaceNotes(notes);
    return { path: result.filePaths[0], noteCount: notes.length, createdAt: new Date().toISOString() };
  });

  createWindow();

  // Check for updates in production (silently downloads, prompts before install)
  if (!process.env.ELECTRON_RENDERER_URL) {
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on("update-downloaded", () => {
      dialog
        .showMessageBox({
          type: "info",
          title: "Update ready",
          message: "A new version of Mendeleev has been downloaded. Restart now to install it?",
          buttons: ["Restart", "Later"],
          defaultId: 0,
        })
        .then(({ response }) => {
          if (response === 0) autoUpdater.quitAndInstall();
        });
    });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
