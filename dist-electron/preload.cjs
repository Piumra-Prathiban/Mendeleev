"use strict";
const electron = require("electron");
const api = {
  list: () => electron.ipcRenderer.invoke("notes:list"),
  get: (id) => electron.ipcRenderer.invoke("notes:get", id),
  create: () => electron.ipcRenderer.invoke("notes:create"),
  update: (id, content) => electron.ipcRenderer.invoke("notes:update", id, content),
  remove: (id) => electron.ipcRenderer.invoke("notes:delete", id),
  search: (query) => electron.ipcRenderer.invoke("notes:search", query)
};
const backups = {
  info: () => electron.ipcRenderer.invoke("backups:info"),
  export: () => electron.ipcRenderer.invoke("backups:export"),
  restore: () => electron.ipcRenderer.invoke("backups:restore")
};
electron.contextBridge.exposeInMainWorld("notes", api);
electron.contextBridge.exposeInMainWorld("backups", backups);
