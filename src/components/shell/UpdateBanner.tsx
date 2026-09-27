import React, { useEffect, useState } from 'react';
import type { UpdateStatus } from '../../types/global.js';
import styles from './UpdateBanner.module.css';

/** Bottom-right notice for background updates: download progress, then "Restart to update". */
export const UpdateBanner: React.FC = () => {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  useEffect(() => {
    const updates = window.promptHound?.updates;
    if (!updates) return;
    updates.getStatus().then(setStatus).catch(() => undefined);
    return updates.onStatus(setStatus);
  }, []);

  if (!status) return null;
  if (status.state !== 'downloading' && status.state !== 'downloaded') return null;
  const version = status.version ?? '';
  if (dismissedVersion === version) return null;

  if (status.state === 'downloading') {
    return (
      <div className={styles.banner} role="status">
        <div className={styles.text}>
          <strong>Downloading update{version ? ` v${version}` : ''}</strong>
          <span>{status.percent}%</span>
        </div>
        <div className={styles.progress}>
          <div className={styles.progressFill} style={{ width: `${status.percent}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.banner} role="status">
      <div className={styles.text}>
        <strong>PromptHound v{version} is ready</strong>
        <span>It replaces this version when you restart, or next time you close the app.</span>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.later} onClick={() => setDismissedVersion(version)}>
          Later
        </button>
        <button type="button" className={styles.restart} onClick={() => window.promptHound?.updates?.install()}>
          Restart to update
        </button>
      </div>
    </div>
  );
};
