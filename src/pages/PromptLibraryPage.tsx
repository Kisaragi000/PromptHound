import React, { useEffect, useMemo, useState } from 'react';
import {
  FolderIcon,
  SearchIcon,
  FilterIcon,
  PlusIcon,
  ImportIcon,
  ExportIcon,
  StarIcon,
  CopyIcon,
  CheckIcon,
  EditIcon,
  TrashIcon,
  EyeIcon,
  ExternalLinkIcon,
  SparklesIcon,
} from '../components/icons/Icons.js';
import { GlassInput } from '../components/primitives/GlassInput.js';
import { SecondaryButton } from '../components/primitives/SecondaryButton.js';
import { PrimaryButton } from '../components/primitives/PrimaryButton.js';
import { IconButton } from '../components/primitives/IconButton.js';
import { EmptyStatePanel } from '../components/primitives/EmptyStatePanel.js';
import { LoraCard } from '../components/lora/LoraCard.js';
import { PromptDiffModal } from '../components/library/PromptDiffModal.js';
import { useNavigation } from '../navigation/NavigationContext.js';
import { SavedPromptItem, LoraReference } from '../../core/types.js';
import { useT } from '../i18n/index.js';
import { folderLabel, sourceLabel, formatItemDate } from '../i18n/labels.js';
import styles from './PromptLibraryPage.module.css';
import { MAX_LIBRARY_IMAGES } from '../../core/types.js';
import { ImageCarousel } from '../components/library/ImageCarousel.js';
import { ImageLightbox } from '../components/library/ImageLightbox.js';
import { ItemImagesEditor } from '../components/library/ItemImagesEditor.js';
import { NewPromptModal } from '../components/library/NewPromptModal.js';
import { Dropdown } from '../components/primitives/Dropdown.js';
import { itemImages } from '../utils/libraryImages.js';
import { filterLibraryItems, libraryFacets } from '../utils/librarySearch.js';

