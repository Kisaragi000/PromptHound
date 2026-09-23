import React from 'react';
import type { SavedPromptItem, LoraReference } from '../../../core/types.js';
import { EyeIcon, SparklesIcon, CheckIcon, CopyIcon } from '../icons/Icons.js';
import { SecondaryButton } from '../primitives/SecondaryButton.js';
import { PrimaryButton } from '../primitives/PrimaryButton.js';
import styles from './PromptDiffModal.module.css';

interface PromptDiffModalProps {
  itemA: SavedPromptItem;
  itemB: SavedPromptItem;
  isOpen: boolean;
  onClose: () => void;
}

export const PromptDiffModal: React.FC<PromptDiffModalProps> = ({
  itemA,
  itemB,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const metaA = itemA.metadata || {};
  const metaB = itemB.metadata || {};

  const isDiff = (valA: any, valB: any) => String(valA ?? '') !== String(valB ?? '');

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>Side-by-Side Recipe Comparison</h3>
            <p className={styles.subtitle}>Comparing parameters, prompts, and LoRAs across generations</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕ Close
          </button>
        </div>

        {/* 2-Column Comparison Body */}
        <div className={styles.body}>
          <div className={styles.columnGrid}>
            {/* Column A */}
            <div className={styles.column}>
              <div className={styles.cardHeader}>
                <div className={styles.thumbWrap}>
                  <img src={itemA.thumbnailUrl} alt={itemA.title} className={styles.thumb} />
                </div>
                <div>
                  <h4 className={styles.itemTitle}>{itemA.title}</h4>
                  <span className={styles.itemSub}>{itemA.folder} · {itemA.date}</span>
                </div>
              </div>

              <div className={styles.diffSection}>
                <span className={styles.sectionLabel}>Positive Prompt</span>
                <div className={`${styles.textBox} ${isDiff(metaA.prompt, metaB.prompt) ? styles.textDiff : ''}`}>
                  {metaA.prompt || '(Empty prompt)'}
                </div>
              </div>

              {metaA.negativePrompt && (
                <div className={styles.diffSection}>
                  <span className={styles.sectionLabel}>Negative Prompt</span>
                  <div className={`${styles.textBox} ${isDiff(metaA.negativePrompt, metaB.negativePrompt) ? styles.textDiff : ''}`}>
                    {metaA.negativePrompt}
                  </div>
                </div>
              )}

              <div className={styles.paramsGrid}>
                <div className={`${styles.paramCard} ${isDiff(metaA.model, metaB.model) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>Model</span>
                  <span className={styles.paramValue}>{metaA.model || itemA.model || '—'}</span>
                </div>
                <div className={`${styles.paramCard} ${isDiff(metaA.sampler, metaB.sampler) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>Sampler</span>
                  <span className={styles.paramValue}>{metaA.sampler || '—'}</span>
                </div>
                <div className={`${styles.paramCard} ${isDiff(metaA.steps, metaB.steps) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>Steps</span>
                  <span className={styles.paramValue}>{metaA.steps ?? '—'}</span>
                </div>
                <div className={`${styles.paramCard} ${isDiff(metaA.cfgScale, metaB.cfgScale) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>CFG Scale</span>
                  <span className={styles.paramValue}>{metaA.cfgScale ?? '—'}</span>
                </div>
                <div className={`${styles.paramCard} ${isDiff(metaA.seed, metaB.seed) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>Seed</span>
                  <span className={styles.paramValue}>{metaA.seed ?? '—'}</span>
                </div>
                <div className={`${styles.paramCard} ${isDiff(metaA.width, metaB.width) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>Dimensions</span>
                  <span className={styles.paramValue}>{itemA.dimensions || '1024 × 1024'}</span>
                </div>
              </div>

              {/* LoRA List A */}
              <div className={styles.diffSection}>
                <span className={styles.sectionLabel}>LoRAs ({metaA.loras?.length || 0})</span>
                <div className={styles.loraList}>
                  {metaA.loras && metaA.loras.length > 0 ? (
                    metaA.loras.map((l: LoraReference, i: number) => (
                      <div key={i} className={styles.loraTag}>
                        <span>{l.resolved?.name || l.rawName}</span>
                        <span className={styles.loraWeight}>{l.strength ?? 0.8}</span>
                      </div>
                    ))
                  ) : (
                    <span className={styles.emptyText}>No LoRAs used</span>
                  )}
                </div>
              </div>
            </div>

            {/* Column B */}
            <div className={styles.column}>
              <div className={styles.cardHeader}>
                <div className={styles.thumbWrap}>
                  <img src={itemB.thumbnailUrl} alt={itemB.title} className={styles.thumb} />
                </div>
                <div>
                  <h4 className={styles.itemTitle}>{itemB.title}</h4>
                  <span className={styles.itemSub}>{itemB.folder} · {itemB.date}</span>
                </div>
              </div>

              <div className={styles.diffSection}>
                <span className={styles.sectionLabel}>Positive Prompt</span>
                <div className={`${styles.textBox} ${isDiff(metaA.prompt, metaB.prompt) ? styles.textDiff : ''}`}>
                  {metaB.prompt || '(Empty prompt)'}
                </div>
              </div>

              {metaB.negativePrompt && (
                <div className={styles.diffSection}>
                  <span className={styles.sectionLabel}>Negative Prompt</span>
                  <div className={`${styles.textBox} ${isDiff(metaA.negativePrompt, metaB.negativePrompt) ? styles.textDiff : ''}`}>
                    {metaB.negativePrompt}
                  </div>
                </div>
              )}

              <div className={styles.paramsGrid}>
                <div className={`${styles.paramCard} ${isDiff(metaA.model, metaB.model) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>Model</span>
                  <span className={styles.paramValue}>{metaB.model || itemB.model || '—'}</span>
                </div>
                <div className={`${styles.paramCard} ${isDiff(metaA.sampler, metaB.sampler) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>Sampler</span>
                  <span className={styles.paramValue}>{metaB.sampler || '—'}</span>
                </div>
                <div className={`${styles.paramCard} ${isDiff(metaA.steps, metaB.steps) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>Steps</span>
                  <span className={styles.paramValue}>{metaB.steps ?? '—'}</span>
                </div>
                <div className={`${styles.paramCard} ${isDiff(metaA.cfgScale, metaB.cfgScale) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>CFG Scale</span>
                  <span className={styles.paramValue}>{metaB.cfgScale ?? '—'}</span>
                </div>
                <div className={`${styles.paramCard} ${isDiff(metaA.seed, metaB.seed) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>Seed</span>
                  <span className={styles.paramValue}>{metaB.seed ?? '—'}</span>
                </div>
                <div className={`${styles.paramCard} ${isDiff(metaA.width, metaB.width) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>Dimensions</span>
                  <span className={styles.paramValue}>{itemB.dimensions || '1024 × 1024'}</span>
                </div>
              </div>

              {/* LoRA List B */}
              <div className={styles.diffSection}>
                <span className={styles.sectionLabel}>LoRAs ({metaB.loras?.length || 0})</span>
                <div className={styles.loraList}>
                  {metaB.loras && metaB.loras.length > 0 ? (
                    metaB.loras.map((l: LoraReference, i: number) => (
                      <div key={i} className={styles.loraTag}>
                        <span>{l.resolved?.name || l.rawName}</span>
                        <span className={styles.loraWeight}>{l.strength ?? 0.8}</span>
                      </div>
                    ))
                  ) : (
                    <span className={styles.emptyText}>No LoRAs used</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <SecondaryButton onClick={onClose}>Close Comparison</SecondaryButton>
        </div>
      </div>
    </div>
  );
};
