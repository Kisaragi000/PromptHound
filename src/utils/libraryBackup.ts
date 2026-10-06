import { zipSync, unzipSync, strToU8, strFromU8, type Zippable } from 'fflate';
import type { LibraryImage, SavedPromptItem } from '../../core/types.js';
import { MAX_LIBRARY_IMAGES } from '../../core/types.js';
import { imageToDataUrl } from './images.js';
import { itemImages, storeLibraryImage } from './libraryImages.js';

/**
 * Library backups: one .zip holding manifest.json (prompts, folders, favorites) and the
 * prompts' own images under images/<item id>/. Images the app ships or links to on the
 * web (sample paths, Civitai CDN) stay as links; images kept by the app are copied in.
 */

export const BACKUP_FORMAT = 'prompthound-library';
export const BACKUP_VERSION = 1;
const MANIFEST = 'manifest.json';

/** An image inside a backup: a file in the zip, or a link kept as it was */
interface BackupImage {
  file?: string;
  url?: string;
  name?: string;
}

type BackupItem = Omit<SavedPromptItem, 'images' | 'thumbnailUrl'> & {
  thumbnailUrl?: string;
  images: BackupImage[];
};

export interface LibraryBackupManifest {
  format: typeof BACKUP_FORMAT;
  version: number;
  appVersion?: string;
  exportedAt: string;
  folders: string[];
  favorites: string[];
  items: BackupItem[];
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};
const TYPE_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
};

/** Images the app keeps itself (stored files, embedded copies, session previews) */
const isKeptByApp = (url: string) => /^(ph-image|data|blob|file):/i.test(url);

const safeSegment = (value: string) => value.replace(/[^\w.-]/g, '_').slice(0, 120) || 'item';

async function readImage(url: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  try {
    const response = await fetch(url);
    if (response.ok) {
      const blob = await response.blob();
      return { bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type };
    }
  } catch {
    // file: URLs are read through the desktop app below
  }
  const dataUrl = await imageToDataUrl(url);
  if (!dataUrl) return null;
  const type = dataUrl.slice(5, dataUrl.indexOf(';'));
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, type };
}

export interface BuiltBackup {
  bytes: Uint8Array;
  itemCount: number;
  imageCount: number;
  /** Images that could not be read and were left out */
  missingImages: number;
}

export async function buildLibraryBackup(
  items: SavedPromptItem[],
  folders: string[],
  favorites: string[],
  appVersion?: string
): Promise<BuiltBackup> {
  const zipFiles: Zippable = {};
  const backupItems: BackupItem[] = [];
  let imageCount = 0;
  let missingImages = 0;

  for (const item of items) {
    const images: BackupImage[] = [];
    const dir = `images/${safeSegment(item.id)}`;
    for (const [index, image] of itemImages(item).entries()) {
      if (!isKeptByApp(image.url)) {
        images.push({ url: image.url, name: image.name });
        continue;
      }
      const read = await readImage(image.url);
      if (!read) {
        missingImages++;
        continue;
      }
      const ext = EXTENSION_BY_TYPE[read.type] ?? image.name?.match(/\.(\w+)$/)?.[1]?.toLowerCase() ?? 'png';
      const file = `${dir}/${index + 1}.${ext}`;
      // Images are compressed already; storing them keeps export fast
      zipFiles[file] = [read.bytes, { level: 0 }];
      images.push({ file, name: image.name });
      imageCount++;
    }
    const { images: _images, thumbnailUrl, ...rest } = item;
    backupItems.push({
      ...rest,
      // Old items only have a cover thumbnail; links survive as they are
      thumbnailUrl: thumbnailUrl && !isKeptByApp(thumbnailUrl) ? thumbnailUrl : undefined,
      images,
    });
  }

  const manifest: LibraryBackupManifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appVersion,
    exportedAt: new Date().toISOString(),
    folders,
    favorites,
    items: backupItems,
  };
  zipFiles[MANIFEST] = strToU8(JSON.stringify(manifest, null, 2));

  return { bytes: zipSync(zipFiles), itemCount: items.length, imageCount, missingImages };
}

export interface OpenedBackup {
  manifest: LibraryBackupManifest;
  files: Record<string, Uint8Array>;
}

/** Reads a backup zip; throws an Error with a message for the user when it is not one */
export function readLibraryBackup(bytes: Uint8Array): OpenedBackup {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('This file is not a PromptHound library backup (.zip).');
  }
  if (!files[MANIFEST]) throw new Error('This zip has no manifest.json, so it is not a PromptHound library backup.');

  let manifest: LibraryBackupManifest;
  try {
    manifest = JSON.parse(strFromU8(files[MANIFEST]));
  } catch {
    throw new Error('The backup manifest could not be read.');
  }
  if (manifest?.format !== BACKUP_FORMAT || !Array.isArray(manifest.items)) {
    throw new Error('This zip is not a PromptHound library backup.');
  }
  if (typeof manifest.version !== 'number' || manifest.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of PromptHound. Update the app to import it.');
  }
  return {
    manifest: {
      ...manifest,
      folders: Array.isArray(manifest.folders) ? manifest.folders.filter((f) => typeof f === 'string') : [],
      favorites: Array.isArray(manifest.favorites) ? manifest.favorites.filter((f) => typeof f === 'string') : [],
      items: manifest.items.filter((i) => i && typeof i.id === 'string' && i.id && typeof i.title === 'string'),
    },
    files,
  };
}

/**
 * Turns backup items into library items, storing their images like newly added ones.
 * Items whose id is already in the library are skipped (the library copy wins).
 */
export async function restoreBackupItems(
  backup: OpenedBackup,
  existingIds: Set<string>
): Promise<{ items: SavedPromptItem[]; skipped: number }> {
  const items: SavedPromptItem[] = [];
  let skipped = 0;

  for (const entry of backup.manifest.items) {
    if (existingIds.has(entry.id)) {
      skipped++;
      continue;
    }
    const images: LibraryImage[] = [];
    for (const image of (Array.isArray(entry.images) ? entry.images : []).slice(0, MAX_LIBRARY_IMAGES)) {
      if (image.file && backup.files[image.file]) {
        const ext = image.file.split('.').pop()?.toLowerCase() ?? '';
        const blob = new Blob([backup.files[image.file] as BlobPart], { type: TYPE_BY_EXTENSION[ext] ?? '' });
        const stored = await storeLibraryImage(entry.id, blob, image.name ?? `image.${ext}`);
        if (stored) images.push(stored);
      } else if (image.url) {
        images.push({ url: image.url, thumbUrl: image.url, name: image.name });
      }
    }
    const { images: _images, thumbnailUrl, ...rest } = entry;
    items.push({
      ...rest,
      folder: typeof entry.folder === 'string' ? entry.folder : '',
      isFavorite: backup.manifest.favorites.includes(entry.id) || Boolean(entry.isFavorite),
      images: images.length ? images : undefined,
      thumbnailUrl: images[0]?.thumbUrl ?? thumbnailUrl ?? '',
    });
  }
  return { items, skipped };
}

export function backupFileName(date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  return `PromptHound-Library-${stamp}.zip`;
}
