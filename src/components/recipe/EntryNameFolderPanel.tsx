import React, { useState } from 'react';
import type { SavedPromptItem } from '../../../core/types.js';
import { useNavigation, ALL_PROMPTS_FOLDER } from '../../navigation/NavigationContext.js';
import { CloseIcon, EditIcon, FolderIcon, PlusIcon } from '../icons/Icons.js';
import { Dropdown } from '../primitives/Dropdown.js';
import { GlassInput } from '../primitives/GlassInput.js';
import { useT } from '../../i18n/index.js';
import { folderLabel } from '../../i18n/labels.js';
import styles from './EntryNameFolderPanel.module.css';

const NEW_FOLDER = '__new_folder__';

interface EntryNameFolderPanelProps {
  /** The library entry shown or just saved; without one the fields set up the next save */
  entry?: SavedPromptItem;
  name: string;
  onNameChange: (name: string) => void;
  /** Name used when none is typed, shown as the field's hint */
  defaultName: string;
  /** Folder the next save goes to */
  folder: string;
  onFolderChange: (folder: string) => void;
}

/** Name and folder of the entry on the result page, under Quick Actions */
export const EntryNameFolderPanel: React.FC<EntryNameFolderPanelProps> = ({
  entry,
  name,
  onNameChange,
  defaultName,
  folder,
  onFolderChange,
}) => {
  const t = useT();
  const { folders, addFolder, updateLibraryItem } = useNavigation();
  const [newFolderName, setNewFolderName] = useState<string | null>(null);
  // A saved entry is renamed on request, like in the library, never through an always-open field
  const [renameDraft, setRenameDraft] = useState<string | null>(null);
  const folderOptions = folders.filter((f) => f !== ALL_PROMPTS_FOLDER);
  const currentFolder = entry ? entry.folder : folder;

  const chooseFolder = (value: string) => {
    if (entry) updateLibraryItem(entry.id, { folder: value });
    onFolderChange(value);
  };

  const createFolder = () => {
    const created = newFolderName?.trim();
    setNewFolderName(null);
    if (!created || created === ALL_PROMPTS_FOLDER) return;
    addFolder(created);
    chooseFolder(created);
  };

  const commitRename = () => {
    const title = renameDraft?.trim();
    setRenameDraft(null);
    if (entry && title && title !== entry.title) updateLibraryItem(entry.id, { title });
  };

  return (
    <div className={styles.section}>
      <label className={styles.label} htmlFor="entry-name">
        {t('result.name')}
      </label>
      {!entry ? (
        <GlassInput
          id="entry-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={defaultName}
        />
      ) : renameDraft !== null ? (
        <GlassInput
          id="entry-name"
          value={renameDraft}
          onChange={(e) => setRenameDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setRenameDraft(null);
          }}
          onFocus={(e) => e.target.select()}
          autoFocus
        />
      ) : (
        <div className={styles.nameRow}>
          <span className={styles.nameText} onDoubleClick={() => setRenameDraft(entry.title)} title={t('library.renameHint')}>
            {entry.title}
          </span>
          <button type="button" className={styles.renameBtn} onClick={() => setRenameDraft(entry.title)}>
            <EditIcon size={13} />
            {t('library.rename')}
          </button>
        </div>
      )}

      <span className={styles.label}>{t('common.folder')}</span>
      {newFolderName === null ? (
        <Dropdown
          value={currentFolder}
          placeholder={t('folder.unfiled')}
          ariaLabel={t('common.folder')}
          icon={<FolderIcon size={14} />}
          options={[
            ...folderOptions.map((f) => ({ value: f, label: folderLabel(f), icon: <FolderIcon size={14} /> })),
            { value: NEW_FOLDER, label: t('common.newFolderOption'), icon: <PlusIcon size={14} />, isAction: true },
          ]}
          onChange={(v) => (v === NEW_FOLDER ? setNewFolderName('') : chooseFolder(v))}
        />
      ) : (
        <div className={styles.newFolderRow}>
          <GlassInput
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createFolder();
              if (e.key === 'Escape') setNewFolderName(null);
            }}
            onBlur={() => newFolderName.trim() && createFolder()}
            placeholder={t('common.newFolderName')}
            aria-label={t('common.newFolderName')}
            autoFocus
          />
          <button
            type="button"
            className={styles.newFolderCancel}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setNewFolderName(null)}
            title={t('common.cancel')}
            aria-label={t('common.cancel')}
          >
            <CloseIcon size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
