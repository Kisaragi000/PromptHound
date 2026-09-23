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
            <span>Batch Queue ({items.length}/10 max)</span>
          </div>
          <span className={styles.progressText}>
            {successCount} of {items.length} parsed successfully
          </span>
        </div>

        <div className={styles.headerActions}>
          <SecondaryButton onClick={onClearAll} icon={<TrashIcon size={14} />}>
            Clear Queue
          </SecondaryButton>
          <PrimaryButton
            onClick={onSaveAllToLibrary}
            disabled={successCount === 0 || isSavingAll}
            icon={saveFeedback ? <CheckIcon size={14} color="#4ade80" /> : <BookmarkIcon size={14} />}
          >
            {isSavingAll ? 'Saving All…' : saveFeedback ?? `Save All (${successCount}) to Library`}
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
                  <div className={styles.overlayError} title={item.error || 'No metadata found'}>
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
                    ? 'Extracting…'
                    : item.status === 'success'
                    ? `${item.metadata?.model || 'Parsed'} · ${item.metadata?.loras?.length || 0} LoRA`
                    : 'No metadata'}
                </div>
              </div>

              <div className={styles.cardActions}>
                <IconButton
                  title="Remove from queue"
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
