"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// electron/preload.ts
var preload_exports = {};
module.exports = __toCommonJS(preload_exports);
var import_electron = require("electron");
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);
function readAppVersion() {
  try {
    const packageJsonPath = import_node_path.default.join(__dirname, "../../package.json");
    const raw = import_node_fs.default.readFileSync(packageJsonPath, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed.version ?? "0.1.0";
  } catch {
    return "0.1.0";
  }
}
var windowControls = {
  minimize: () => import_electron.ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => import_electron.ipcRenderer.invoke("window:toggle-maximize"),
  close: () => import_electron.ipcRenderer.invoke("window:close"),
  isMaximized: () => import_electron.ipcRenderer.invoke("window:is-maximized"),
  onMaximizedChange: (callback) => {
    const listener = (_event, isMaximized) => callback(isMaximized);
    import_electron.ipcRenderer.on("window:maximized-change", listener);
    return () => {
      import_electron.ipcRenderer.removeListener("window:maximized-change", listener);
    };
  }
};
var appInfo = {
  name: "PromptHound",
  version: readAppVersion()
};
var extraction = {
  fromFilePath: (filePath) => import_electron.ipcRenderer.invoke("extraction:from-file-path", filePath),
  fromClipboard: () => import_electron.ipcRenderer.invoke("extraction:from-clipboard"),
  fromUrl: (url) => import_electron.ipcRenderer.invoke("extraction:from-url", url),
  getPathForFile: (file) => {
    try {
      return import_electron.webUtils.getPathForFile(file);
    } catch {
      return file.path || "";
    }
  },
  openFileDialog: () => import_electron.ipcRenderer.invoke("dialog:open-image-file")
};
var loraDb = {
  getByHash: (hash) => import_electron.ipcRenderer.invoke("lora-db:get-by-hash", hash),
  getByAlias: (alias) => import_electron.ipcRenderer.invoke("lora-db:get-by-alias", alias),
  upsert: (record) => import_electron.ipcRenderer.invoke("lora-db:upsert", record),
  remove: (hashOrAlias) => import_electron.ipcRenderer.invoke("lora-db:remove", hashOrAlias),
  clearUserCache: () => import_electron.ipcRenderer.invoke("lora-db:clear-user-records"),
  getStats: () => import_electron.ipcRenderer.invoke("lora-db:get-stats")
};
var settings = {
  saveCivitaiKey: (key) => import_electron.ipcRenderer.invoke("settings:save-civitai-key", key),
  getCivitaiKey: () => import_electron.ipcRenderer.invoke("settings:get-civitai-key")
};
var promptHoundApi = {
  windowControls,
  appInfo,
  extraction,
  loraDb,
  settings,
  openExternal: (url) => import_electron.ipcRenderer.send("shell:openExternal", url)
};
import_electron.contextBridge.exposeInMainWorld("promptHound", promptHoundApi);
