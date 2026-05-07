import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, listNotes, getNote, createNote, updateNote, deleteNote, searchNotes } from "./db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    title: "Mendeleev",
    width: 1100,
    height: 720,
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

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../dist/renderer/index.html"));
  }
}

app.whenReady().then(() => {
  const dbPath = path.join(app.getPath("userData"), "mendeleev.db");
  openDb(dbPath);

  ipcMain.handle("notes:list", () => listNotes());
  ipcMain.handle("notes:get", (_e, id: string) => getNote(id));
  ipcMain.handle("notes:create", () => createNote());
  ipcMain.handle("notes:update", (_e, id: string, content: string) => updateNote(id, content));
  ipcMain.handle("notes:delete", (_e, id: string) => deleteNote(id));
  ipcMain.handle("notes:search", (_e, query: string) => searchNotes(query));

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