export const PromptLibraryPage: React.FC = () => {
  const t = useT();
  const {
    libraryItems,
    folders,
    favorites,
    toggleFavorite,
    deleteFromLibrary,
    saveToLibrary,
    updateLibraryItem,
    addFolder,
    renameFolder,
    deleteFolder,
    openRecipeInResult,
    libraryFocusId,
  } = useNavigation();

  const [selectedFolder, setSelectedFolder] = useState('All Prompts');
  const [searchQuery, setSearchQuery] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [loraFilter, setLoraFilter] = useState('');
  // Opened via "Saved to Library": start with that item selected
  const [selectedItem, setSelectedItem] = useState<SavedPromptItem | null>(
    () => libraryItems.find((i) => i.id === libraryFocusId) ?? null
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Edit Library mode for deletion management
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState<string[]>([]);
  // Edit mode: move the selected items to an existing folder or a new one
  const NEW_FOLDER_OPTION = '__new_folder__';
  const [moveTarget, setMoveTarget] = useState('');
  const [moveNewFolderName, setMoveNewFolderName] = useState('');
  const [moveFeedback, setMoveFeedback] = useState<string | null>(null);
  // Edit mode: rename / delete the selected folder (not "All Prompts")
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);

  // View Layout mode: 'grid' or 'table'
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Compare diff selection
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);

  // Modals / Dialogs
  const [isNewPromptOpen, setIsNewPromptOpen] = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  // Detail pane: current image, full-size view, image editing
  const [detailImageIndex, setDetailImageIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isEditingImages, setIsEditingImages] = useState(false);

  // Folder counts in one pass over the library
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = { 'All Prompts': libraryItems.length };
    for (const item of libraryItems) {
      if (item.folder !== 'All Prompts') counts[item.folder] = (counts[item.folder] ?? 0) + 1;
    }
    return counts;
  }, [libraryItems]);

  const folderItems = useMemo(
    () => libraryItems.filter((item) => selectedFolder === 'All Prompts' || item.folder === selectedFolder),
    [libraryItems, selectedFolder]
  );
  const facets = useMemo(() => libraryFacets(folderItems), [folderItems]);
  // A filter for a model or LoRA no longer in this folder stops applying
  const activeModelFilter = facets.models.some(([name]) => name === modelFilter) ? modelFilter : '';
  const activeLoraFilter = facets.loras.some(([name]) => name === loraFilter) ? loraFilter : '';
  const filteredItems = useMemo(
    () => filterLibraryItems(folderItems, { query: searchQuery, model: activeModelFilter, lora: activeLoraFilter }),
    [folderItems, searchQuery, activeModelFilter, activeLoraFilter]
  );
  const isFiltering = Boolean(searchQuery.trim() || activeModelFilter || activeLoraFilter);
  const clearFilters = () => {
    setSearchQuery('');
    setModelFilter('');
    setLoraFilter('');
  };

  const activeItem =
    selectedItem && filteredItems.some((i) => i.id === selectedItem.id)
      ? filteredItems.find((i) => i.id === selectedItem.id)!
      : filteredItems[0] || null;

  // Another item starts at its cover, with image editing closed
  const activeItemId = activeItem?.id;
  useEffect(() => {
    setDetailImageIndex(0);
    setIsEditingImages(false);
  }, [activeItemId]);

  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const toggleCompareItem = (id: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 2) {
        // keep only the latest two
        return [prev[1], id];
      }
      return [...prev, id];
    });
  };

  const toggleSelectForDeletion = (id: string) => {
    setSelectedForDeletion((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllForDeletion = () => {
    if (selectedForDeletion.length === filteredItems.length) {
      setSelectedForDeletion([]);
    } else {
      setSelectedForDeletion(filteredItems.map((i) => i.id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedForDeletion.length === 0) return;
    selectedForDeletion.forEach((id) => {
      deleteFromLibrary(id);
    });
    setCompareSelection((prev) => prev.filter((id) => !selectedForDeletion.includes(id)));
    setSelectedForDeletion([]);
  };

  const moveDestination = moveTarget === NEW_FOLDER_OPTION ? moveNewFolderName.trim() : moveTarget;

  const handleMoveSelected = () => {
    if (selectedForDeletion.length === 0 || !moveDestination) return;
    if (moveTarget === NEW_FOLDER_OPTION) addFolder(moveDestination);
    selectedForDeletion.forEach((id) => updateLibraryItem(id, { folder: moveDestination }));
    const count = selectedForDeletion.length;
    setSelectedForDeletion([]);
    setMoveTarget('');
    setMoveNewFolderName('');
    setMoveFeedback(t('library.moved', { count, folder: moveDestination }));
    setTimeout(() => setMoveFeedback(null), 2500);
  };

  const startRename = (folder: string) => {
    setRenamingFolder(folder);
    setRenameValue(folder);
  };

  const renameError =
    renamingFolder && renameValue.trim() && renameValue.trim() !== renamingFolder && folders.includes(renameValue.trim())
      ? t('library.folderExists')
      : null;

  const commitRename = () => {
    if (!renamingFolder || renameError) return;
    const newName = renameValue.trim();
    if (newName && renameFolder(renamingFolder, newName)) {
      if (selectedFolder === renamingFolder) setSelectedFolder(newName);
      setRenamingFolder(null);
    }
  };

  const confirmDeleteFolder = () => {
    if (!folderToDelete) return;
    deleteFolder(folderToDelete);
    if (selectedFolder === folderToDelete) setSelectedFolder('All Prompts');
    setFolderToDelete(null);
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      addFolder(newFolderName.trim());
      setSelectedFolder(newFolderName.trim());
      setNewFolderName('');
      setIsNewFolderOpen(false);
    }
  };

  const handleDeleteItem = (id: string) => {
    deleteFromLibrary(id);
    setCompareSelection((prev) => prev.filter((i) => i !== id));
    setSelectedForDeletion((prev) => prev.filter((i) => i !== id));
    if (selectedItem?.id === id) {
      setSelectedItem(null);
    }
  };

  const compareItemA = libraryItems.find((i) => i.id === compareSelection[0]);
  const compareItemB = libraryItems.find((i) => i.id === compareSelection[1]);

  return (
    <div className={styles.container}>
      {/* Top Action Bar */}
      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <h2 className={styles.pageTitle}>{t('library.title')}</h2>

          {/* Edit Library Toggle in top left */}
          <button
            className={`${styles.editLibraryBtn} ${isEditMode ? styles.editLibraryBtnActive : ''}`}
            onClick={() => {
              setIsEditMode(!isEditMode);
              if (isEditMode) setSelectedForDeletion([]);
            }}
            title={isEditMode ? t('library.finishEditing') : t('library.editTitle')}
          >
            <EditIcon size={14} />
            <span>{isEditMode ? t('library.doneEditing') : t('library.edit')}</span>
          </button>

          <div className={styles.searchWrap}>
            <GlassInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('library.searchPlaceholder')}
              title={t('library.searchHelp')}
              icon={<SearchIcon size={16} />}
            />
          </div>
        </div>

        <div className={styles.topBarRight}>
          {/* View mode toggle */}
          <div className={styles.viewToggleGroup}>
            <button
              className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.viewToggleActive : ''}`}
              onClick={() => setViewMode('grid')}
              title={t('library.gridTitle')}
            >
              {t('library.grid')}
            </button>
            <button
              className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.viewToggleActive : ''}`}
              onClick={() => setViewMode('table')}
              title={t('library.tableTitle')}
            >
              {t('library.table')}
            </button>
          </div>

          {/* Compare Button */}
          {compareSelection.length > 0 && !isEditMode && (
            <SecondaryButton
              onClick={() => setIsDiffModalOpen(true)}
              disabled={compareSelection.length < 2}
              icon={<SparklesIcon size={14} />}
            >
              {t('library.compare', { count: compareSelection.length })}
            </SecondaryButton>
          )}

          <SecondaryButton onClick={() => setIsNewFolderOpen(true)} icon={<FolderIcon size={16} />}>
            {t('library.newFolder')}
          </SecondaryButton>
          <PrimaryButton onClick={() => setIsNewPromptOpen(true)} icon={<PlusIcon size={16} />}>
            {t('library.newPrompt')}
          </PrimaryButton>
        </div>
      </header>

      {/* Edit Mode Deletion Toolbar */}
      {isEditMode && (
        <div className={styles.editModeToolbar}>
          <div className={styles.editModeToolbarLeft}>
            <span className={styles.editModeHelp}>
              {moveFeedback ?? t('library.editHelp')}
            </span>
          </div>
          <div className={styles.editModeToolbarRight}>
            <Dropdown
              size="sm"
              className={styles.toolbarDropdown}
              value={moveTarget}
              placeholder={t('library.moveTo')}
              title={t('library.moveToTitle')}
              ariaLabel={t('library.moveToTitle')}
              options={[
                ...folders
                  .filter((f) => f !== 'All Prompts')
                  .map((f) => ({ value: f, label: folderLabel(f), icon: <FolderIcon size={13} /> })),
                { value: NEW_FOLDER_OPTION, label: t('common.newFolderOption'), icon: <PlusIcon size={13} />, isAction: true },
              ]}
              onChange={setMoveTarget}
            />
            {moveTarget === NEW_FOLDER_OPTION && (
              <input
                className={styles.toolbarInput}
                value={moveNewFolderName}
                onChange={(e) => setMoveNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleMoveSelected();
                }}
                placeholder={t('common.newFolderName')}
                autoFocus
              />
            )}
            <button
              className={styles.toolbarMoveBtn}
              disabled={selectedForDeletion.length === 0 || !moveDestination}
              onClick={handleMoveSelected}
            >
              <FolderIcon size={14} />
              <span>{t('library.move', { count: selectedForDeletion.length })}</span>
            </button>
            <button
              className={styles.toolbarSecondaryBtn}
              onClick={handleSelectAllForDeletion}
            >
              {selectedForDeletion.length === filteredItems.length && filteredItems.length > 0
                ? t('library.deselectAll')
                : t('library.selectAll', { count: filteredItems.length })}
            </button>
            <button
              className={styles.toolbarDeleteBtn}
              disabled={selectedForDeletion.length === 0}
              onClick={handleDeleteSelected}
            >
              <TrashIcon size={14} />
              <span>{t('library.deleteSelected', { count: selectedForDeletion.length })}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main 3-Column Layout */}
      <div className={styles.mainLayout}>
        {/* Column 1: Folder Sidebar */}
        <aside className={styles.folderRail}>
          {folders.map((f) => {
            const editable = isEditMode && selectedFolder === f && f !== 'All Prompts';
            if (editable && renamingFolder === f) {
              return (
                <div key={f} className={styles.folderEditBox}>
                  <input
                    className={styles.folderRenameInput}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setRenamingFolder(null);
                    }}
                    aria-label={t('library.renameLabel', { folder: folderLabel(f) })}
                    autoFocus
                  />
                  {renameError && <span className={styles.folderEditError}>{renameError}</span>}
                  <div className={styles.folderActions}>
                    <button type="button" className={styles.folderActionBtn} onClick={() => setRenamingFolder(null)}>
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      className={`${styles.folderActionBtn} ${styles.folderActionPrimary}`}
                      disabled={!renameValue.trim() || Boolean(renameError)}
                      onClick={commitRename}
                    >
                      {t('common.save')}
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div key={f} className={editable ? styles.folderEditBox : undefined}>
                <button
                  className={`${styles.folderItem} ${selectedFolder === f ? styles.activeFolder : ''}`}
                  onClick={() => {
                    setSelectedFolder(f);
                    setRenamingFolder(null);
                  }}
                  title={isEditMode && f !== 'All Prompts' ? t('library.selectFolderTitle', { folder: folderLabel(f) }) : undefined}
                >
                  <div className={styles.folderLeft}>
                    <FolderIcon size={16} />
                    <span>{folderLabel(f)}</span>
                  </div>
                  <span className={styles.folderCount}>{folderCounts[f] || 0}</span>
                </button>
                {editable && (
                  <div className={styles.folderActions}>
                    <button type="button" className={styles.folderActionBtn} onClick={() => startRename(f)}>
                      {t('library.rename')}
                    </button>
                    <button
                      type="button"
                      className={`${styles.folderActionBtn} ${styles.folderActionDanger}`}
                      onClick={() => setFolderToDelete(f)}
                    >
                      {t('library.deleteFolder')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </aside>

        {/* Column 2: Prompt Card Grid OR Compact Table */}
        <div className={styles.gridArea}>
          {(facets.models.length > 0 || facets.loras.length > 0) && (
            <div className={styles.filterBar}>
              {facets.models.length > 0 && (
                <Dropdown
                  size="sm"
                  ariaLabel={t('library.filterModel')}
                  className={styles.filterDropdown}
                  value={activeModelFilter}
                  onChange={setModelFilter}
                  options={[
                    { value: '', label: t('library.allModels') },
                    ...facets.models.map(([name, count]) => ({ value: name, label: `${name} (${count})` })),
                  ]}
                />
              )}
              {facets.loras.length > 0 && (
                <Dropdown
                  size="sm"
                  ariaLabel={t('library.filterLora')}
                  className={styles.filterDropdown}
                  value={activeLoraFilter}
                  onChange={setLoraFilter}
                  options={[
                    { value: '', label: t('library.allLoras') },
                    ...facets.loras.map(([name, count]) => ({ value: name, label: `${name} (${count})` })),
                  ]}
                />
              )}
              {isFiltering && (
                <>
                  <span className={styles.filterCount}>
                    {t('library.filterCount', { shown: filteredItems.length, total: folderItems.length })}
                  </span>
                  <button type="button" className={styles.filterClear} onClick={clearFilters}>
                    {t('common.clear')}
                  </button>
                </>
              )}
            </div>
          )}
          {filteredItems.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              {isFiltering
                ? t('library.noMatches')
                : t('library.emptyFolder', { folder: folderLabel(selectedFolder) })}
            </div>
          ) : viewMode === 'table' ? (
            <div className={styles.tableWrapper}>
              <table className={styles.compactTable}>
                <thead>
                  <tr>
                    {isEditMode ? (
                      <th style={{ width: '40px' }}>{t('library.colSelect')}</th>
                    ) : (
                      <th style={{ width: '40px' }}>{t('library.colDiff')}</th>
                    )}
                    <th style={{ width: '60px' }}>{t('library.colThumb')}</th>
                    <th>{t('library.colTitle')}</th>
                    <th>{t('library.colModel')}</th>
                    <th>{t('library.colSampler')}</th>
                    <th>{t('library.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const isSelected = activeItem?.id === item.id;
                    const isCompared = compareSelection.includes(item.id);
                    const isMarkedDelete = selectedForDeletion.includes(item.id);

                    return (
                      <tr
                        key={item.id}
                        className={`${styles.tableRow} ${isSelected ? styles.tableRowSelected : ''} ${isMarkedDelete ? styles.tableRowMarkedDelete : ''}`}
                        onClick={() => {
                          if (isEditMode) {
                            toggleSelectForDeletion(item.id);
                          } else if (selectedItem?.id === item.id) {
                            openRecipeInResult(item);
                          } else {
                            setSelectedItem(item);
                          }
                        }}
                        onDoubleClick={() => {
                          if (!isEditMode) {
                            openRecipeInResult(item);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                        title={
                          isEditMode
                            ? t('library.clickSelectDelete')
                            : selectedItem?.id === item.id
                            ? t('library.clickAgainOpen')
                            : t('library.clickSelect')
                        }
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          {isEditMode ? (
                            <input
                              type="checkbox"
                              checked={isMarkedDelete}
                              onChange={() => toggleSelectForDeletion(item.id)}
                              title={t('library.selectToDelete')}
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={isCompared}
                              onChange={() => toggleCompareItem(item.id)}
                              title={t('library.selectForDiff')}
                            />
                          )}
                        </td>
                        <td>
                          <div className={styles.tableThumbWrap}>
                            <img src={item.thumbnailUrl} alt={item.title} className={styles.tableThumb} loading="lazy" decoding="async" />
                            {itemImages(item).length > 1 && (
                              <span className={styles.tableThumbCount}>+{itemImages(item).length - 1}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className={styles.tableTitle}>{item.title}</div>
                          <div className={styles.tablePromptSnippet}>
                            {item.metadata?.prompt || t('library.noPromptText')}
                          </div>
                        </td>
                        <td className={styles.tableModel}>{item.model || 'SDXL'}</td>
                        <td className={styles.tableParams}>
                          {item.metadata?.sampler || '—'}{item.metadata?.steps ? ` · ${t('library.stepsShort', { steps: item.metadata.steps })}` : ''}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className={styles.tableActions}>
                            {isEditMode ? (
                              <button
                                className={styles.deleteQuickBtn}
                                onClick={() => handleDeleteItem(item.id)}
                                title={t('library.deleteImageFromLibrary')}
                              >
                                <TrashIcon size={14} />
                              </button>
                            ) : (
                              <>
                                <IconButton
                                  title={t('common.copyPrompt')}
                                  onClick={() => copyText(item.metadata?.prompt || '', `table-${item.id}`)}
                                >
                                  {copiedField === `table-${item.id}` ? (
                                    <CheckIcon size={13} color="#4ade80" />
                                  ) : (
                                    <CopyIcon size={13} />
                                  )}
                                </IconButton>
                                <IconButton
                                  title={t('library.inspectFull')}
                                  onClick={() => openRecipeInResult(item)}
                                >
                                  <EyeIcon size={13} />
                                </IconButton>
                                <IconButton
                                  title={t('common.delete')}
                                  onClick={() => handleDeleteItem(item.id)}
                                >
                                  <TrashIcon size={13} />
                                </IconButton>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isFav = favorites.includes(item.id);
              const isSelected = activeItem?.id === item.id;
              const isCompared = compareSelection.includes(item.id);
              const isMarkedDelete = selectedForDeletion.includes(item.id);

              return (
                <div
                  key={item.id}
                  className={`${styles.promptCard} ${isSelected ? styles.selectedCard : ''} ${isEditMode ? styles.cardEditMode : ''} ${isMarkedDelete ? styles.cardMarkedDelete : ''}`}
                  onClick={() => {
                    if (isEditMode) {
                      toggleSelectForDeletion(item.id);
                    } else if (selectedItem?.id === item.id) {
                      openRecipeInResult(item);
                    } else {
                      setSelectedItem(item);
                    }
                  }}
                  onDoubleClick={() => {
                    if (!isEditMode) {
                      openRecipeInResult(item);
                    }
                  }}
                  title={
                    isEditMode
                      ? t('library.clickSelectDelete')
                      : selectedItem?.id === item.id
                      ? t('library.clickAgainOpenItem', { title: item.title })
                      : t('library.clickSelectItem', { title: item.title })
                  }
                >
                  <div className={styles.cardThumbWrap}>
                    <ImageCarousel images={itemImages(item)} alt={item.title} imageClassName={styles.cardThumb} />

                    {isEditMode ? (
                      <>
                        {/* Edit Mode Checkbox */}
                        <div
                          className={styles.cardDeleteCheckboxWrap}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectForDeletion(item.id);
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isMarkedDelete}
                            onChange={() => toggleSelectForDeletion(item.id)}
                          />
                        </div>

                        {/* Direct Delete Badge */}
                        <button
                          className={styles.cardDirectDeleteBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item.id);
                          }}
                          title={t('library.deleteThisImage')}
                        >
                          <TrashIcon size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className={styles.cardFavStar}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(item.id);
                          }}
                          title={isFav ? t('library.removeFavorite') : t('library.addFavorite')}
                        >
                          <StarIcon size={16} filled={isFav} />
                        </button>
                        {/* Compare checkbox badge */}
                        <button
                          className={`${styles.compareBadge} ${isCompared ? styles.compareBadgeActive : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCompareItem(item.id);
                          }}
                          title={t('library.selectForDiff')}
                        >
                          {isCompared ? t('library.diffOn') : t('library.diffOff')}
                        </button>
                      </>
                    )}
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.cardTitle}>{item.title}</div>
                    <div className={styles.cardChipsRow}>
                      {item.folder && <span className={styles.chip}>{folderLabel(item.folder)}</span>}
                      <span className={styles.chip}>{sourceLabel(item.source)}</span>
                    </div>
                    <div className={styles.cardMetaRow}>
                      <span>{formatItemDate(item.date)}</span>
                      <span>{item.model}</span>
                    </div>
                    <div className={styles.cardActionsRow}>
                      {isEditMode ? (
                        <button
                          className={styles.cardInlineDeleteBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item.id);
                          }}
                        >
                          <TrashIcon size={13} />
                          <span>{t('library.deleteImage')}</span>
                        </button>
                      ) : (
                        <>
                          <IconButton
                            title={t('common.copyPrompt')}
                            onClick={(e) => {
                              e.stopPropagation();
                              copyText(item.metadata?.prompt || '', `card-${item.id}`);
                            }}
                          >
                            {copiedField === `card-${item.id}` ? <CheckIcon size={14} color="#4ade80" /> : <CopyIcon size={14} />}
                          </IconButton>
                          <IconButton
                            title={t('common.openFullResult')}
                            onClick={(e) => {
                              e.stopPropagation();
                              openRecipeInResult(item);
                            }}
                          >
                            <EyeIcon size={14} />
                          </IconButton>
                          <IconButton
                            title={t('library.deleteFromLibrary')}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(item.id);
                            }}
                          >
                            <TrashIcon size={14} />
                          </IconButton>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Column 3: Selected Item Detail Pane */}
        {activeItem ? (
          <aside className={styles.detailPane}>
            <div
              className={styles.detailImageWrap}
              onClick={() => setLightboxIndex(detailImageIndex)}
              style={{ cursor: itemImages(activeItem).length ? 'zoom-in' : 'default' }}
              title={t('library.viewFull')}
            >
              <ImageCarousel
                images={itemImages(activeItem)}
                alt={activeItem.title}
                keyboard={!isEditingImages}
                imageClassName={styles.detailImage}
                onIndexChange={setDetailImageIndex}
              />
              <button
                className={styles.detailFavBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(activeItem.id);
                }}
              >
                <StarIcon size={20} filled={favorites.includes(activeItem.id)} />
              </button>
            </div>

            <div className={styles.detailImagesBar}>
              <span>
                {t('library.imagesCount', { count: itemImages(activeItem).length, max: MAX_LIBRARY_IMAGES })}
              </span>
              <button type="button" className={styles.detailImagesBtn} onClick={() => setIsEditingImages((v) => !v)}>
                {isEditingImages ? t('common.done') : itemImages(activeItem).length ? t('library.editImages') : t('library.addImages')}
              </button>
            </div>
            {isEditingImages && (
              <ItemImagesEditor item={activeItem} onChange={(updates) => updateLibraryItem(activeItem.id, updates)} />
            )}

            <div className={styles.detailContent}>
              <div className={styles.detailTitleRow}>
                <h3 className={styles.detailTitle}>{activeItem.title}</h3>
                <IconButton
                  title={t('library.openInspector')}
                  onClick={() => openRecipeInResult(activeItem)}
                >
                  <ExternalLinkIcon size={16} />
                </IconButton>
              </div>

              <div className={styles.detailChips}>
                {activeItem.folder && <span className={styles.chip}>{folderLabel(activeItem.folder)}</span>}
                <span className={styles.chip}>{sourceLabel(activeItem.source)}</span>
                <span className={styles.chip}>{activeItem.model}</span>
              </div>

              {/* Prompt Section */}
              <div className={styles.detailSection}>
                <div className={styles.sectionHeader}>
                  <span>{t('param.prompt')}</span>
                  <button
                    className={styles.copyBtn}
                    onClick={() => copyText(activeItem.metadata?.prompt || '', 'detail-prompt')}
                  >
                    {copiedField === 'detail-prompt' ? (
                      <>
                        <CheckIcon size={12} color="#4ade80" /> {t('common.copied')}
                      </>
                    ) : (
                      <>
                        <CopyIcon size={12} /> {t('common.copy')}
                      </>
                    )}
                  </button>
                </div>
                <div className={styles.promptText}>
                  {activeItem.metadata?.prompt || t('library.noPromptSaved')}
                </div>
              </div>

              {/* Negative Prompt */}
              {activeItem.metadata?.negativePrompt && (
                <div className={styles.detailSection}>
                  <div className={styles.sectionHeader}>
                    <span>{t('param.negativePrompt')}</span>
                    <button
                      className={styles.copyBtn}
                      onClick={() =>
                        copyText(activeItem.metadata?.negativePrompt || '', 'detail-neg')
                      }
                    >
                      {copiedField === 'detail-neg' ? (
                        <>
                          <CheckIcon size={12} color="#4ade80" /> {t('common.copied')}
                        </>
                      ) : (
                        <>
                          <CopyIcon size={12} /> {t('common.copy')}
                        </>
                      )}
                    </button>
                  </div>
                  <div className={styles.promptText}>{activeItem.metadata.negativePrompt}</div>
                </div>
              )}

              {/* Parameters Grid */}
              <div className={styles.detailSection}>
                <div className={styles.sectionHeader}>
                  <span>{t('library.genParams')}</span>
                </div>
                <div className={styles.paramGrid}>
                  <div className={styles.paramCard}>
                    <span className={styles.paramLabel}>{t('param.sampler')}</span>
                    <span className={styles.paramVal}>{activeItem.metadata?.sampler || '—'}</span>
                  </div>
                  <div className={styles.paramCard}>
                    <span className={styles.paramLabel}>{t('param.steps')}</span>
                    <span className={styles.paramVal}>{activeItem.metadata?.steps ?? '—'}</span>
                  </div>
                  <div className={styles.paramCard}>
                    <span className={styles.paramLabel}>{t('param.cfgScale')}</span>
                    <span className={styles.paramVal}>{activeItem.metadata?.cfgScale ?? '—'}</span>
                  </div>
                  <div className={styles.paramCard}>
                    <span className={styles.paramLabel}>{t('param.seed')}</span>
                    <span className={styles.paramVal}>{activeItem.metadata?.seed ?? '—'}</span>
                  </div>
                  <div className={styles.paramCard}>
                    <span className={styles.paramLabel}>{t('param.dimensions')}</span>
                    <span className={styles.paramVal}>{activeItem.dimensions}</span>
                  </div>
                  <div className={styles.paramCard}>
                    <span className={styles.paramLabel}>{t('param.created')}</span>
                    <span className={styles.paramVal}>{formatItemDate(activeItem.date)}</span>
                  </div>
                </div>
              </div>

              {/* Embedded LoRAs */}
              {activeItem.metadata?.loras && activeItem.metadata.loras.length > 0 && (
                <div className={styles.detailSection}>
                  <div className={styles.sectionHeader}>
                    <span>{t('param.embeddedLoras', { count: activeItem.metadata.loras.length })}</span>
                  </div>
                  <div className={styles.loraList}>
                    {activeItem.metadata.loras.map((lora: LoraReference, i: number) => (
                      <LoraCard key={`${lora.rawName}-${i}`} lora={lora} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        ) : (
          <aside className={styles.detailPane}>
            <EmptyStatePanel
              icon={<FolderIcon size={32} />}
              title={t('library.noSelectionTitle')}
              description={t('library.noSelectionBody')}
            />
          </aside>
        )}
      </div>

      {/* Side-by-Side Prompt Diff Modal */}
      {compareItemA && compareItemB && (
        <PromptDiffModal
          itemA={compareItemA}
          itemB={compareItemB}
          isOpen={isDiffModalOpen}
          onClose={() => setIsDiffModalOpen(false)}
        />
      )}

      {/* New Folder Modal */}
      {folderToDelete && (
        <div className={styles.modalOverlay} onClick={() => setFolderToDelete(null)}>
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-labelledby="delete-folder-title"
          >
            <h3 id="delete-folder-title" className={styles.modalTitle}>
              {t('library.deleteFolderTitle', { folder: folderLabel(folderToDelete) })}
            </h3>
            <p className={styles.modalText}>
              {folderCounts[folderToDelete]
                ? t('library.deleteFolderItems', { count: folderCounts[folderToDelete] })
                : t('library.folderEmpty')}
            </p>
            <div className={styles.modalActions}>
              <SecondaryButton type="button" onClick={() => setFolderToDelete(null)} autoFocus>
                {t('common.cancel')}
              </SecondaryButton>
              <button type="button" className={styles.modalDangerBtn} onClick={confirmDeleteFolder}>
                <TrashIcon size={14} /> {t('library.deleteFolder')}
              </button>
            </div>
          </div>
        </div>
      )}

      {isNewFolderOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsNewFolderOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>{t('library.createFolderTitle')}</h3>
            <form onSubmit={handleCreateFolder} className={styles.modalForm}>
              <GlassInput
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={t('library.folderPlaceholder')}
                autoFocus
              />
              <div className={styles.modalActions}>
                <SecondaryButton type="button" onClick={() => setIsNewFolderOpen(false)}>
                  {t('common.cancel')}
                </SecondaryButton>
                <PrimaryButton type="submit" disabled={!newFolderName.trim()}>
                  {t('library.createFolder')}
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Prompt Recipe Modal */}
      {isNewPromptOpen && (
        <NewPromptModal
          defaultFolder={selectedFolder}
          onClose={() => setIsNewPromptOpen(false)}
          onSaved={(item) => {
            setIsNewPromptOpen(false);
            setSelectedItem(item);
          }}
        />
      )}

      {lightboxIndex !== null && activeItem && (
        <ImageLightbox
          images={itemImages(activeItem)}
          startIndex={lightboxIndex}
          title={activeItem.title}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
};
