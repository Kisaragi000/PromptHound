import React, { useRef, useState } from 'react';
import { SecondaryButton } from '../primitives/SecondaryButton.js';
import { useNavigation } from '../../navigation/NavigationContext.js';
import {
  backupFileName,
  buildLibraryBackup,
  readLibraryBackup,
  restoreBackupItems,
} from '../../utils/libraryBackup.js';
import { useT } from '../../i18n/index.js';
import { translateMessage } from '../../i18n/labels.js';

type Status = { kind: 'busy' | 'success' | 'error'; message: string } | null;

/** Export the whole Prompt Library to a .zip, or import one made on this or another PC */
export const LibraryBackupControls: React.FC = () => {
  const t = useT();
  const { libraryItems, folders, favorites, importLibraryItems } = useNavigation();
  const [status, setStatus] = useState<Status>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = status?.kind === 'busy';

  const handleExport = async () => {
    setStatus({ kind: 'busy', message: t('backup.packing') });
    try {
      const backup = await buildLibraryBackup(libraryItems, folders, favorites, window.promptHound?.appInfo?.version);
      const name = backupFileName();
      const saveBackup = window.promptHound?.library?.saveBackup;
      if (saveBackup) {
        const savedTo = await saveBackup(backup.bytes, name);
        if (!savedTo) return setStatus(null);
      } else {
        const url = URL.createObjectURL(new Blob([backup.bytes as BlobPart], { type: 'application/zip' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
      const missing = backup.missingImages ? ` ${t('backup.missing', { count: backup.missingImages })}` : '';
      const exported = t('backup.exported', {
        prompts: t('backup.promptCount', { count: backup.itemCount }),
        images: t('backup.imageCount', { count: backup.imageCount }),
      });
      setStatus({ kind: 'success', message: `${exported}${missing}` });
    } catch (err) {
      setStatus({ kind: 'error', message: t('backup.exportFailed', { error: err instanceof Error ? err.message : String(err) }) });
    }
  };

  const importBytes = async (bytes: Uint8Array) => {
    setStatus({ kind: 'busy', message: t('backup.importing') });
    try {
      const backup = readLibraryBackup(bytes);
      const { items, skipped } = await restoreBackupItems(backup, new Set(libraryItems.map((i) => i.id)));
      importLibraryItems(items, backup.manifest.folders);
      const skippedText = skipped ? ` ${t('backup.skipped', { count: skipped })}` : '';
      const imported = t('backup.imported', { prompts: t('backup.promptCount', { count: items.length }) });
      setStatus({ kind: 'success', message: `${imported}${skippedText}` });
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleImport = async () => {
    const openBackup = window.promptHound?.library?.openBackup;
    if (!openBackup) {
      fileInput.current?.click();
      return;
    }
    try {
      const picked = await openBackup();
      if (picked) await importBytes(picked.bytes);
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await importBytes(new Uint8Array(await file.arrayBuffer()));
  };

  const statusColor = status?.kind === 'error' ? '#f87171' : status?.kind === 'success' ? '#4ade80' : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <SecondaryButton onClick={() => void handleExport()} disabled={busy}>
          {t('backup.export')}
        </SecondaryButton>
        <SecondaryButton onClick={() => void handleImport()} disabled={busy}>
          {t('backup.import')}
        </SecondaryButton>
      </div>
      {status && (
        <div role="status" style={{ fontSize: '12px', color: statusColor, maxWidth: '360px', textAlign: 'right' }}>
          {translateMessage(status.message)}
        </div>
      )}
      <input ref={fileInput} type="file" accept=".zip,application/zip" hidden onChange={(e) => void handleFileInput(e)} />
    </div>
  );
};
