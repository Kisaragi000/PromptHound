import React from 'react';
import type { SavedPromptItem } from '../../../core/types.js';
import { EyeIcon, SparklesIcon, ClockIcon } from '../icons/Icons.js';
import { useT } from '../../i18n/index.js';
import styles from './RecentExtractionsStrip.module.css';

interface RecentExtractionsStripProps {
  items: SavedPromptItem[];
  onSelect: (item: SavedPromptItem) => void;
}

export const RecentExtractionsStrip: React.FC<RecentExtractionsStripProps> = ({
  items,
  onSelect,
}) => {
  const t = useT();
  if (!items || items.length === 0) return null;

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <ClockIcon size={16} />
          <h3 className={styles.title}>{t('home.recentTitle')}</h3>
        </div>
        <span className={styles.subtitle}>{t('home.recentSubtitle')}</span>
      </div>

      <div className={styles.strip}>
        {items.slice(0, 6).map((item) => (
          <div
            key={item.id}
            className={styles.card}
            onClick={() => onSelect(item)}
            title={t('home.recentInspect', { title: item.title })}
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
                <span className={styles.modelName} title={item.model || undefined}>{item.model || t('common.unknownModel')}</span>
                {item.metadata?.loras && item.metadata.loras.length > 0 && (
                  <span className={styles.loraBadge}>
                    {t('home.recentLoras', { count: item.metadata.loras.length })}
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
