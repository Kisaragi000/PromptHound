import { useEffect, useState } from 'react';
import type { UpdateStatus } from '../../types/global.js';

export const RELEASES_URL = 'https://github.com/Kisaragi000/PromptHound/releases/latest';

/** Live auto-update state from the main process; null outside the desktop app */
export function useUpdateStatus(): UpdateStatus | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    const updates = window.promptHound?.updates;
    if (!updates) return;
    updates.getStatus().then(setStatus).catch(() => undefined);
    return updates.onStatus(setStatus);
  }, []);

  return status;
}

/** True while a check or download is running */
export function isUpdateBusy(status: UpdateStatus | null): boolean {
  return status?.state === 'checking' || status?.state === 'available' || status?.state === 'downloading';
}

/** "Check for updates" makes sense: installed app, nothing running and nothing waiting to install */
export function canCheckForUpdates(status: UpdateStatus | null): boolean {
  return !!status && status.state !== 'unsupported' && status.state !== 'downloaded' && !isUpdateBusy(status);
}

function isReleaseReadError(message: string): boolean {
  return /\b40[134]\b/.test(message);
}

/** Plain-language sentence for the current update state */
export function describeUpdateStatus(status: UpdateStatus | null): string {
  if (!status) return 'Updates are only available in the installed app.';
  switch (status.state) {
    case 'idle':
      return 'PromptHound checks for updates when it starts and every 6 hours.';
    case 'checking':
      return 'Checking for updates…';
    case 'up-to-date':
      return 'You have the latest version.';
    case 'available':
      return `Version ${status.version} found, downloading…`;
    case 'downloading':
      return `Downloading update${status.version ? ` v${status.version}` : ''}: ${status.percent}%`;
    case 'downloaded':
      return `Version ${status.version} is ready. Restart PromptHound to install it.`;
    case 'unsupported':
      return 'The portable version cannot update itself. Download the newest one from the Releases page.';
    case 'error':
      return isReleaseReadError(status.message)
        ? 'Could not read the releases on GitHub. Check again later or download the newest version from the Releases page.'
        : 'Could not check for updates. Check your internet connection and try again.';
  }
}

/** A few words for tight spaces such as the sidebar */
export function shortUpdateLabel(status: UpdateStatus | null): string {
  if (!status) return 'Updates in the installed app';
  switch (status.state) {
    case 'idle':
      return 'Checks automatically';
    case 'checking':
      return 'Checking…';
    case 'up-to-date':
      return 'Up to date';
    case 'available':
      return `v${status.version} found`;
    case 'downloading':
      return `Downloading ${status.percent}%`;
    case 'downloaded':
      return `v${status.version} ready to install`;
    case 'unsupported':
      return 'Portable: update by hand';
    case 'error':
      return isReleaseReadError(status.message) ? 'Releases unreachable' : 'Check failed, offline?';
  }
}
