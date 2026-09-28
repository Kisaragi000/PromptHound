import React, { useEffect, useRef, useState } from 'react';
import type { ExtractedMetadata, SavedPromptItem } from '../../../core/types.js';
import { MAX_LIBRARY_IMAGES } from '../../../core/types.js';
import { useNavigation } from '../../navigation/NavigationContext.js';
import { storeLibraryImage } from '../../utils/libraryImages.js';
import { recipeTitle } from '../../utils/recipeTitle.js';
import { FolderIcon, PlusIcon, SparklesIcon } from '../icons/Icons.js';
import { Dropdown } from '../primitives/Dropdown.js';
import { GlassInput } from '../primitives/GlassInput.js';
import { PrimaryButton } from '../primitives/PrimaryButton.js';
import { SecondaryButton } from '../primitives/SecondaryButton.js';
import { ImagePicker, type PickerImage } from './ImagePicker.js';
import pageStyles from '../../pages/PromptLibraryPage.module.css';
import styles from './NewPromptModal.module.css';

interface NewPromptModalProps {
  defaultFolder: string;
  onClose: () => void;
  onSaved: (item: SavedPromptItem) => void;
}

interface DraftImage extends PickerImage {
  file: File;
}

const EMPTY_FORM = {
  title: '',
  prompt: '',
  negativePrompt: '',
  model: '',
  sampler: '',
  steps: '',
  cfgScale: '',
  seed: '',
};
type FormState = typeof EMPTY_FORM;

const NEW_FOLDER = '__new_folder__';

/** Reads generation data from an image, or null when it has none */
async function readImageMetadata(file: File): Promise<ExtractedMetadata | null> {
  try {
    const { extractFromImageBuffer } = await import('../../../core/link-fetch.js');
    const result = await extractFromImageBuffer(new Uint8Array(await file.arrayBuffer()), { kind: 'file', label: file.name });
    return 'metadata' in result ? result.metadata : null;
  } catch {
    return null;
  }
}

async function imageSize(url: string): Promise<{ width: number; height: number } | null> {
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return null;
  }
}

