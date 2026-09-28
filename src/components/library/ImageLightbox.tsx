import React, { useEffect, useState } from 'react';
import type { LibraryImage } from '../../../core/types.js';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '../icons/Icons.js';
import styles from './ImageLightbox.module.css';

interface ImageLightboxProps {
  images: LibraryImage[];
  startIndex?: number;
  title: string;
  onClose: () => void;
}

/** Full-size view of an item's images; ← → switch, Esc closes */
export const ImageLightbox: React.FC<ImageLightboxProps> = ({ images, startIndex = 0, title, onClose }) => {
  const [index, setIndex] = useState(startIndex);
  const count = images.length;
  const go = (next: number) => setIndex((next + count) % count);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (count > 1 && e.key === 'ArrowLeft') go(index - 1);
      if (count > 1 && e.key === 'ArrowRight') go(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const image = images[index];
  if (!image) return null;

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={`${title}: image ${index + 1} of ${count}`}>
      <img src={image.url} alt={`${title} (${index + 1} of ${count})`} className={styles.image} onClick={(e) => e.stopPropagation()} />
      <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
        <CloseIcon size={18} />
      </button>
      {count > 1 && (
        <>
          <button type="button" className={`${styles.arrow} ${styles.left}`} onClick={(e) => { e.stopPropagation(); go(index - 1); }} aria-label="Previous image">
            <ChevronLeftIcon size={22} />
          </button>
          <button type="button" className={`${styles.arrow} ${styles.right}`} onClick={(e) => { e.stopPropagation(); go(index + 1); }} aria-label="Next image">
            <ChevronRightIcon size={22} />
          </button>
          <div className={styles.counter}>
            {index + 1} / {count}
          </div>
        </>
      )}
    </div>
  );
};
