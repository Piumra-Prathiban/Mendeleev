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
electron.contextBridge.exposeInMainWorld("notes", api);
