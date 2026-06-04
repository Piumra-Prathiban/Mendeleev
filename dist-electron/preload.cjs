"use strict";
const electron = require("electron");
const api = {
  list: () => electron.ipcRenderer.invoke("notes:list"),
  get: (id) => electron.ipcRenderer.invoke("notes:get", id),
  create: () => electron.ipcRenderer.invoke("notes:create"),
  update: (id, content) => electron.ipcRenderer.invoke("notes:update", id, content),
  remove: (id) => electron.ipcRenderer.invoke("notes:delete", id),
  search: (query) => electron.ipcRenderer.invoke("notes:search", query),
  trashList: () => electron.ipcRenderer.invoke("notes:trash-list"),
  restore: (id) => electron.ipcRenderer.invoke("notes:restore", id),
  permanentDelete: (id) => electron.ipcRenderer.invoke("notes:permanent-delete", id),
  emptyTrash: () => electron.ipcRenderer.invoke("notes:empty-trash"),
  exportTxt: (title, content) => electron.ipcRenderer.invoke("notes:export-txt", title, content)
};
const backups = {
  info: () => electron.ipcRenderer.invoke("backups:info"),
  export: () => electron.ipcRenderer.invoke("backups:export"),
  restore: () => electron.ipcRenderer.invoke("backups:restore")
};
electron.contextBridge.exposeInMainWorld("notes", api);
electron.contextBridge.exposeInMainWorld("backups", backups);
