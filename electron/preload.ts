import { contextBridge, ipcRenderer } from "electron";
import type { BackupInfo, BackupResult, Note, TrashedNote } from "../src/types";

const api = {
  list: (): Promise<Note[]> => ipcRenderer.invoke("notes:list"),
  get: (id: string): Promise<Note | null> => ipcRenderer.invoke("notes:get", id),
  create: (): Promise<Note> => ipcRenderer.invoke("notes:create"),
  update: (id: string, content: string): Promise<Note> =>
    ipcRenderer.invoke("notes:update", id, content),
  remove: (id: string): Promise<void> => ipcRenderer.invoke("notes:delete", id),
  search: (query: string): Promise<Note[]> => ipcRenderer.invoke("notes:search", query),
  trashList: (): Promise<TrashedNote[]> => ipcRenderer.invoke("notes:trash-list"),
  restore: (id: string): Promise<void> => ipcRenderer.invoke("notes:restore", id),
  permanentDelete: (id: string): Promise<void> => ipcRenderer.invoke("notes:permanent-delete", id),
  emptyTrash: (): Promise<void> => ipcRenderer.invoke("notes:empty-trash"),
};

const backups = {
  info: (): Promise<BackupInfo> => ipcRenderer.invoke("backups:info"),
  export: (): Promise<BackupResult | null> => ipcRenderer.invoke("backups:export"),
  restore: (): Promise<BackupResult | null> => ipcRenderer.invoke("backups:restore"),
};

contextBridge.exposeInMainWorld("notes", api);
contextBridge.exposeInMainWorld("backups", backups);

export type NotesApi = typeof api;
export type BackupsApi = typeof backups;
