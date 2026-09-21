"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_url_1 = require("node:url");
const index_js_1 = require("../core/index.js");
const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1536,
        height: 1024,
        minWidth: 1200,
        minHeight: 760,
        show: false,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        webPreferences: {
            preload: node_path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });
    if (isDev) {
        mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    else {
        mainWindow.loadFile(node_path_1.default.join(electron_1.app.getAppPath(), 'dist/index.html'));
    }
    mainWindow.on('maximize', () => {
        mainWindow?.webContents.send('window:maximized-change', true);
    });
    mainWindow.on('unmaximize', () => {
        mainWindow?.webContents.send('window:maximized-change', false);
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
function registerWindowControlHandlers() {
    electron_1.ipcMain.handle('window:minimize', () => {
        mainWindow?.minimize();
    });
    electron_1.ipcMain.handle('window:toggle-maximize', () => {
        if (!mainWindow)
            return;
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        }
        else {
            mainWindow.maximize();
        }
    });
    electron_1.ipcMain.handle('window:close', () => {
        mainWindow?.close();
    });
    electron_1.ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false);
    electron_1.ipcMain.on('shell:openExternal', (_event, url) => {
        electron_1.shell.openExternal(url);
    });
}
function registerExtractionHandlers() {
    electron_1.ipcMain.handle('extraction:from-file-path', async (_event, filePath) => {
        try {
            const buffer = await promises_1.default.readFile(filePath);
            const result = await (0, index_js_1.extractFromImageBuffer)(buffer, { kind: 'file', label: filePath });
            if (!(0, index_js_1.isExtractionError)(result)) {
                result.previewUrl = (0, node_url_1.pathToFileURL)(filePath).toString();
            }
            return result;
        }
        catch (error) {
            return {
                code: 'fetch-failed',
                message: `Could not read that file: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    });
    electron_1.ipcMain.handle('extraction:from-clipboard', async () => {
        const image = electron_1.clipboard.readImage();
        if (!image || image.isEmpty()) {
            return { code: 'no-metadata-found', message: 'No image was found on the clipboard.' };
        }
        // Note: clipboard only holds decoded pixels — original PNG chunks are gone.
        // Clipboard paste will often legitimately find no metadata. See core/README.md.
        const buffer = image.toPNG();
        const result = await (0, index_js_1.extractFromImageBuffer)(buffer, {
            kind: 'clipboard',
            label: 'Clipboard image',
        });
        if (!(0, index_js_1.isExtractionError)(result)) {
            result.previewUrl = image.toDataURL();
        }
        return result;
    });
    electron_1.ipcMain.handle('extraction:from-url', async (_event, url) => {
        try {
            return await (0, index_js_1.extractFromUrl)(url);
        }
        catch (error) {
            return {
                code: 'fetch-failed',
                message: `Something went wrong fetching that link: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    });
    electron_1.ipcMain.handle('dialog:open-image-file', async () => {
        if (!mainWindow)
            return null;
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            title: 'Choose an AI-generated image',
            properties: ['openFile'],
            filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
        });
        if (result.canceled || result.filePaths.length === 0)
            return null;
        return result.filePaths[0];
    });
}
electron_1.app.whenReady().then(() => {
    registerWindowControlHandlers();
    registerExtractionHandlers();
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
