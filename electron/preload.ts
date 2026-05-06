import { contextBridge, ipcRenderer } from "electron";
import type { Note } from "../src/types";

const api = {
  list: (): Promise<Note[]> => ipcRenderer.invoke("notes:list"),
  get: (id: string): Promise<Note | null> => ipcRenderer.invoke("notes:get", id),
  create: (): Promise<Note> => ipcRenderer.invoke("notes:create"),
  update: (id: string, content: string): Promise<Note> =>
    ipcRenderer.invoke("notes:update", id, content),
  remove: (id: string): Promise<void> => ipcRenderer.invoke("notes:delete", id),
  search: (query: string): Promise<Note[]> => ipcRenderer.invoke("notes:search", query),
};

contextBridge.exposeInMainWorld("notes", api);

export type NotesApi = typeof api;
