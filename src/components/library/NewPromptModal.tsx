import React, { useEffect, useRef, useState } from 'react';
import type { ExtractedMetadata, LoraReference, SavedPromptItem } from '../../../core/types.js';
import { MAX_LIBRARY_IMAGES } from '../../../core/types.js';
import { useNavigation } from '../../navigation/NavigationContext.js';
import { storeLibraryImage } from '../../utils/libraryImages.js';
import { recipeTitle } from '../../utils/recipeTitle.js';
import { isSeaArtLink } from '../../../core/seaart.js';
import { CloseIcon, FolderIcon, LinkIcon, PlusIcon, SparklesIcon } from '../icons/Icons.js';
import { Dropdown } from '../primitives/Dropdown.js';
import { GlassInput } from '../primitives/GlassInput.js';
import { PrimaryButton } from '../primitives/PrimaryButton.js';
import { SecondaryButton } from '../primitives/SecondaryButton.js';
import { ImagePicker, type PickerImage } from './ImagePicker.js';
import pageStyles from '../../pages/PromptLibraryPage.module.css';
import { useT } from '../../i18n/index.js';
import { folderLabel } from '../../i18n/labels.js';
import styles from './NewPromptModal.module.css';

interface NewPromptModalProps {
  defaultFolder: string;
  onClose: () => void;
  onSaved: (item: SavedPromptItem) => void;
  /** Images to start with, e.g. the one whose extraction failed */
  initialFiles?: File[];
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

interface DraftLora {
  id: string;
  name: string;
  strength: string;
  /** Model page link pasted by the user; saved with the entry */
  link: string;
  linkOpen: boolean;
}

const newLoraRow = (name = '', strength = '1'): DraftLora => ({
  id: Math.random().toString(36).slice(2, 9),
  name,
  strength,
  link: '',
  linkOpen: false,
});

const isWebLink = (text: string) => /^https?:\/\/\S+$/i.test(text);

/** A web link on the clipboard, so the link button can paste it straight away */
async function clipboardLink(): Promise<string> {
  try {
    const text = (await withTimeout(navigator.clipboard.readText(), 1000, '')).trim();
    return isWebLink(text) ? text : '';
  } catch {
    return '';
  }
}

/** Link button that shows the model's link field; amber once a link is set */
const LinkButton: React.FC<{ active: boolean; label: string; onClick: () => void }> = ({ active, label, onClick }) => (
  <button
    type="button"
    className={`${styles.linkBtn} ${active ? styles.linkBtnActive : ''}`}
    onClick={onClick}
    title={label}
    aria-label={label}
  >
    <LinkIcon size={14} />
  </button>
);

/** Waits for a lookup at most `ms`, so saving never hangs on a slow network */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise.catch(() => fallback), new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

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
export const NewPromptModal: React.FC<NewPromptModalProps> = ({ defaultFolder, onClose, onSaved, initialFiles }) => {
  const t = useT();
  const { folders, addFolder, saveToLibrary } = useNavigation();
  const folderOptions = folders.filter((f) => f !== 'All Prompts');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [folder, setFolder] = useState(folderOptions.includes(defaultFolder) ? defaultFolder : folderOptions[0] ?? 'My Creations');
  const [newFolderName, setNewFolderName] = useState<string | null>(null);
  const [images, setImages] = useState<DraftImage[]>([]);
  const [loras, setLoras] = useState<DraftLora[]>([]);
  const [extracted, setExtracted] = useState<ExtractedMetadata | null>(null);
  const [autofillNote, setAutofillNote] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const formRef = useRef(form);
  formRef.current = form;
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const lorasRef = useRef(loras);
  lorasRef.current = loras;

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
    if (meta.loras.length && !lorasRef.current.some((l) => l.name.trim())) {
      setLoras(meta.loras.map((l) => newLoraRow(l.rawName, l.strength !== undefined ? String(l.strength) : '1')));
    }
    setExtracted(meta);
    setAutofillNote(
      filled.length
        ? t('newPrompt.filled', { count: filled.length, file: fileName })
        : t('newPrompt.kept', { file: fileName })
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
          autofillFrom(meta, img.name ?? t('newPrompt.theImage'));
          return;
        }
      }
      setAutofillNote((note) => note ?? t('newPrompt.noData'));
    } finally {
      setReading(false);
    }
  };

  // Start with the given images (once; the dialog opens fresh each time)
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current || !initialFiles?.length) return;
    startedRef.current = true;
    void handleAdd(initialFiles);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateLora = (id: string, changes: Partial<DraftLora>) =>
    setLoras((prev) => prev.map((l) => (l.id === id ? { ...l, ...changes } : l)));
  const toggleLoraLink = async (l: DraftLora) => {
    if (l.linkOpen && !l.link) return updateLora(l.id, { linkOpen: false });
    updateLora(l.id, { linkOpen: true });
    if (l.link) return;
    const pasted = await clipboardLink();
    if (pasted) setLoras((prev) => prev.map((x) => (x.id === l.id && !x.link ? { ...x, link: pasted } : x)));
  };
  const [modelLink, setModelLink] = useState('');
  const [modelLinkOpen, setModelLinkOpen] = useState(false);
  const toggleModelLink = async () => {
    if (modelLinkOpen && !modelLink) return setModelLinkOpen(false);
    setModelLinkOpen(true);
    if (modelLink) return;
    const pasted = await clipboardLink();
    if (pasted) setModelLink((current) => current || pasted);
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
    const links = [modelLink, ...loras.map((l) => l.link)].map((x) => x.trim());
    if (links.some((x) => x && !isWebLink(x))) {
      setSaveError(t('newPrompt.linkInvalid'));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const id = `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const stored = [];
      for (const img of images) {
        const saved = await storeLibraryImage(id, img.file, img.name);
        if (saved) stored.push(saved);
      }
      if (images.length && !stored.length) throw new Error(t('newPrompt.imagesNotSaved'));

      const toNumber = (v: string) => (v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined);
      const size =
        extracted?.width && extracted?.height
          ? { width: extracted.width, height: extracted.height }
          : images[0]
          ? await imageSize(images[0].previewUrl)
          : null;
      if (newFolderName !== null) addFolder(targetFolder);

      // LoRAs typed by hand; ones that came from an image keep what was identified about them
      // A pasted link decides which model it is; otherwise the name is looked up
      const { resolveLoras, resolveBaseModel, resolveFromModelLink, withLinkOnly } = await import('../../../core/lora-resolution.js');
      const fromLink = async (ref: LoraReference, link: string, kind: 'lora' | 'checkpoint') => {
        const found = await withTimeout(resolveFromModelLink(ref, link, kind), 8000, withLinkOnly(ref, link));
        // SeaArt has no API: its page gives the model's name and cover
        const readPage = window.promptHound?.extraction?.modelPage;
        if (found.resolved?.source !== 'link' || !isSeaArtLink(link) || !readPage) return found;
        const page = await withTimeout(readPage(link), 9000, {});
        return {
          ...found,
          resolved: {
            ...found.resolved,
            name: page.name || found.resolved.name,
            coverImageUrl: page.coverImageUrl,
          },
        };
      };
      const loraDrafts = loras.filter((l) => l.name.trim() || l.link.trim());
      const loraRefs: LoraReference[] = loraDrafts.map((l) => {
        const rawName = l.name.trim();
        const fromImage = rawName ? extracted?.loras.find((x) => x.rawName === rawName) : undefined;
        return { ...fromImage, rawName, strength: toNumber(l.strength) };
      });
      const typedModel = form.model.trim() || undefined;
      const [resolvedLoras, modelResolved] = await Promise.all([
        Promise.all(
          loraRefs.map((ref, i) => {
            const link = loraDrafts[i].link.trim();
            if (link) return fromLink(ref, link, 'lora');
            return withTimeout(resolveLoras([ref]).then((r) => r[0] ?? ref), 8000, ref);
          })
        ),
        modelLink.trim()
          ? fromLink({ rawName: typedModel ?? '' }, modelLink.trim(), 'checkpoint').then((r) => r.resolved)
          : typedModel && typedModel !== extracted?.model
          ? withTimeout(resolveBaseModel({ model: typedModel }), 8000, undefined)
          : Promise.resolve(extracted?.modelResolved),
      ]);
      // A link with no name typed takes the name found for it
      for (const ref of resolvedLoras) {
        if (!ref.rawName) ref.rawName = ref.resolved?.name || ref.resolved?.modelUrl || '';
        if (ref.resolved && !ref.resolved.name) ref.resolved.name = ref.rawName;
      }
      const model = typedModel ?? (modelResolved?.name || undefined);
      if (modelResolved && !modelResolved.name) modelResolved.name = modelResolved.modelUrl;

      const metadata: ExtractedMetadata = {
        ...(extracted ?? { loras: [], detectedFormat: 'unknown' as const }),
        prompt: form.prompt.trim(),
        negativePrompt: form.negativePrompt.trim() || undefined,
        model,
        modelResolved,
        modelHash: model && model === extracted?.model ? extracted?.modelHash : undefined,
        sampler: form.sampler.trim() || undefined,
        steps: toNumber(form.steps),
        cfgScale: toNumber(form.cfgScale),
        seed: form.seed.trim() || undefined,
        width: size?.width,
        height: size?.height,
        loras: resolvedLoras,
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
      setSaveError(err instanceof Error ? err.message : t('newPrompt.saveFailed'));
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
          {t('newPrompt.title')}
        </h3>
        <form onSubmit={handleSubmit} className={pageStyles.modalForm}>
          <ImagePicker
            images={images}
            max={MAX_LIBRARY_IMAGES}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onMakeCover={handleMakeCover}
            busy={reading}
            hint={t('newPrompt.hint', { max: MAX_LIBRARY_IMAGES })}
          />
          {autofillNote && (
            <div className={styles.note}>
              <SparklesIcon size={13} /> {autofillNote}
            </div>
          )}

          <div className={pageStyles.formRow}>
            <div className={pageStyles.formField}>
              <label className={pageStyles.label} htmlFor="new-prompt-name">
                {t('newPrompt.recipeTitle')}
              </label>
              <GlassInput id="new-prompt-name" value={form.title} onChange={set('title')} placeholder={t('newPrompt.titlePlaceholder')} autoFocus required />
            </div>
            <div className={pageStyles.formField}>
              <span className={pageStyles.label}>{t('common.folder')}</span>
              {newFolderName === null ? (
                <Dropdown
                  value={folder}
                  ariaLabel={t('common.folder')}
                  options={[
                    ...folderOptions.map((f) => ({ value: f, label: folderLabel(f), icon: <FolderIcon size={14} /> })),
                    { value: NEW_FOLDER, label: t('common.newFolderOption'), icon: <PlusIcon size={14} />, isAction: true },
                  ]}
                  onChange={(v) => (v === NEW_FOLDER ? setNewFolderName('') : setFolder(v))}
                />
              ) : (
                <div className={styles.newFolderRow}>
                  <GlassInput
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder={t('common.newFolderName')}
                    aria-label={t('common.newFolderName')}
                    autoFocus
                  />
                  <button type="button" className={styles.linkBtn} onClick={() => setNewFolderName(null)}>
                    {t('common.cancel')}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={pageStyles.formField}>
            <label className={pageStyles.label} htmlFor="new-prompt-positive">
              {t('param.positivePrompt')}
            </label>
            <textarea id="new-prompt-positive" className={pageStyles.textarea} rows={3} value={form.prompt} onChange={set('prompt')} placeholder={t('newPrompt.positivePlaceholder')} />
          </div>

          <div className={pageStyles.formField}>
            <label className={pageStyles.label} htmlFor="new-prompt-negative">
              {t('param.negativePrompt')}
            </label>
            <textarea id="new-prompt-negative" className={pageStyles.textarea} rows={2} value={form.negativePrompt} onChange={set('negativePrompt')} placeholder={t('newPrompt.negativePlaceholder')} />
          </div>

          <div className={pageStyles.formRow3}>
            <div className={pageStyles.formField}>
              <label className={pageStyles.label} htmlFor="new-prompt-model">
                {t('newPrompt.modelCheckpoint')}
              </label>
              <div className={styles.inputWithLink}>
                <GlassInput id="new-prompt-model" value={form.model} onChange={set('model')} placeholder={t('newPrompt.modelPlaceholder')} />
                <LinkButton active={Boolean(modelLink.trim())} label={t('newPrompt.modelLink')} onClick={toggleModelLink} />
              </div>
            </div>
            <div className={pageStyles.formField}>
              <label className={pageStyles.label} htmlFor="new-prompt-sampler">
                {t('param.sampler')}
              </label>
              <GlassInput id="new-prompt-sampler" value={form.sampler} onChange={set('sampler')} placeholder={t('newPrompt.samplerPlaceholder')} />
            </div>
            <div className={pageStyles.formField}>
              <label className={pageStyles.label} htmlFor="new-prompt-steps">
                {t('param.steps')}
              </label>
              <GlassInput id="new-prompt-steps" type="number" min={1} value={form.steps} onChange={set('steps')} placeholder={t('newPrompt.stepsPlaceholder')} />
            </div>
          </div>

          {(modelLinkOpen || modelLink) && (
            <div className={styles.linkField}>
              <GlassInput
                value={modelLink}
                onChange={(e) => setModelLink(e.target.value)}
                placeholder={t('newPrompt.linkPlaceholder')}
                aria-label={`${t('newPrompt.modelCheckpoint')}: ${t('newPrompt.modelLink')}`}
                autoFocus={!modelLink}
              />
            </div>
          )}

          <div className={pageStyles.formField}>
            <span className={pageStyles.label}>{t('newPrompt.loras')}</span>
            {loras.map((l) => (
              <React.Fragment key={l.id}>
                <div className={styles.loraRow}>
                  <GlassInput
                    value={l.name}
                    onChange={(e) => updateLora(l.id, { name: e.target.value })}
                    placeholder={t('newPrompt.loraName')}
                    aria-label={t('newPrompt.loraName')}
                  />
                  <LinkButton active={Boolean(l.link.trim())} label={t('newPrompt.modelLink')} onClick={() => void toggleLoraLink(l)} />
                  <GlassInput
                    type="number"
                    step={0.05}
                    value={l.strength}
                    onChange={(e) => updateLora(l.id, { strength: e.target.value })}
                    aria-label={t('newPrompt.loraWeight')}
                    title={t('newPrompt.loraWeight')}
                  />
                  <button
                    type="button"
                    className={styles.loraRemove}
                    onClick={() => setLoras((prev) => prev.filter((x) => x.id !== l.id))}
                    title={t('newPrompt.removeLora')}
                    aria-label={t('newPrompt.removeLora')}
                  >
                    <CloseIcon size={14} />
                  </button>
                </div>
                {(l.linkOpen || l.link) && (
                  <div className={styles.linkField}>
                    <GlassInput
                      value={l.link}
                      onChange={(e) => updateLora(l.id, { link: e.target.value })}
                      placeholder={t('newPrompt.linkPlaceholder')}
                      aria-label={`${l.name || 'LoRA'}: ${t('newPrompt.modelLink')}`}
                      autoFocus={!l.link}
                    />
                  </div>
                )}
              </React.Fragment>
            ))}
            <button type="button" className={styles.addLoraBtn} onClick={() => setLoras((prev) => [...prev, newLoraRow()])}>
              <PlusIcon size={13} /> {t('newPrompt.addLora')}
            </button>
          </div>

          {saveError && <div className={styles.error}>{saveError}</div>}

          <div className={pageStyles.modalActions}>
            <SecondaryButton type="button" onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={!canSave}>
              {saving ? t('common.saving') : t('newPrompt.save')}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
};
