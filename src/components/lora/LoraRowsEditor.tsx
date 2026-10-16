import React, { useEffect, useRef, useState } from 'react';
import type { LoraReference } from '../../../core/types.js';
import { isSeaArtLink } from '../../../core/seaart.js';
import { CloseIcon, LinkIcon, PlusIcon } from '../icons/Icons.js';
import { GlassInput } from '../primitives/GlassInput.js';
import { useT } from '../../i18n/index.js';
import styles from './LoraRowsEditor.module.css';

/** One LoRA row being edited: name, weight and an optional model page link */
export interface DraftLora {
  id: string;
  name: string;
  strength: string;
  /** Model page link pasted by the user; saved with the entry */
  link: string;
  linkOpen: boolean;
  /** The saved LoRA this row started from; kept as is while name and link stay the same */
  original?: LoraReference;
}

export const newLoraRow = (name = '', strength = '1'): DraftLora => ({
  id: Math.random().toString(36).slice(2, 9),
  name,
  strength,
  link: '',
  linkOpen: false,
});

/** The link the user pasted for this LoRA (looked-up Civitai pages don't count) */
export const pastedLink = (lora: { resolved?: LoraReference['resolved'] }) =>
  lora.resolved?.matchedBy === 'manual' ? lora.resolved.modelUrl ?? '' : '';

export const draftFromLora = (lora: LoraReference): DraftLora => ({
  ...newLoraRow(lora.rawName, lora.strength !== undefined ? String(lora.strength) : '1'),
  link: pastedLink(lora),
  original: lora,
});

export const isWebLink = (text: string) => /^https?:\/\/\S+$/i.test(text);

/** True when a row has a link that is not a web address */
export const hasInvalidLink = (links: string[]) => links.map((x) => x.trim()).some((x) => x && !isWebLink(x));

/** Waits for a lookup at most `ms`, so saving never hangs on a slow network */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise.catch(() => fallback), new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

/** A web link on the clipboard, so the link button can paste it straight away */
export async function clipboardLink(): Promise<string> {
  try {
    const text = (await withTimeout(navigator.clipboard.readText(), 1000, '')).trim();
    return isWebLink(text) ? text : '';
  } catch {
    return '';
  }
}

/** Link button that shows the model's link field; amber once a link is set */
export const LinkButton: React.FC<{ active: boolean; label: string; onClick: () => void }> = ({ active, label, onClick }) => (
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

/** Link field shown under the row it belongs to */
export const LinkField: React.FC<{ value: string; label: string; onChange: (value: string) => void }> = ({ value, label, onChange }) => {
  const t = useT();
  return (
    <div className={styles.linkField}>
      <GlassInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('newPrompt.linkPlaceholder')}
        aria-label={label}
        autoFocus={!value}
      />
    </div>
  );
};

/** Opens a link field, pasting a link from the clipboard when it holds one */
export async function openLinkField(
  open: boolean,
  link: string,
  setOpen: (open: boolean) => void,
  pasteLink: (link: string) => void
) {
  if (open && !link) return setOpen(false);
  setOpen(true);
  if (link) return;
  const pasted = await clipboardLink();
  if (pasted) pasteLink(pasted);
}

/** Dashed "+ Add LoRA" button */
export const AddLoraButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const t = useT();
  return (
    <button type="button" className={styles.addLoraBtn} onClick={onClick}>
      <PlusIcon size={13} /> {t('newPrompt.addLora')}
    </button>
  );
};

/**
 * Looks up the model behind a link as soon as it is pasted, for each field whose name is still
 * empty, and passes what was found to `fill`. Returns the keys of the fields being looked up.
 * Each link is looked up once; a name typed meanwhile is the caller's to keep.
 */
