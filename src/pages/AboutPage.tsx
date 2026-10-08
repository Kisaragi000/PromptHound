import React, { useEffect, useState } from 'react';
import { PromptHoundLogo, ExternalLinkIcon } from '../components/icons/Icons.js';
import { SecondaryButton } from '../components/primitives/SecondaryButton.js';
import type { UpdateStatus } from '../types/global.js';
import styles from './StaticPage.module.css';

/** Plain-language line for the current update state; errors keep the raw message for the tooltip */
function describeUpdateStatus(status: UpdateStatus | null): string {
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
      return /\b40[134]\b/.test(status.message)
        ? 'Could not read the releases on GitHub. Check again later or download the newest version from the Releases page.'
        : 'Could not check for updates. Check your internet connection and try again.';
  }
}

export const AboutPage: React.FC = () => {
  const version = window.promptHound?.appInfo?.version ?? '';
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    const updates = window.promptHound?.updates;
    if (!updates) return;
    updates.getStatus().then(setUpdateStatus).catch(() => undefined);
    return updates.onStatus(setUpdateStatus);
  }, []);

  const busy = updateStatus?.state === 'checking' || updateStatus?.state === 'available' || updateStatus?.state === 'downloading';
  const canCheck = !!updateStatus && updateStatus.state !== 'unsupported' && updateStatus.state !== 'downloaded' && !busy;

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
            Universal AI Prompt & Metadata Extraction Utility for Windows Desktop
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>SYSTEM SPECIFICATION</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '14px' }}>
          <div>
            <strong style={{ color: 'var(--color-text-secondary)' }}>Phase:</strong> Phase 1 (Metadata Extraction & Desktop Shell)
          </div>
          <div>
            <strong style={{ color: 'var(--color-text-secondary)' }}>Version:</strong> {version || 'unknown'}
          </div>
          <div>
            <strong style={{ color: 'var(--color-text-secondary)' }}>Engine:</strong> Electron + Vite + React + TypeScript
          </div>
          <div>
            <strong style={{ color: 'var(--color-text-secondary)' }}>Theme:</strong> Smoked Blue-Black Glass
          </div>
          <div>
            <strong style={{ color: 'var(--color-text-secondary)' }}>Target OS:</strong> Windows 10 / 11 (x64)
          </div>
          <div>
            <strong style={{ color: 'var(--color-text-secondary)' }}>Repository:</strong>{' '}
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
        <div className={styles.sectionTitle}>UPDATES</div>
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
              <SecondaryButton onClick={() => window.promptHound?.updates?.install()}>Restart to update</SecondaryButton>
            ) : (
              <SecondaryButton disabled={!canCheck} onClick={() => window.promptHound?.updates?.check()}>
                Check for updates
              </SecondaryButton>
            )}
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>ABOUT THIS SOFTWARE</div>
        <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
          PromptHound is designed for digital artists, prompt engineers, and AI creators who require precision
          metadata tracking. It inspects PNG/WebP chunk metadata (Automatic1111 tEXt chunks, ComfyUI node graphs,
          Fooocus, InvokeAI, NovelAI), extracts raw parameters, and queries model indices to resolve human-readable
          LoRA identifiers and model checkpoints.
        </p>
      </div>
    </div>
  );
};
