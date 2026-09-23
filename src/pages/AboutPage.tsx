import React from 'react';
import { PromptHoundLogo, ExternalLinkIcon } from '../components/icons/Icons.js';
import styles from './StaticPage.module.css';

export const AboutPage: React.FC = () => {
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
            <strong style={{ color: 'var(--color-text-secondary)' }}>Version:</strong> 0.1.0-alpha
          </div>
          <div>
            <strong style={{ color: 'var(--color-text-secondary)' }}>Engine:</strong> Electron + Vite + React + TypeScript
          </div>
          <div>
            <strong style={{ color: 'var(--color-text-secondary)' }}>Theme:</strong> Dark Forest Glassmorphism
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
