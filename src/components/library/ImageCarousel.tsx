import React, { useEffect, useState } from 'react';
import type { LibraryImage } from '../../../core/types.js';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons/Icons.js';
import { useT } from '../../i18n/index.js';
import styles from './ImageCarousel.module.css';

interface ImageCarouselProps {
  images: LibraryImage[];
  alt: string;
  /** Show the full-size files instead of thumbnails (detail pane) */
  useFullSize?: boolean;
  /** Left / right arrow keys switch images while this is true */
  keyboard?: boolean;
  className?: string;
  imageClassName?: string;
  onIndexChange?: (index: number) => void;
  /** Overlays (favorite star, badges) drawn above the images */
  children?: React.ReactNode;
}

/**
 * Image area of a library item: one image, or several with ‹ › arrows and dots.
 * Clicks on the controls do not reach the card underneath (selecting / opening it).
 */
export const ImageCarousel: React.FC<ImageCarouselProps> = ({
  images,
  alt,
  useFullSize = false,
  keyboard = false,
  className = '',
  imageClassName = '',
  onIndexChange,
  children,
}) => {
  const t = useT();
  const [index, setIndex] = useState(0);
  const count = images.length;
  const current = Math.min(index, Math.max(0, count - 1));

  // A different item (or fewer images) starts at the cover again
  const key = images.map((i) => i.thumbUrl).join('|');
  useEffect(() => setIndex(0), [key]);

  const go = (next: number) => {
    const wrapped = (next + count) % count;
    setIndex(wrapped);
    onIndexChange?.(wrapped);
  };

  useEffect(() => {
    if (!keyboard || count < 2) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      if (e.key === 'ArrowLeft') go(current - 1);
      if (e.key === 'ArrowRight') go(current + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const image = images[current];

  return (
    <div className={`${styles.carousel} ${className}`}>
      {image ? (
        <img
          src={useFullSize ? image.url : image.thumbUrl}
          alt={count > 1 ? t('images.nOfCount', { alt, n: current + 1, count }) : alt}
          className={`${styles.image} ${imageClassName}`}
          draggable={false}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className={styles.empty}>{t('images.none')}</div>
      )}

      {count > 1 && (
        <>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowLeft}`}
            onClick={(e) => {
              stop(e);
              go(current - 1);
            }}
            onDoubleClick={stop}
            aria-label={t('common.previousImage')}
          >
            <ChevronLeftIcon size={16} />
          </button>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowRight}`}
            onClick={(e) => {
              stop(e);
              go(current + 1);
            }}
            onDoubleClick={stop}
            aria-label={t('common.nextImage')}
          >
            <ChevronRightIcon size={16} />
          </button>
          <div className={styles.dots} onClick={stop} onDoubleClick={stop}>
            {images.map((img, i) => (
              <button
                key={`${img.thumbUrl}-${i}`}
                type="button"
                className={`${styles.dot} ${i === current ? styles.dotActive : ''}`}
                onClick={() => go(i)}
                aria-label={t('images.show', { n: i + 1, count })}
                aria-current={i === current}
              />
            ))}
          </div>
        </>
      )}
      {children}
    </div>
  );
};
