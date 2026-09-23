import React, { useRef, useEffect } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  CloseIcon,
  CheckIcon,
  BookmarkIcon,
} from '../icons/Icons.js';
import { useExtraction, type SessionImageItem } from '../../extraction/ExtractionContext.js';
import { useNavigation } from '../../navigation/NavigationContext.js';
import styles from './MultiImageSessionStrip.module.css';

export const MultiImageSessionStrip: React.FC = () => {
  const {
    sessionImages,
    activeImageIndex,
    setActiveImageIndex,
    addSessionImages,
    removeSessionImage,
  } = useExtraction();

  const { saveToLibrary } = useNavigation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savedAllCount, setSavedAllCount] = React.useState<number | null>(null);

  // Keyboard navigation support: Left / Right arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          (activeElement as HTMLElement).isContentEditable)
      ) {
        return;
      }

      if (sessionImages.length <= 1) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveImageIndex(Math.max(0, activeImageIndex - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveImageIndex(Math.min(sessionImages.length - 1, activeImageIndex + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sessionImages.length, activeImageIndex, setActiveImageIndex]);

  if (sessionImages.length <= 1 && sessionImages.length === 0) {
    return null;
  }

  const handleAddClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await addSessionImages(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleSaveAll = () => {
    let count = 0;
    sessionImages.forEach((item) => {
      if (item.status === 'success' && item.result?.metadata) {
        const meta = item.result.metadata;
        const title =
          meta.prompt?.split(/,|\n/)[0]?.trim()?.slice(0, 36) ||
          meta.model ||
          item.label ||
          'AI Generation';
        const dimensions =
          meta.width && meta.height ? `${meta.width} × ${meta.height}` : '1024 × 1024';

        saveToLibrary({
          title,
          folder: 'Batch Imports',
          source: 'Local File',
          model: meta.model || 'Stable Diffusion',
          dimensions,
          isFavorite: false,
          thumbnailUrl: item.previewUrl,
          metadata: meta,
        });
        count++;
      }
    });

    setSavedAllCount(count);
    setTimeout(() => setSavedAllCount(null), 3000);
  };

  return (
    <div className={styles.sessionContainer}>
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept="image/png,image/webp,image/jpeg,image/jfif,image/avif"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* Header bar */}
      <div className={styles.sessionHeader}>
        <div className={styles.sessionTitleWrap}>
          <span>Batch Previews</span>
          <span className={styles.sessionBadge}>
            {activeImageIndex + 1} / {sessionImages.length}
          </span>
        </div>

        <div className={styles.sessionActions}>
          <button
            type="button"
            className={styles.navArrowBtn}
            onClick={() => setActiveImageIndex(Math.max(0, activeImageIndex - 1))}
            disabled={activeImageIndex === 0}
            title="Previous image (Left Arrow)"
          >
            <ChevronLeftIcon size={14} />
          </button>
          <button
            type="button"
            className={styles.navArrowBtn}
            onClick={() =>
              setActiveImageIndex(Math.min(sessionImages.length - 1, activeImageIndex + 1))
            }
            disabled={activeImageIndex === sessionImages.length - 1}
            title="Next image (Right Arrow)"
          >
            <ChevronRightIcon size={14} />
          </button>
          {sessionImages.length < 10 && (
            <button
              type="button"
              className={styles.addBtnSmall}
              onClick={handleAddClick}
              title="Add more images to this session"
            >
              <PlusIcon size={12} /> Add
            </button>
          )}
        </div>
      </div>

      {/* Thumbnail Matrix: 5 per row, up to 10 total */}
      <div className={styles.thumbnailGrid}>
        {sessionImages.map((item, idx) => {
          const isActive = idx === activeImageIndex;
          return (
            <div
              key={item.id}
              className={`${styles.thumbCard} ${isActive ? styles.thumbCardActive : ''}`}
              onClick={() => setActiveImageIndex(idx)}
              title={`${item.label} (${idx + 1}/${sessionImages.length})`}
            >
              <img src={item.previewUrl} alt={item.label} className={styles.thumbImg} />

              {/* Index number */}
              <span className={styles.indexPill}>{idx + 1}</span>

              {/* Status indicator */}
              <div className={styles.statusOverlay}>
                {item.status === 'parsing' && <div className={styles.loadingSpinner} />}
                {item.status === 'error' && <div className={styles.errorDot} />}
              </div>

              {/* Dismiss / Delete button */}
              {sessionImages.length > 1 && (
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSessionImage(item.id);
                  }}
                  title="Remove from session"
                >
                  <CloseIcon size={10} />
                </button>
              )}
            </div>
          );
        })}

        {/* Plus Slot if under 10 */}
        {sessionImages.length < 10 && (
          <div
            className={styles.addSlotCard}
            onClick={handleAddClick}
            title="Add another image (up to 10)"
          >
            <PlusIcon size={16} />
            <span>Add</span>
          </div>
        )}
      </div>

      {/* Footer bar with Save All & Shortcut hint */}
      <div className={styles.saveAllRow}>
        <span className={styles.hintText}>Use ← / → keys to switch</span>
        <button type="button" className={styles.saveAllBtn} onClick={handleSaveAll}>
          <BookmarkIcon size={13} />
          {savedAllCount !== null ? `Saved ${savedAllCount} to Library!` : 'Save All to Library'}
        </button>
      </div>
    </div>
  );
};
