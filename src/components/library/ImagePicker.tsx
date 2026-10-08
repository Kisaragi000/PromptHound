import React, { useRef, useState } from 'react';
import { ImageIcon, PlusIcon, StarIcon, CloseIcon } from '../icons/Icons.js';
import { isImageFile } from '../../utils/libraryImages.js';
import { useT } from '../../i18n/index.js';
import styles from './ImagePicker.module.css';

export interface PickerImage {
  id: string;
  /** What the tile shows (blob: preview or stored thumbnail) */
  previewUrl: string;
  name?: string;
}

interface ImagePickerProps {
  images: PickerImage[];
  max: number;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onMakeCover: (id: string) => void;
  busy?: boolean;
  /** Short hint under the tiles */
  hint?: string;
}

/** Image tiles with add (click, drop or paste), remove and "make cover" */
export const ImagePicker: React.FC<ImagePickerProps> = ({ images, max, onAdd, onRemove, onMakeCover, busy, hint }) => {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const room = max - images.length;
  const addLabel = busy ? t('images.adding') : images.length ? t('images.addMore') : t('images.add');

  const add = (files: File[]) => {
    const accepted = files.filter(isImageFile).slice(0, Math.max(0, room));
    if (accepted.length) onAdd(accepted);
  };

  return (
    <div
      className={`${styles.picker} ${dragOver ? styles.dragOver : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (room > 0) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        // Handled here, not by the app-wide drop (which would start an extraction)
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        add(Array.from(e.dataTransfer.files));
      }}
      onPaste={(e) => {
        const files = Array.from(e.clipboardData.files);
        if (files.length) {
          e.preventDefault();
          add(files);
        }
      }}
    >
      <div className={styles.header}>
        <span className={styles.label}>
          <ImageIcon size={14} /> {t('images.label')}
        </span>
        <span className={styles.count}>
          {images.length} / {max}
        </span>
      </div>

      <div className={styles.tiles}>
        {images.map((img, i) => (
          <div key={img.id} className={`${styles.tile} ${i === 0 ? styles.cover : ''}`} title={img.name}>
            <img src={img.previewUrl} alt={img.name || t('images.imageN', { n: i + 1 })} />
            {i === 0 ? (
              <span className={styles.coverBadge}>{t('images.cover')}</span>
            ) : (
              <button type="button" className={styles.tileBtn} onClick={() => onMakeCover(img.id)} title={t('images.makeCoverTitle')} aria-label={t('images.makeCover')}>
                <StarIcon size={12} />
              </button>
            )}
            <button
              type="button"
              className={`${styles.tileBtn} ${styles.removeBtn}`}
              onClick={() => onRemove(img.id)}
              title={t('images.remove')}
              aria-label={t('images.remove')}
            >
              <CloseIcon size={12} />
            </button>
          </div>
        ))}

        {room > 0 && (
          <button
            type="button"
            className={styles.addTile}
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            title={addLabel}
            aria-label={addLabel}
          >
            {busy ? <span className={styles.spinner} /> : <PlusIcon size={18} />}
            <span className={styles.addLabel}>{addLabel}</span>
          </button>
        )}
      </div>

      <p className={styles.hint}>
        {hint ?? t('images.hint', { max })}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.jfif,.webp,.avif,.gif,image/*"
        multiple
        hidden
        onChange={(e) => {
          add(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
    </div>
  );
};
