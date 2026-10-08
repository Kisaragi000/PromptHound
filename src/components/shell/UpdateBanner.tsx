import React, { useState } from 'react';
import { useNavigation } from '../../navigation/NavigationContext.js';
import { useUpdateStatus } from './useUpdateStatus.js';
import { useT } from '../../i18n/index.js';
import styles from './UpdateBanner.module.css';

/**
 * Bottom-right notice for background updates: download progress, then "Restart to update".
 * Home shows the same notice at the top of the page instead.
 */
export const UpdateBanner: React.FC = () => {
  const t = useT();
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
          <strong>{t('update.banner.downloading', { version: version ? ` v${version}` : '' })}</strong>
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
        <strong>{t('update.banner.ready', { version })}</strong>
        <span>{t('update.banner.readyBody')}</span>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.later} onClick={() => setDismissedVersion(version)}>
          {t('common.later')}
        </button>
        <button type="button" className={styles.restart} onClick={() => window.promptHound?.updates?.install()}>
          {t('update.restart')}
        </button>
      </div>
    </div>
  );
};
