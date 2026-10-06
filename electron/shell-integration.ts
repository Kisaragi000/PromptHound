import { app } from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Windows Explorer integration: an "Extract with PromptHound" entry on the right-click
 * menu of image files, and handing the files it opens to the running window.
 *
 * The menu lives under HKCU\Software\Classes\SystemFileAssociations\<ext>\shell, so it
 * needs no admin rights and does not change which app opens images by default.
 */

export const OPENABLE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.jfif', '.webp', '.avif'];
const MENU_KEY = 'PromptHound';
const MENU_LABEL = 'Extract with PromptHound';
const MAX_OPEN_FILE_BYTES = 60 * 1024 * 1024;

const menuKeyFor = (ext: string) => `HKCU\\Software\\Classes\\SystemFileAssociations\\${ext}\\shell\\${MENU_KEY}`;

export function isShellIntegrationSupported(): boolean {
  return process.platform === 'win32' && app.isPackaged;
}

/** The exe Explorer should start; the portable build runs from a temporary copy */
function launcherPath(): string {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
}

function reg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('reg', args, { windowsHide: true }, (error) => (error ? reject(error) : resolve()));
  });
}

export async function registerContextMenu(): Promise<void> {
  const exe = launcherPath();
  for (const ext of OPENABLE_EXTENSIONS) {
    const key = menuKeyFor(ext);
    await reg(['add', key, '/ve', '/d', MENU_LABEL, '/f']);
    await reg(['add', key, '/v', 'Icon', '/d', `"${exe}",0`, '/f']);
    // One process per selected file; the single-instance lock forwards them to one window
    await reg(['add', `${key}\\command`, '/ve', '/d', `"${exe}" "%1"`, '/f']);
  }
}

export async function unregisterContextMenu(): Promise<void> {
  for (const ext of OPENABLE_EXTENSIONS) {
    // Fails when the key is already gone, which is the state we want
    await reg(['delete', menuKeyFor(ext), '/f']).catch(() => undefined);
  }
}

/** Image files named on a command line (Explorer passes one path per launch) */
export function imagePathsFromArgv(argv: string[]): string[] {
  return argv.slice(1).filter((arg) => {
    if (arg.startsWith('-') || !OPENABLE_EXTENSIONS.includes(path.extname(arg).toLowerCase())) return false;
    try {
      return fs.statSync(arg).isFile();
    } catch {
      return false;
    }
  });
}

export interface OpenedFile {
  name: string;
  bytes: Uint8Array;
}

/**
 * Paths waiting for the window. Files opened together from Explorer arrive as separate
 * launches a few milliseconds apart, so the window is told once they stop arriving and
 * then takes them all as one batch.
 */
const pendingPaths: string[] = [];
let notifyTimer: ReturnType<typeof setTimeout> | null = null;

export function queueOpenedPaths(paths: string[], notify: () => void): void {
  for (const p of paths) if (!pendingPaths.includes(p)) pendingPaths.push(p);
  if (!paths.length) return;
  if (notifyTimer) clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    notify();
  }, 250);
}

/** Reads and clears the queued files; only paths queued from a command line are read */
export async function takeOpenedFiles(): Promise<OpenedFile[]> {
  const paths = pendingPaths.splice(0);
  const files: OpenedFile[] = [];
  for (const p of paths) {
    try {
      const stat = await fs.promises.stat(p);
      if (!stat.isFile() || stat.size > MAX_OPEN_FILE_BYTES) continue;
      files.push({ name: path.basename(p), bytes: new Uint8Array(await fs.promises.readFile(p)) });
    } catch {
      // Moved or deleted since it was opened
    }
  }
  return files;
}
