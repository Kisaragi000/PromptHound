import React, { useState } from 'react';
import { useNavigation } from '../../navigation/NavigationContext.js';
import { useUpdateStatus } from './useUpdateStatus.js';
import styles from './UpdateBanner.module.css';

/**
 * Bottom-right notice for background updates: download progress, then "Restart to update".
 * Home shows the same notice at the top of the page instead.
 */
export const UpdateBanner: React.FC = () => {
  const status = useUpdateStatus();
  const { currentRoute } = useNavigation();
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  if (!status || currentRoute === 'home') return null;
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
