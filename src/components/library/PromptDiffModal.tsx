import React from 'react';
import type { SavedPromptItem, LoraReference } from '../../../core/types.js';
import { EyeIcon, SparklesIcon, CheckIcon, CopyIcon } from '../icons/Icons.js';
import { SecondaryButton } from '../primitives/SecondaryButton.js';
import { PrimaryButton } from '../primitives/PrimaryButton.js';
import { useT } from '../../i18n/index.js';
import { folderLabel, formatItemDate } from '../../i18n/labels.js';
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
  const t = useT();
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
            <h3 className={styles.title}>{t('diff.title')}</h3>
            <p className={styles.subtitle}>{t('diff.subtitle')}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            {t('diff.close')}
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
                  <span className={styles.itemSub}>{itemA.folder ? folderLabel(itemA.folder) : t('folder.unfiled')} · {formatItemDate(itemA.date)}</span>
                </div>
              </div>

              <div className={styles.diffSection}>
                <span className={styles.sectionLabel}>{t('param.positivePrompt')}</span>
                <div className={`${styles.textBox} ${isDiff(metaA.prompt, metaB.prompt) ? styles.textDiff : ''}`}>
                  {metaA.prompt || t('param.emptyPrompt')}
                </div>
              </div>

              {metaA.negativePrompt && (
                <div className={styles.diffSection}>
                  <span className={styles.sectionLabel}>{t('param.negativePrompt')}</span>
                  <div className={`${styles.textBox} ${isDiff(metaA.negativePrompt, metaB.negativePrompt) ? styles.textDiff : ''}`}>
                    {metaA.negativePrompt}
                  </div>
                </div>
              )}

              <div className={styles.paramsGrid}>
                <div className={`${styles.paramCard} ${isDiff(metaA.model, metaB.model) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>{t('param.model')}</span>
                  <span className={styles.paramValue}>{metaA.model || itemA.model || '—'}</span>
                </div>
                <div className={`${styles.paramCard} ${isDiff(metaA.sampler, metaB.sampler) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>{t('param.sampler')}</span>
                  <span className={styles.paramValue}>{metaA.sampler || '—'}</span>
                </div>
                <div className={`${styles.paramCard} ${isDiff(metaA.steps, metaB.steps) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>{t('param.steps')}</span>
                  <span className={styles.paramValue}>{metaA.steps ?? '—'}</span>
                </div>
                <div className={`${styles.paramCard} ${isDiff(metaA.cfgScale, metaB.cfgScale) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>{t('param.cfgScale')}</span>
                  <span className={styles.paramValue}>{metaA.cfgScale ?? '—'}</span>
                </div>
                <div className={`${styles.paramCard} ${isDiff(metaA.seed, metaB.seed) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>{t('param.seed')}</span>
                  <span className={styles.paramValue}>{metaA.seed ?? '—'}</span>
                </div>
                <div className={`${styles.paramCard} ${isDiff(metaA.width, metaB.width) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>{t('param.dimensions')}</span>
                  <span className={styles.paramValue}>{itemA.dimensions || '1024 × 1024'}</span>
                </div>
              </div>

              {/* LoRA List A */}
              <div className={styles.diffSection}>
                <span className={styles.sectionLabel}>{t('param.loras', { count: metaA.loras?.length || 0 })}</span>
                <div className={styles.loraList}>
                  {metaA.loras && metaA.loras.length > 0 ? (
                    metaA.loras.map((l: LoraReference, i: number) => (
                      <div key={i} className={styles.loraTag}>
                        <span>{l.resolved?.name || l.rawName}</span>
                        <span className={styles.loraWeight}>{l.strength ?? 0.8}</span>
                      </div>
                    ))
                  ) : (
                    <span className={styles.emptyText}>{t('diff.noLoras')}</span>
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
                  <span className={styles.itemSub}>{itemB.folder ? folderLabel(itemB.folder) : t('folder.unfiled')} · {formatItemDate(itemB.date)}</span>
                </div>
              </div>

              <div className={styles.diffSection}>
                <span className={styles.sectionLabel}>{t('param.positivePrompt')}</span>
                <div className={`${styles.textBox} ${isDiff(metaA.prompt, metaB.prompt) ? styles.textDiff : ''}`}>
                  {metaB.prompt || t('param.emptyPrompt')}
                </div>
              </div>

              {metaB.negativePrompt && (
                <div className={styles.diffSection}>
                  <span className={styles.sectionLabel}>{t('param.negativePrompt')}</span>
                  <div className={`${styles.textBox} ${isDiff(metaA.negativePrompt, metaB.negativePrompt) ? styles.textDiff : ''}`}>
                    {metaB.negativePrompt}
                  </div>
                </div>
              )}

              <div className={styles.paramsGrid}>
                <div className={`${styles.paramCard} ${isDiff(metaA.model, metaB.model) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>{t('param.model')}</span>
                  <span className={styles.paramValue}>{metaB.model || itemB.model || '—'}</span>
                </div>
                <div className={`${styles.paramCard} ${isDiff(metaA.sampler, metaB.sampler) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>{t('param.sampler')}</span>
                  <span className={styles.paramValue}>{metaB.sampler || '—'}</span>
                </div>
                <div className={`${styles.paramCard} ${isDiff(metaA.steps, metaB.steps) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>{t('param.steps')}</span>
                  <span className={styles.paramValue}>{metaB.steps ?? '—'}</span>
                </div>
                <div className={`${styles.paramCard} ${isDiff(metaA.cfgScale, metaB.cfgScale) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>{t('param.cfgScale')}</span>
                  <span className={styles.paramValue}>{metaB.cfgScale ?? '—'}</span>
                </div>
                <div className={`${styles.paramCard} ${isDiff(metaA.seed, metaB.seed) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>{t('param.seed')}</span>
                  <span className={styles.paramValue}>{metaB.seed ?? '—'}</span>
                </div>
                <div className={`${styles.paramCard} ${isDiff(metaA.width, metaB.width) ? styles.paramDiff : ''}`}>
                  <span className={styles.paramLabel}>{t('param.dimensions')}</span>
                  <span className={styles.paramValue}>{itemB.dimensions || '1024 × 1024'}</span>
                </div>
              </div>

              {/* LoRA List B */}
              <div className={styles.diffSection}>
                <span className={styles.sectionLabel}>{t('param.loras', { count: metaB.loras?.length || 0 })}</span>
                <div className={styles.loraList}>
                  {metaB.loras && metaB.loras.length > 0 ? (
                    metaB.loras.map((l: LoraReference, i: number) => (
                      <div key={i} className={styles.loraTag}>
                        <span>{l.resolved?.name || l.rawName}</span>
                        <span className={styles.loraWeight}>{l.strength ?? 0.8}</span>
                      </div>
                    ))
                  ) : (
                    <span className={styles.emptyText}>{t('diff.noLoras')}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <SecondaryButton onClick={onClose}>{t('diff.closeComparison')}</SecondaryButton>
        </div>
      </div>
    </div>
  );
};