/** "Save Custom Prompt Recipe": a prompt typed by hand, with up to five images */
export const NewPromptModal: React.FC<NewPromptModalProps> = ({ defaultFolder, onClose, onSaved }) => {
  const { folders, addFolder, saveToLibrary } = useNavigation();
  const folderOptions = folders.filter((f) => f !== 'All Prompts');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [folder, setFolder] = useState(folderOptions.includes(defaultFolder) ? defaultFolder : folderOptions[0] ?? 'My Creations');
  const [newFolderName, setNewFolderName] = useState<string | null>(null);
  const [images, setImages] = useState<DraftImage[]>([]);
  const [extracted, setExtracted] = useState<ExtractedMetadata | null>(null);
  const [autofillNote, setAutofillNote] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const formRef = useRef(form);
  formRef.current = form;
  const imagesRef = useRef(images);
  imagesRef.current = images;

  // Free the image previews when the dialog closes
  useEffect(() => () => imagesRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  /** Fills only the fields that are still empty from the first image with generation data */
  const autofillFrom = (meta: ExtractedMetadata, fileName: string) => {
    const current = formRef.current;
    const candidates: Partial<FormState> = {
      prompt: meta.prompt || '',
      negativePrompt: meta.negativePrompt || '',
      model: meta.model || '',
      sampler: meta.sampler || '',
      steps: meta.steps !== undefined ? String(meta.steps) : '',
      cfgScale: meta.cfgScale !== undefined ? String(meta.cfgScale) : '',
      seed: meta.seed !== undefined ? String(meta.seed) : '',
      title: recipeTitle(meta.prompt),
    };
    const filled: string[] = [];
    const next = { ...current };
    for (const [key, value] of Object.entries(candidates) as Array<[keyof FormState, string]>) {
      if (value && !current[key].trim()) {
        next[key] = value;
        // cfg and seed have no field in this dialog; they are kept but not counted
        if (key !== 'cfgScale' && key !== 'seed') filled.push(key);
      }
    }
    setForm(next);
    setExtracted(meta);
    setAutofillNote(
      filled.length
        ? `Filled ${filled.length} empty ${filled.length === 1 ? 'field' : 'fields'} from ${fileName}.`
        : `${fileName} has generation data; your entries were kept.`
    );
  };

  const handleAdd = async (files: File[]) => {
    const added: DraftImage[] = files.map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
    }));
    setImages((prev) => [...prev, ...added].slice(0, MAX_LIBRARY_IMAGES));
    if (extracted) return;
    setReading(true);
    try {
      for (const img of added) {
        const meta = await readImageMetadata(img.file);
        if (meta) {
          autofillFrom(meta, img.name ?? 'the image');
          return;
        }
      }
      setAutofillNote((note) => note ?? 'No generation data in these images; fill in the fields by hand.');
    } finally {
      setReading(false);
    }
  };

  const handleRemove = (id: string) => {
    setImages((prev) => {
      const gone = prev.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleMakeCover = (id: string) =>
    setImages((prev) => {
      const chosen = prev.find((i) => i.id === id);
      return chosen ? [chosen, ...prev.filter((i) => i.id !== id)] : prev;
    });

  const targetFolder = newFolderName !== null ? newFolderName.trim() : folder;
  const canSave = Boolean(form.title.trim()) && Boolean(targetFolder) && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      const id = `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const stored = [];
      for (const img of images) {
        const saved = await storeLibraryImage(id, img.file, img.name);
        if (saved) stored.push(saved);
      }
      if (images.length && !stored.length) throw new Error('The images could not be saved.');

      const toNumber = (v: string) => (v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined);
      const size =
        extracted?.width && extracted?.height
          ? { width: extracted.width, height: extracted.height }
          : images[0]
          ? await imageSize(images[0].previewUrl)
          : null;
      if (newFolderName !== null) addFolder(targetFolder);

      const metadata: ExtractedMetadata = {
        ...(extracted ?? { loras: [], detectedFormat: 'unknown' as const }),
        prompt: form.prompt.trim(),
        negativePrompt: form.negativePrompt.trim() || undefined,
        model: form.model.trim() || undefined,
        sampler: form.sampler.trim() || undefined,
        steps: toNumber(form.steps),
        cfgScale: toNumber(form.cfgScale),
        seed: form.seed.trim() || undefined,
        width: size?.width,
        height: size?.height,
        loras: extracted?.loras ?? [],
      };

      const item = saveToLibrary({
        id,
        title: form.title.trim(),
        folder: targetFolder,
        source: 'Local File',
        model: metadata.model || 'Unknown model',
        dimensions: size ? `${size.width} × ${size.height}` : '—',
        isFavorite: false,
        thumbnailUrl: stored[0]?.thumbUrl ?? '',
        images: stored,
        metadata,
      });
      onSaved(item);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Saving failed.');
      setSaving(false);
    }
  };

  return (
    <div className={pageStyles.modalOverlay} onClick={() => !saving && onClose()}>
      <div
        className={`${pageStyles.modalCardLarge} ${styles.modal}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-prompt-title"
      >
        <h3 id="new-prompt-title" className={pageStyles.modalTitle}>
          Save Custom Prompt Recipe
        </h3>
        <form onSubmit={handleSubmit} className={pageStyles.modalForm}>
          <ImagePicker
            images={images}
            max={MAX_LIBRARY_IMAGES}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onMakeCover={handleMakeCover}
            busy={reading}
            hint={`Drop, paste or browse up to ${MAX_LIBRARY_IMAGES} images. If one has generation data, empty fields are filled from it.`}
          />
          {autofillNote && (
            <div className={styles.note}>
              <SparklesIcon size={13} /> {autofillNote}
            </div>
          )}

          <div className={pageStyles.formRow}>
            <div className={pageStyles.formField}>
              <label className={pageStyles.label} htmlFor="new-prompt-name">
                Recipe Title *
              </label>
              <GlassInput id="new-prompt-name" value={form.title} onChange={set('title')} placeholder="e.g., Neon Samurai Portrait" autoFocus required />
            </div>
            <div className={pageStyles.formField}>
              <span className={pageStyles.label}>Folder</span>
              {newFolderName === null ? (
                <Dropdown
                  value={folder}
                  ariaLabel="Folder"
                  options={[
                    ...folderOptions.map((f) => ({ value: f, label: f, icon: <FolderIcon size={14} /> })),
                    { value: NEW_FOLDER, label: 'New folder…', icon: <PlusIcon size={14} />, isAction: true },
                  ]}
                  onChange={(v) => (v === NEW_FOLDER ? setNewFolderName('') : setFolder(v))}
                />
              ) : (
                <div className={styles.newFolderRow}>
                  <GlassInput
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="New folder name"
                    aria-label="New folder name"
                    autoFocus
                  />
                  <button type="button" className={styles.linkBtn} onClick={() => setNewFolderName(null)}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={pageStyles.formField}>
            <label className={pageStyles.label} htmlFor="new-prompt-positive">
              Positive Prompt
            </label>
            <textarea id="new-prompt-positive" className={pageStyles.textarea} rows={3} value={form.prompt} onChange={set('prompt')} placeholder="Masterpiece, 8k portrait of..." />
          </div>

          <div className={pageStyles.formField}>
            <label className={pageStyles.label} htmlFor="new-prompt-negative">
              Negative Prompt
            </label>
            <textarea id="new-prompt-negative" className={pageStyles.textarea} rows={2} value={form.negativePrompt} onChange={set('negativePrompt')} placeholder="low quality, blurry, deformed..." />
          </div>

          <div className={pageStyles.formRow3}>
            <div className={pageStyles.formField}>
              <label className={pageStyles.label} htmlFor="new-prompt-model">
                Model Checkpoint
              </label>
              <GlassInput id="new-prompt-model" value={form.model} onChange={set('model')} placeholder="e.g., SDXL Base 1.0" />
            </div>
            <div className={pageStyles.formField}>
              <label className={pageStyles.label} htmlFor="new-prompt-sampler">
                Sampler
              </label>
              <GlassInput id="new-prompt-sampler" value={form.sampler} onChange={set('sampler')} placeholder="e.g., Euler a" />
            </div>
            <div className={pageStyles.formField}>
              <label className={pageStyles.label} htmlFor="new-prompt-steps">
                Steps
              </label>
              <GlassInput id="new-prompt-steps" type="number" min={1} value={form.steps} onChange={set('steps')} placeholder="e.g., 30" />
            </div>
          </div>

          {saveError && <div className={styles.error}>{saveError}</div>}

          <div className={pageStyles.modalActions}>
            <SecondaryButton type="button" onClick={onClose} disabled={saving}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={!canSave}>
              {saving ? 'Saving…' : 'Save Recipe'}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
};
