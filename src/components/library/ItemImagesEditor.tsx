import React, { useState } from 'react';
import type { LibraryImage, SavedPromptItem } from '../../../core/types.js';
import { MAX_LIBRARY_IMAGES } from '../../../core/types.js';
import { deleteLibraryImages, itemImages, storeLibraryImage } from '../../utils/libraryImages.js';
import { ImagePicker } from './ImagePicker.js';
import { useT } from '../../i18n/index.js';

interface ItemImagesEditorProps {
  item: SavedPromptItem;
  onChange: (updates: Partial<SavedPromptItem>) => void;
}

/** Add, remove and reorder the images of a saved prompt (Library detail pane) */
export const ItemImagesEditor: React.FC<ItemImagesEditorProps> = ({ item, onChange }) => {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const images = itemImages(item);

  const commit = (next: LibraryImage[]) => onChange({ images: next, thumbnailUrl: next[0]?.thumbUrl ?? '' });

  const handleAdd = async (files: File[]) => {
    setBusy(true);
    setError(null);
    try {
      const added: LibraryImage[] = [];
      for (const file of files) {
        const stored = await storeLibraryImage(item.id, file, file.name);
        if (stored) added.push(stored);
      }
      if (added.length < files.length) setError(t('images.someUnreadable'));
      if (added.length) commit([...images, ...added].slice(0, MAX_LIBRARY_IMAGES));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('images.addFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = (key: string) => {
    const gone = images.find((img) => img.thumbUrl === key);
    if (!gone) return;
    deleteLibraryImages([gone]);
    commit(images.filter((img) => img !== gone));
  };

  const handleMakeCover = (key: string) => {
    const chosen = images.find((img) => img.thumbUrl === key);
    if (chosen) commit([chosen, ...images.filter((img) => img !== chosen)]);
  };

  return (
    <div>
      <ImagePicker
        images={images.map((img) => ({ id: img.thumbUrl, previewUrl: img.thumbUrl, name: img.name }))}
        max={MAX_LIBRARY_IMAGES}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onMakeCover={handleMakeCover}
        busy={busy}
        hint={t('images.editHint')}
      />
      {error && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#fca5a5' }}>{error}</p>}
    </div>
  );
};
