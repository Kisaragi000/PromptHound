"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
function readAppVersion() {
    try {
        const packageJsonPath = node_path_1.default.join(__dirname, '../../package.json');
        const raw = node_fs_1.default.readFileSync(packageJsonPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return parsed.version ?? '0.1.0';
    }
    catch {
        return '0.1.0';
    }
}
const windowControls = {
    minimize: () => electron_1.ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => electron_1.ipcRenderer.invoke('window:toggle-maximize'),
    close: () => electron_1.ipcRenderer.invoke('window:close'),
    isMaximized: () => electron_1.ipcRenderer.invoke('window:is-maximized'),
    onMaximizedChange: (callback) => {
        const listener = (_event, isMaximized) => callback(isMaximized);
        electron_1.ipcRenderer.on('window:maximized-change', listener);
        return () => {
            electron_1.ipcRenderer.removeListener('window:maximized-change', listener);
        };
    },
};
const appInfo = {
    name: 'PromptHound',
    version: readAppVersion(),
};
const extraction = {
    fromFilePath: (filePath) => electron_1.ipcRenderer.invoke('extraction:from-file-path', filePath),
    fromClipboard: () => electron_1.ipcRenderer.invoke('extraction:from-clipboard'),
    fromUrl: (url) => electron_1.ipcRenderer.invoke('extraction:from-url', url),
    getPathForFile: (file) => {
        try {
            return electron_1.webUtils.getPathForFile(file);
        }
        catch {
            return file.path || '';
        }
    },
    openFileDialog: () => electron_1.ipcRenderer.invoke('dialog:open-image-file'),
};
const promptHoundApi = {
    windowControls,
    appInfo,
    extraction,
    openExternal: (url) => electron_1.ipcRenderer.send('shell:openExternal', url),
};
electron_1.contextBridge.exposeInMainWorld('promptHound', promptHoundApi);
