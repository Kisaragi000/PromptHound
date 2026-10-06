import type { ExtractionResult, ExtractionError } from '../../core/types.js';

export type UpdateStatus =
  | { state: 'idle' | 'checking' | 'unsupported' }
  | { state: 'available' | 'downloaded'; version: string }
  | { state: 'downloading'; version?: string; percent: number }
  | { state: 'error'; message: string };

export interface PromptHoundAPI {
  appInfo: {
    name?: string;
    version: string;
  };
  windowControls: {
    minimize: () => Promise<void> | void;
    toggleMaximize?: () => Promise<void> | void;
    maximize: () => void;
    close: () => Promise<void> | void;
    isMaximized: () => Promise<boolean>;
    onMaximizedChange?: (callback: (isMaximized: boolean) => void) => () => void;
  };
  openExternal?: (url: string) => void;
  updates?: {
    getStatus: () => Promise<UpdateStatus>;
    check: () => Promise<void>;
    install: () => Promise<void>;
    onStatus: (callback: (status: UpdateStatus) => void) => () => void;
  };
  extraction: {
    fromFilePath: (filePath: string) => Promise<ExtractionResult | ExtractionError>;
    fromClipboard: () => Promise<ExtractionResult | ExtractionError>;
    fromUrl: (url: string) => Promise<ExtractionResult | ExtractionError>;
    getPathForFile: (file: File) => string;
    openFileDialog: () => Promise<string | null>;
    readImageAsDataUrl?: (fileUrl: string) => Promise<string | null>;
  };
  loraDb?: {
    getAll?: () => Promise<any[]>;
    getByVersionId?: (versionId: number) => Promise<any>;
    getByHash: (hash: string) => Promise<any>;
    getByAlias: (alias: string) => Promise<any>;
    upsert: (record: any) => Promise<void>;
    remove: (hashOrAlias: string) => Promise<void>;
    clearUserCache: () => Promise<void>;
    getStats: () => Promise<{ count: number; userCount: number; lastUpdated?: number }>;
  };
  settings?: {
    saveCivitaiKey: (key: string) => Promise<void>;
    getCivitaiKey: () => Promise<string | null>;
  };
  library?: {
    storeImage?: (
      itemId: string,
      original: Uint8Array,
      extension: string,
      thumbnail: Uint8Array,
      name?: string
    ) => Promise<{ url: string; thumbUrl: string; name?: string }>;
    deleteImage?: (urls: string[]) => Promise<void>;
    deleteItemImages?: (itemId: string) => Promise<void>;
    savePrompt: (item: any) => Promise<void>;
    getAll: () => Promise<any[]>;
    deletePrompt: (uuid: string) => Promise<void>;
    searchFts: (query: string) => Promise<any[]>;
    toggleFavorite: (uuid: string, isFav: boolean) => Promise<void>;
  };
  shellIntegration?: {
    get: () => Promise<{ supported: boolean; enabled: boolean }>;
    set: (enabled: boolean) => Promise<{ supported: boolean; enabled: boolean }>;
    takeOpenedFiles: () => Promise<Array<{ name: string; bytes: Uint8Array }>>;
    onFilesOpened: (callback: () => void) => () => void;
  };
  safetensors?: {
    readFile: (filePath: string) => Promise<any>;
    openFileDialog: () => Promise<string | null>;
  };
}

declare global {
  /** package.json version, injected by Vite */
  const __APP_VERSION__: string;
  interface Window {
    promptHound?: PromptHoundAPI;
  }
}
