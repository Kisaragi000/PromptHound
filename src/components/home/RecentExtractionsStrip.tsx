import React from 'react';
import type { SavedPromptItem } from '../../../core/types.js';
import { EyeIcon, SparklesIcon, ClockIcon } from '../icons/Icons.js';
import styles from './RecentExtractionsStrip.module.css';

interface RecentExtractionsStripProps {
  items: SavedPromptItem[];
  onSelect: (item: SavedPromptItem) => void;
}

export const RecentExtractionsStrip: React.FC<RecentExtractionsStripProps> = ({
  items,
  onSelect,
}) => {
  if (!items || items.length === 0) return null;

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <ClockIcon size={16} />
          <h3 className={styles.title}>Recent Recipes & Extractions</h3>
        </div>
        <span className={styles.subtitle}>Click to instantly reload full metadata recipe</span>
      </div>

      <div className={styles.strip}>
        {items.slice(0, 6).map((item) => (
          <div
            key={item.id}
            className={styles.card}
            onClick={() => onSelect(item)}
            title={`Inspect recipe: ${item.title}`}
          >
            <div className={styles.thumbWrap}>
              <img src={item.thumbnailUrl} alt={item.title} className={styles.thumb} />
              <div className={styles.hoverOverlay}>
                <EyeIcon size={16} />
              </div>
            </div>
            <div className={styles.cardInfo}>
              <div className={styles.cardTitle}>{item.title}</div>
              <div className={styles.cardSub}>
                <span>{item.model || 'SDXL'}</span>
                {item.metadata?.loras && item.metadata.loras.length > 0 && (
                  <span className={styles.loraBadge}>
                    +{item.metadata.loras.length} LoRA
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
