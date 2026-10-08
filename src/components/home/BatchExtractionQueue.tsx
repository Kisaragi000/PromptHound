import React, { useState } from 'react';
import type { ExtractedMetadata } from '../../../core/types.js';
import {
  CheckIcon,
  TrashIcon,
  BookmarkIcon,
  EyeIcon,
  SparklesIcon,
  CloudUploadIcon,
} from '../icons/Icons.js';
import { PrimaryButton } from '../primitives/PrimaryButton.js';
import { SecondaryButton } from '../primitives/SecondaryButton.js';
import { IconButton } from '../primitives/IconButton.js';
import { useT } from '../../i18n/index.js';
import styles from './BatchExtractionQueue.module.css';

export interface BatchItem {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'parsing' | 'success' | 'error';
  metadata?: ExtractedMetadata;
  error?: string;
}

interface BatchExtractionQueueProps {
  items: BatchItem[];
  onSelectInspect: (item: BatchItem) => void;
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  onSaveAllToLibrary: () => void;
  isSavingAll: boolean;
  saveFeedback: string | null;
}

export const BatchExtractionQueue: React.FC<BatchExtractionQueueProps> = ({
  items,
  onSelectInspect,
  onRemoveItem,
  onClearAll,
  onSaveAllToLibrary,
  isSavingAll,
  saveFeedback,
}) => {
  const t = useT();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(items[0]?.id || null);

  const successCount = items.filter((i) => i.status === 'success').length;
  const isAllDone = items.every((i) => i.status === 'success' || i.status === 'error');

  const activeItem = items.find((i) => i.id === selectedItemId) || items[0];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.badge}>
            <CloudUploadIcon size={14} />
            <span>{t('batch.queue', { count: items.length })}</span>
          </div>
          <span className={styles.progressText}>
            {t('batch.progress', { done: successCount, total: items.length })}
          </span>
        </div>

        <div className={styles.headerActions}>
          <SecondaryButton onClick={onClearAll} icon={<TrashIcon size={14} />}>
            {t('batch.clear')}
          </SecondaryButton>
          <PrimaryButton
            onClick={onSaveAllToLibrary}
            disabled={successCount === 0 || isSavingAll}
            icon={saveFeedback ? <CheckIcon size={14} color="#4ade80" /> : <BookmarkIcon size={14} />}
          >
            {isSavingAll ? t('batch.savingAll') : saveFeedback ?? t('batch.saveAll', { count: successCount })}
          </PrimaryButton>
        </div>
      </div>

      {/* Grid of batch thumbnails */}
      <div className={styles.queueGrid}>
        {items.map((item, idx) => {
          const isSelected = activeItem?.id === item.id;
          return (
            <div
              key={item.id}
              className={`${styles.queueCard} ${isSelected ? styles.queueCardActive : ''}`}
              onClick={() => {
                setSelectedItemId(item.id);
                if (item.status === 'success') {
                  onSelectInspect(item);
                }
              }}
            >
              <div className={styles.thumbWrap}>
                <img src={item.previewUrl} alt={item.file.name} className={styles.thumb} />
                <span className={styles.itemIndex}>#{idx + 1}</span>

                {item.status === 'parsing' && (
                  <div className={styles.overlayLoading}>
                    <div className={styles.spinner} />
                  </div>
                )}
                {item.status === 'success' && (
                  <div className={styles.overlaySuccess}>
                    <CheckIcon size={12} color="#fff" />
                  </div>
                )}
                {item.status === 'error' && (
                  <div className={styles.overlayError} title={item.error || t('batch.noMetadata')}>
                    ✕
                  </div>
                )}
              </div>

              <div className={styles.cardInfo}>
                <div className={styles.cardName} title={item.file.name}>
                  {item.file.name}
                </div>
                <div className={styles.cardSub}>
                  {item.status === 'parsing'
                    ? t('batch.extracting')
                    : item.status === 'success'
                    ? `${item.metadata?.model || t('batch.parsed')} · ${item.metadata?.loras?.length || 0} LoRA`
                    : t('batch.noMetadataShort')}
                </div>
              </div>

              <div className={styles.cardActions}>
                <IconButton
                  title={t('batch.remove')}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveItem(item.id);
                  }}
                >
                  <TrashIcon size={13} />
                </IconButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
