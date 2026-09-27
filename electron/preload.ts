import { contextBridge, ipcRenderer, webUtils } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { ExtractionResult, ExtractionError } from '../core/types.js';

function readAppVersion(): string {
  try {
    const packageJsonPath = path.join(__dirname, '../../package.json');
    const raw = fs.readFileSync(packageJsonPath, 'utf-8');
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? '0.1.0';
  } catch {
    return '0.1.0';
  }
}

const windowControls = {
  minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: (): Promise<void> => ipcRenderer.invoke('window:toggle-maximize'),
  close: (): Promise<void> => ipcRenderer.invoke('window:close'),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
  onMaximizedChange: (callback: (isMaximized: boolean) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isMaximized: boolean): void =>
      callback(isMaximized);
    ipcRenderer.on('window:maximized-change', listener);
    return () => {
      ipcRenderer.removeListener('window:maximized-change', listener);
    };
  },
};

const appInfo = {
  name: 'PromptHound',
  version: readAppVersion(),
};

const extraction = {
  fromFilePath: (filePath: string): Promise<ExtractionResult | ExtractionError> =>
    ipcRenderer.invoke('extraction:from-file-path', filePath),
  fromClipboard: (): Promise<ExtractionResult | ExtractionError> =>
    ipcRenderer.invoke('extraction:from-clipboard'),
  fromUrl: (url: string): Promise<ExtractionResult | ExtractionError> =>
    ipcRenderer.invoke('extraction:from-url', url),
  getPathForFile: (file: File): string => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return (file as any).path || '';
    }
  },
  openFileDialog: (): Promise<string | null> => ipcRenderer.invoke('dialog:open-image-file'),
  readImageAsDataUrl: (fileUrl: string): Promise<string | null> => ipcRenderer.invoke('file:read-image-data-url', fileUrl),
};

const loraDb = {
  getAll: () => ipcRenderer.invoke('lora-db:get-all'),
  getByVersionId: (versionId: number) => ipcRenderer.invoke('lora-db:get-by-version', versionId),
  getByHash: (hash: string) => ipcRenderer.invoke('lora-db:get-by-hash', hash),
  getByAlias: (alias: string) => ipcRenderer.invoke('lora-db:get-by-alias', alias),
  upsert: (record: any) => ipcRenderer.invoke('lora-db:upsert', record),
  remove: (hashOrAlias: string) => ipcRenderer.invoke('lora-db:remove', hashOrAlias),
  clearUserCache: () => ipcRenderer.invoke('lora-db:clear-user-records'),
  getStats: () => ipcRenderer.invoke('lora-db:get-stats'),
};

const settings = {
  saveCivitaiKey: (key: string): Promise<void> => ipcRenderer.invoke('settings:save-civitai-key', key),
  getCivitaiKey: (): Promise<string | null> => ipcRenderer.invoke('settings:get-civitai-key'),
};

const library = {
  savePrompt: (item: any): Promise<void> => ipcRenderer.invoke('library:save-prompt', item),
  getAll: (): Promise<any[]> => ipcRenderer.invoke('library:get-all'),
  deletePrompt: (uuid: string): Promise<void> => ipcRenderer.invoke('library:delete-prompt', uuid),
  searchFts: (query: string): Promise<any[]> => ipcRenderer.invoke('library:search-fts', query),
  toggleFavorite: (uuid: string, isFav: boolean): Promise<void> => ipcRenderer.invoke('library:toggle-favorite', uuid, isFav),
};

const safetensors = {
  readFile: (filePath: string): Promise<any> => ipcRenderer.invoke('safetensors:read-file', filePath),
  openFileDialog: (): Promise<string | null> => ipcRenderer.invoke('dialog:open-safetensors-file'),
};

const updates = {
  getStatus: (): Promise<any> => ipcRenderer.invoke('update:get-status'),
  check: (): Promise<void> => ipcRenderer.invoke('update:check'),
  install: (): Promise<void> => ipcRenderer.invoke('update:install'),
  onStatus: (callback: (status: any) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: any): void => callback(status);
    ipcRenderer.on('update:status', listener);
    return () => {
      ipcRenderer.removeListener('update:status', listener);
    };
  },
};

const promptHoundApi = {
  windowControls,
  appInfo,
  extraction,
  loraDb,
  settings,
  library,
  safetensors,
  updates,
  openExternal: (url: string) => ipcRenderer.send('shell:openExternal', url),
};

contextBridge.exposeInMainWorld('promptHound', promptHoundApi);

export type PromptHoundApi = typeof promptHoundApi;
