import React from 'react';
import { PromptHoundLogo, ExternalLinkIcon } from '../components/icons/Icons.js';
import { SecondaryButton } from '../components/primitives/SecondaryButton.js';
import {
  useUpdateStatus,
  describeUpdateStatus,
  canCheckForUpdates,
} from '../components/shell/useUpdateStatus.js';
import { useT } from '../i18n/index.js';
import styles from './StaticPage.module.css';

export const AboutPage: React.FC = () => {
  const t = useT();
  const version = __APP_VERSION__;
  const updateStatus = useUpdateStatus();
  const canCheck = canCheckForUpdates(updateStatus);

  return (
    <div className={styles.page}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(245, 154, 34, 0.15)',
            border: '1px solid var(--color-border-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PromptHoundLogo size={48} />
        </div>
        <div>
          <h1 className={styles.headerTitle}>PromptHound</h1>
          <p className={styles.headerSubtitle}>
            {t('about.tagline')}
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('about.specSection')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '14px' }}>
          <div>
            <strong style={{ color: 'var(--color-text-secondary)' }}>{t('about.phase')}</strong> {t('about.phaseValue')}
          </div>
          <div>
            <strong style={{ color: 'var(--color-text-secondary)' }}>{t('about.version')}</strong> {version || t('about.unknown')}
          </div>
          <div>
            <strong style={{ color: 'var(--color-text-secondary)' }}>{t('about.engine')}</strong> Electron + Vite + React + TypeScript
          </div>
          <div>
            <strong style={{ color: 'var(--color-text-secondary)' }}>{t('about.theme')}</strong> {t('about.themeValue')}
          </div>
          <div>
            <strong style={{ color: 'var(--color-text-secondary)' }}>{t('about.os')}</strong> Windows 10 / 11 (x64)
          </div>
          <div>
            <strong style={{ color: 'var(--color-text-secondary)' }}>{t('about.repo')}</strong>{' '}
            <a
              href="https://github.com/Kisaragi000/PromptHound"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-link-accent)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              github.com/Kisaragi000/PromptHound
              <ExternalLinkIcon size={12} />
            </a>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('about.updatesSection')}</div>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>{version ? `PromptHound v${version}` : 'PromptHound'}</span>
            <span
              className={styles.settingDesc}
              title={updateStatus?.state === 'error' ? updateStatus.message : undefined}
            >
              {describeUpdateStatus(updateStatus)}
            </span>
          </div>
          <div className={styles.settingControl}>
            {updateStatus?.state === 'downloaded' ? (
              <SecondaryButton onClick={() => window.promptHound?.updates?.install()}>{t('update.restart')}</SecondaryButton>
            ) : (
              <SecondaryButton disabled={!canCheck} onClick={() => window.promptHound?.updates?.check()}>
                {t('update.check')}
              </SecondaryButton>
            )}
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('about.softwareSection')}</div>
        <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
          {t('about.body')}
        </p>
      </div>
    </div>
  );
};
