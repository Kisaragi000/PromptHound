import { useEffect, useState } from 'react';
import type { UpdateStatus } from '../../types/global.js';
import { t } from '../../i18n/index.js';

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
  if (!status) return t('update.desc.none');
  switch (status.state) {
    case 'idle':
      return t('update.desc.idle');
    case 'checking':
      return t('update.desc.checking');
    case 'up-to-date':
      return t('update.desc.upToDate');
    case 'available':
      return t('update.desc.available', { version: status.version });
    case 'downloading':
      return t('update.desc.downloading', { version: status.version ? ` v${status.version}` : '', percent: status.percent });
    case 'downloaded':
      return t('update.desc.downloaded', { version: status.version });
    case 'unsupported':
      return t('update.desc.unsupported');
    case 'error':
      return isReleaseReadError(status.message) ? t('update.desc.releasesError') : t('update.desc.networkError');
  }
}

/** A few words for tight spaces such as the sidebar */
export function shortUpdateLabel(status: UpdateStatus | null): string {
  if (!status) return t('update.short.none');
  switch (status.state) {
    case 'idle':
      return t('update.short.idle');
    case 'checking':
      return t('update.short.checking');
    case 'up-to-date':
      return t('update.short.upToDate');
    case 'available':
      return t('update.short.available', { version: status.version });
    case 'downloading':
      return t('update.short.downloading', { percent: status.percent });
    case 'downloaded':
      return t('update.short.downloaded', { version: status.version });
    case 'unsupported':
      return t('update.short.unsupported');
    case 'error':
      return isReleaseReadError(status.message) ? t('update.short.releasesError') : t('update.short.networkError');
  }
}