export function useNameFromLink(
  fields: { key: string; name: string; link: string }[],
  kind: 'lora' | 'checkpoint',
  fill: (key: string, link: string, found: LoraReference) => void
): Set<string> {
  const tried = useRef(new Map<string, string>());
  const fillRef = useRef(fill);
  fillRef.current = fill;
  const [looking, setLooking] = useState<Record<string, string>>({});
  const waiting = fields.filter((f) => !f.name.trim() && isWebLink(f.link.trim()) && tried.current.get(f.key) !== f.link.trim());
  const signature = waiting.map((f) => `${f.key} ${f.link.trim()}`).join('\n');

  useEffect(() => {
    if (!waiting.length) return;
    // A short wait, so a link typed by hand is looked up once it is complete
    const timer = setTimeout(() => {
      for (const { key, link: rawLink } of waiting) {
        const link = rawLink.trim();
        tried.current.set(key, link);
        setLooking((prev) => ({ ...prev, [key]: link }));
        void resolveFromLink({ rawName: '' }, link, kind).then((found) => {
          setLooking((prev) => {
            if (prev[key] !== link) return prev;
            const { [key]: _done, ...rest } = prev;
            return rest;
          });
          const name = found.resolved?.name?.trim();
          if (name && name !== link) fillRef.current(key, link, { ...found, rawName: name });
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [signature, kind]);

  const current = new Map(fields.map((f) => [f.key, f.link.trim()]));
  return new Set(Object.keys(looking).filter((key) => current.get(key) === looking[key]));
}

/** LoRA rows with a link button each, and "+ Add LoRA" under them */
export const LoraRowsEditor: React.FC<{
  loras: DraftLora[];
  onChange: React.Dispatch<React.SetStateAction<DraftLora[]>>;
}> = ({ loras, onChange }) => {
  const t = useT();
  const update = (id: string, changes: Partial<DraftLora>) =>
    onChange((prev) => prev.map((l) => (l.id === id ? { ...l, ...changes } : l)));
  // A pasted link fills in the model's name; saving then keeps what was found
  const lookingUp = useNameFromLink(
    loras.map((l) => ({ key: l.id, name: l.name, link: l.link })),
    'lora',
    (id, link, found) =>
      onChange((prev) =>
        prev.map((l) =>
          l.id === id && !l.name.trim() && l.link.trim() === link
            ? { ...l, name: found.rawName, original: found }
            : l
        )
      )
  );

  return (
    <>
      {loras.map((l) => (
        <React.Fragment key={l.id}>
          <div className={styles.loraRow}>
            <GlassInput
              value={l.name}
              onChange={(e) => update(l.id, { name: e.target.value })}
              placeholder={lookingUp.has(l.id) ? t('newPrompt.lookingUp') : t('newPrompt.loraName')}
              aria-label={t('newPrompt.loraName')}
            />
            <LinkButton
              active={Boolean(l.link.trim())}
              label={t('newPrompt.modelLink')}
              onClick={() =>
                void openLinkField(
                  l.linkOpen,
                  l.link,
                  (linkOpen) => update(l.id, { linkOpen }),
                  (pasted) => onChange((prev) => prev.map((x) => (x.id === l.id && !x.link ? { ...x, link: pasted } : x)))
                )
              }
            />
            <GlassInput
              type="number"
              step={0.05}
              value={l.strength}
              onChange={(e) => update(l.id, { strength: e.target.value })}
              aria-label={t('newPrompt.loraWeight')}
              title={t('newPrompt.loraWeight')}
            />
            <button
              type="button"
              className={styles.loraRemove}
              onClick={() => onChange((prev) => prev.filter((x) => x.id !== l.id))}
              title={t('newPrompt.removeLora')}
              aria-label={t('newPrompt.removeLora')}
            >
              <CloseIcon size={14} />
            </button>
          </div>
          {(l.linkOpen || l.link) && (
            <LinkField
              value={l.link}
              label={`${l.name || 'LoRA'}: ${t('newPrompt.modelLink')}`}
              onChange={(link) => update(l.id, { link })}
            />
          )}
        </React.Fragment>
      ))}
      <AddLoraButton onClick={() => onChange((prev) => [...prev, newLoraRow()])} />
    </>
  );
};

/** Finds the model a pasted link points to; SeaArt pages give their name and cover */
export async function resolveFromLink(ref: LoraReference, link: string, kind: 'lora' | 'checkpoint'): Promise<LoraReference> {
  const { resolveFromModelLink, withLinkOnly } = await import('../../../core/lora-resolution.js');
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
}

const toNumber = (v: string) => (v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined);

/**
 * Turns edited rows into LoRAs: a pasted link decides which model it is, otherwise the
 * name is looked up. Rows whose name and link didn't change keep what was found before.
 */
export async function resolveDraftLoras(drafts: DraftLora[]): Promise<LoraReference[]> {
  const { resolveLoras } = await import('../../../core/lora-resolution.js');
  const rows = drafts.filter((l) => l.name.trim() || l.link.trim());
  const resolved = await Promise.all(
    rows.map((l) => {
      const rawName = l.name.trim();
      const link = l.link.trim();
      const original = l.original;
      const ref: LoraReference = { ...(original?.rawName === rawName ? original : undefined), rawName, strength: toNumber(l.strength) };
      if (original?.rawName === rawName && link === pastedLink(original) && original.resolved) return ref;
      if (link) return resolveFromLink({ ...ref, resolved: undefined }, link, 'lora');
      if (pastedLink(ref)) ref.resolved = undefined;
      return withTimeout(resolveLoras([ref]).then((r) => r[0] ?? ref), 8000, ref);
    })
  );
  // A link with no name typed takes the name found for it
  for (const ref of resolved) {
    if (!ref.rawName) ref.rawName = ref.resolved?.name || ref.resolved?.modelUrl || '';
    if (ref.resolved && !ref.resolved.name) ref.resolved.name = ref.rawName;
  }
  return resolved;
}
