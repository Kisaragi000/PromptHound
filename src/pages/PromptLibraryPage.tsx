import React, { useState } from 'react';
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
import styles from './PromptLibraryPage.module.css';

export const PromptLibraryPage: React.FC = () => {
  const {
    libraryItems,
    folders,
    favorites,
    toggleFavorite,
    deleteFromLibrary,
    saveToLibrary,
    updateLibraryItem,
    addFolder,
    openRecipeInResult,
  } = useNavigation();

  const [selectedFolder, setSelectedFolder] = useState('All Prompts');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<SavedPromptItem | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Edit Library mode for deletion management
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState<string[]>([]);

  // View Layout mode: 'grid' or 'table'
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Compare diff selection
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);

  // Modals / Dialogs
  const [isNewPromptOpen, setIsNewPromptOpen] = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newPromptForm, setNewPromptForm] = useState({
    title: '',
    folder: 'My Creations',
    prompt: '',
    negativePrompt: '',
    model: 'SDXL Base 1.0',
    sampler: 'Euler a',
    steps: 30,
    cfgScale: 7.0,
    seed: '',
  });

  // Calculate folder counts dynamically
  const folderCounts = folders.reduce<Record<string, number>>((acc, f) => {
    if (f === 'All Prompts') {
      acc[f] = libraryItems.length;
    } else {
      acc[f] = libraryItems.filter((i) => i.folder === f).length;
    }
    return acc;
  }, {});

  const filteredItems = libraryItems.filter((item) => {
    const matchesFolder =
      selectedFolder === 'All Prompts' || item.folder === selectedFolder;
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.metadata?.prompt && item.metadata.prompt.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.model && item.model.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFolder && matchesSearch;
  });

  const activeItem =
    selectedItem && filteredItems.some((i) => i.id === selectedItem.id)
      ? filteredItems.find((i) => i.id === selectedItem.id)!
      : filteredItems[0] || null;

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

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      addFolder(newFolderName.trim());
      setSelectedFolder(newFolderName.trim());
      setNewFolderName('');
      setIsNewFolderOpen(false);
    }
  };

  const handleCreatePrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromptForm.title.trim()) return;

    saveToLibrary({
      title: newPromptForm.title.trim(),
      folder: newPromptForm.folder,
      source: 'Local File',
      model: newPromptForm.model,
      dimensions: '1024 × 1024',
      isFavorite: false,
      thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80',
      metadata: {
        prompt: newPromptForm.prompt,
        negativePrompt: newPromptForm.negativePrompt,
        model: newPromptForm.model,
        sampler: newPromptForm.sampler,
        steps: newPromptForm.steps,
        cfgScale: newPromptForm.cfgScale,
        seed: newPromptForm.seed ? parseInt(newPromptForm.seed, 10) : undefined,
      },
    });

    setIsNewPromptOpen(false);
    setNewPromptForm({
      title: '',
      folder: 'My Creations',
      prompt: '',
      negativePrompt: '',
      model: 'SDXL Base 1.0',
      sampler: 'Euler a',
      steps: 30,
      cfgScale: 7.0,
      seed: '',
    });
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
          <h2 className={styles.pageTitle}>Prompt Library</h2>

          {/* Edit Library Toggle in top left */}
          <button
            className={`${styles.editLibraryBtn} ${isEditMode ? styles.editLibraryBtnActive : ''}`}
            onClick={() => {
              setIsEditMode(!isEditMode);
              if (isEditMode) setSelectedForDeletion([]);
            }}
            title={isEditMode ? 'Finish editing library' : 'Edit and delete library images'}
          >
            <EditIcon size={14} />
            <span>{isEditMode ? 'Done Editing' : 'Edit Library'}</span>
          </button>

          <div className={styles.searchWrap}>
            <GlassInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search prompts, models, tags..."
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
              title="Grid View"
            >
              Grid
            </button>
            <button
              className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.viewToggleActive : ''}`}
              onClick={() => setViewMode('table')}
              title="Compact Table View"
            >
              Table
            </button>
          </div>

          {/* Compare Button */}
          {compareSelection.length > 0 && !isEditMode && (
            <SecondaryButton
              onClick={() => setIsDiffModalOpen(true)}
              disabled={compareSelection.length < 2}
              icon={<SparklesIcon size={14} />}
            >
              Compare ({compareSelection.length}/2)
            </SecondaryButton>
          )}

          <SecondaryButton onClick={() => setIsNewFolderOpen(true)} icon={<FolderIcon size={16} />}>
            New Folder
          </SecondaryButton>
          <PrimaryButton onClick={() => setIsNewPromptOpen(true)} icon={<PlusIcon size={16} />}>
            New Prompt
          </PrimaryButton>
        </div>
      </header>

      {/* Edit Mode Deletion Toolbar */}
      {isEditMode && (
        <div className={styles.editModeToolbar}>
          <div className={styles.editModeToolbarLeft}>
            <span className={styles.editModeBadge}>Edit Mode Active</span>
            <span className={styles.editModeHelp}>
              Click items or trash icons to delete images from your library.
            </span>
          </div>
          <div className={styles.editModeToolbarRight}>
            <button
              className={styles.toolbarSecondaryBtn}
              onClick={handleSelectAllForDeletion}
            >
              {selectedForDeletion.length === filteredItems.length && filteredItems.length > 0
                ? 'Deselect All'
                : `Select All (${filteredItems.length})`}
            </button>
            <button
              className={styles.toolbarDeleteBtn}
              disabled={selectedForDeletion.length === 0}
              onClick={handleDeleteSelected}
            >
              <TrashIcon size={14} />
              <span>Delete Selected ({selectedForDeletion.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Main 3-Column Layout */}
      <div className={styles.mainLayout}>
        {/* Column 1: Folder Sidebar */}
        <aside className={styles.folderRail}>
          {folders.map((f) => (
            <button
              key={f}
              className={`${styles.folderItem} ${selectedFolder === f ? styles.activeFolder : ''}`}
              onClick={() => setSelectedFolder(f)}
            >
              <div className={styles.folderLeft}>
                <FolderIcon size={16} />
                <span>{f}</span>
              </div>
              <span className={styles.folderCount}>{folderCounts[f] || 0}</span>
            </button>
          ))}
        </aside>

        {/* Column 2: Prompt Card Grid OR Compact Table */}
        <div className={styles.gridArea}>
          {filteredItems.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No prompts found in {selectedFolder}. Add one or extract an image to save!
            </div>
          ) : viewMode === 'table' ? (
            <div className={styles.tableWrapper}>
              <table className={styles.compactTable}>
                <thead>
                  <tr>
                    {isEditMode ? (
                      <th style={{ width: '40px' }}>Select</th>
                    ) : (
                      <th style={{ width: '40px' }}>Diff</th>
                    )}
                    <th style={{ width: '60px' }}>Thumb</th>
                    <th>Title &amp; Prompt</th>
                    <th>Model</th>
                    <th>Sampler / Steps</th>
                    <th>Actions</th>
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
                            ? 'Click to select for deletion'
                            : selectedItem?.id === item.id
                            ? 'Click again to open full scan results'
                            : 'Click to select (orange border), click again to open full'
                        }
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          {isEditMode ? (
                            <input
                              type="checkbox"
                              checked={isMarkedDelete}
                              onChange={() => toggleSelectForDeletion(item.id)}
                              title="Select to delete"
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={isCompared}
                              onChange={() => toggleCompareItem(item.id)}
                              title="Select for Diff Comparison"
                            />
                          )}
                        </td>
                        <td>
                          <img src={item.thumbnailUrl} alt={item.title} className={styles.tableThumb} />
                        </td>
                        <td>
                          <div className={styles.tableTitle}>{item.title}</div>
                          <div className={styles.tablePromptSnippet}>
                            {item.metadata?.prompt || '(No prompt text)'}
                          </div>
                        </td>
                        <td className={styles.tableModel}>{item.model || 'SDXL'}</td>
                        <td className={styles.tableParams}>
                          {item.metadata?.sampler || 'Euler a'} · {item.metadata?.steps ?? 30}s
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className={styles.tableActions}>
                            {isEditMode ? (
                              <button
                                className={styles.deleteQuickBtn}
                                onClick={() => handleDeleteItem(item.id)}
                                title="Delete image from library"
                              >
                                <TrashIcon size={14} />
                              </button>
                            ) : (
                              <>
                                <IconButton
                                  title="Copy prompt"
                                  onClick={() => copyText(item.metadata?.prompt || '', `table-${item.id}`)}
                                >
                                  {copiedField === `table-${item.id}` ? (
                                    <CheckIcon size={13} color="#4ade80" />
                                  ) : (
                                    <CopyIcon size={13} />
                                  )}
                                </IconButton>
                                <IconButton
                                  title="Inspect full extraction"
                                  onClick={() => openRecipeInResult(item)}
                                >
                                  <EyeIcon size={13} />
                                </IconButton>
                                <IconButton
                                  title="Delete"
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
                      ? 'Click to select for deletion'
                      : selectedItem?.id === item.id
                      ? `Click again to open full scan results for ${item.title}`
                      : `Click to select ${item.title} (orange border), click again to open full`
                  }
                >
                  <div className={styles.cardThumbWrap}>
                    <img src={item.thumbnailUrl} alt={item.title} className={styles.cardThumb} />

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
                          title="Delete this image"
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
                          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
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
                          title="Select for Diff comparison"
                        >
                          {isCompared ? '✓ Diff' : '+ Diff'}
                        </button>
                      </>
                    )}
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.cardTitle}>{item.title}</div>
                    <div className={styles.cardChipsRow}>
                      <span className={styles.chip}>{item.folder}</span>
                      <span className={styles.chip}>{item.source}</span>
                    </div>
                    <div className={styles.cardMetaRow}>
                      <span>{item.date}</span>
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
                          <span>Delete Image</span>
                        </button>
                      ) : (
                        <>
                          <IconButton
                            title="Copy prompt"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyText(item.metadata?.prompt || '', `card-${item.id}`);
                            }}
                          >
                            {copiedField === `card-${item.id}` ? <CheckIcon size={14} color="#4ade80" /> : <CopyIcon size={14} />}
                          </IconButton>
                          <IconButton
                            title="Open full extraction result"
                            onClick={(e) => {
                              e.stopPropagation();
                              openRecipeInResult(item);
                            }}
                          >
                            <EyeIcon size={14} />
                          </IconButton>
                          <IconButton
                            title="Delete from library"
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
              onClick={() => {
                if (!isEditMode) openRecipeInResult(activeItem);
              }}
              style={{ cursor: isEditMode ? 'default' : 'pointer' }}
              title={isEditMode ? undefined : 'Click to open full scan results'}
            >
              <img
                src={activeItem.thumbnailUrl}
                alt={activeItem.title}
                className={styles.detailImage}
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

            <div className={styles.detailContent}>
              <div className={styles.detailTitleRow}>
                <h3 className={styles.detailTitle}>{activeItem.title}</h3>
                <IconButton
                  title="Open in Recipe Inspector"
                  onClick={() => openRecipeInResult(activeItem)}
                >
                  <ExternalLinkIcon size={16} />
                </IconButton>
              </div>

              <div className={styles.detailChips}>
                <span className={styles.chip}>{activeItem.folder}</span>
                <span className={styles.chip}>{activeItem.source}</span>
                <span className={styles.chip}>{activeItem.model}</span>
              </div>

              {/* Prompt Section */}
              <div className={styles.detailSection}>
                <div className={styles.sectionHeader}>
                  <span>Prompt</span>
                  <button
                    className={styles.copyBtn}
                    onClick={() => copyText(activeItem.metadata?.prompt || '', 'detail-prompt')}
                  >
                    {copiedField === 'detail-prompt' ? (
                      <>
                        <CheckIcon size={12} color="#4ade80" /> Copied
                      </>
                    ) : (
                      <>
                        <CopyIcon size={12} /> Copy
                      </>
                    )}
                  </button>
                </div>
                <div className={styles.promptText}>
                  {activeItem.metadata?.prompt || '(No prompt saved)'}
                </div>
              </div>

              {/* Negative Prompt */}
              {activeItem.metadata?.negativePrompt && (
                <div className={styles.detailSection}>
                  <div className={styles.sectionHeader}>
                    <span>Negative Prompt</span>
                    <button
                      className={styles.copyBtn}
                      onClick={() =>
                        copyText(activeItem.metadata?.negativePrompt || '', 'detail-neg')
                      }
                    >
                      {copiedField === 'detail-neg' ? (
                        <>
                          <CheckIcon size={12} color="#4ade80" /> Copied
                        </>
                      ) : (
                        <>
                          <CopyIcon size={12} /> Copy
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
                  <span>Generation Parameters</span>
                </div>
                <div className={styles.paramGrid}>
                  <div className={styles.paramCard}>
                    <span className={styles.paramLabel}>Sampler</span>
                    <span className={styles.paramVal}>{activeItem.metadata?.sampler || 'Euler a'}</span>
                  </div>
                  <div className={styles.paramCard}>
                    <span className={styles.paramLabel}>Steps</span>
                    <span className={styles.paramVal}>{activeItem.metadata?.steps ?? 30}</span>
                  </div>
                  <div className={styles.paramCard}>
                    <span className={styles.paramLabel}>CFG Scale</span>
                    <span className={styles.paramVal}>{activeItem.metadata?.cfgScale ?? 7.0}</span>
                  </div>
                  <div className={styles.paramCard}>
                    <span className={styles.paramLabel}>Seed</span>
                    <span className={styles.paramVal}>{activeItem.metadata?.seed ?? 'Random'}</span>
                  </div>
                  <div className={styles.paramCard}>
                    <span className={styles.paramLabel}>Dimensions</span>
                    <span className={styles.paramVal}>{activeItem.dimensions}</span>
                  </div>
                  <div className={styles.paramCard}>
                    <span className={styles.paramLabel}>Created</span>
                    <span className={styles.paramVal}>{activeItem.date}</span>
                  </div>
                </div>
              </div>

              {/* Embedded LoRAs */}
              {activeItem.metadata?.loras && activeItem.metadata.loras.length > 0 && (
                <div className={styles.detailSection}>
                  <div className={styles.sectionHeader}>
                    <span>Embedded LoRAs ({activeItem.metadata.loras.length})</span>
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
              title="No Prompt Selected"
              description="Select a prompt card or table row from the list to view its complete generation parameters and embedded LoRAs."
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
      {isNewFolderOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsNewFolderOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Create New Folder</h3>
            <form onSubmit={handleCreateFolder} className={styles.modalForm}>
              <GlassInput
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g., Cyberpunk Series, Landscapes..."
                autoFocus
              />
              <div className={styles.modalActions}>
                <SecondaryButton type="button" onClick={() => setIsNewFolderOpen(false)}>
                  Cancel
                </SecondaryButton>
                <PrimaryButton type="submit" disabled={!newFolderName.trim()}>
                  Create Folder
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Prompt Recipe Modal */}
      {isNewPromptOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsNewPromptOpen(false)}>
          <div className={styles.modalCardLarge} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Save Custom Prompt Recipe</h3>
            <form onSubmit={handleCreatePrompt} className={styles.modalForm}>
              <div className={styles.formRow}>
                <div className={styles.formField}>
                  <label className={styles.label}>Recipe Title *</label>
                  <GlassInput
                    value={newPromptForm.title}
                    onChange={(e) =>
                      setNewPromptForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="e.g., Neon Samurai Portrait"
                    autoFocus
                    required
                  />
                </div>
                <div className={styles.formField}>
                  <label className={styles.label}>Folder</label>
                  <select
                    className={styles.selectInput}
                    value={newPromptForm.folder}
                    onChange={(e) =>
                      setNewPromptForm((prev) => ({ ...prev, folder: e.target.value }))
                    }
                  >
                    {folders
                      .filter((f) => f !== 'All Prompts')
                      .map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className={styles.formField}>
                <label className={styles.label}>Positive Prompt</label>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  value={newPromptForm.prompt}
                  onChange={(e) =>
                    setNewPromptForm((prev) => ({ ...prev, prompt: e.target.value }))
                  }
                  placeholder="Masterpiece, 8k portrait of..."
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.label}>Negative Prompt</label>
                <textarea
                  className={styles.textarea}
                  rows={2}
                  value={newPromptForm.negativePrompt}
                  onChange={(e) =>
                    setNewPromptForm((prev) => ({ ...prev, negativePrompt: e.target.value }))
                  }
                  placeholder="low quality, blurry, deformed..."
                />
              </div>

              <div className={styles.formRow3}>
                <div className={styles.formField}>
                  <label className={styles.label}>Model Checkpoint</label>
                  <GlassInput
                    value={newPromptForm.model}
                    onChange={(e) =>
                      setNewPromptForm((prev) => ({ ...prev, model: e.target.value }))
                    }
                  />
                </div>
                <div className={styles.formField}>
                  <label className={styles.label}>Sampler</label>
                  <GlassInput
                    value={newPromptForm.sampler}
                    onChange={(e) =>
                      setNewPromptForm((prev) => ({ ...prev, sampler: e.target.value }))
                    }
                  />
                </div>
                <div className={styles.formField}>
                  <label className={styles.label}>Steps</label>
                  <GlassInput
                    type="number"
                    value={newPromptForm.steps}
                    onChange={(e) =>
                      setNewPromptForm((prev) => ({
                        ...prev,
                        steps: parseInt(e.target.value, 10) || 30,
                      }))
                    }
                  />
                </div>
              </div>

              <div className={styles.modalActions}>
                <SecondaryButton type="button" onClick={() => setIsNewPromptOpen(false)}>
                  Cancel
                </SecondaryButton>
                <PrimaryButton type="submit" disabled={!newPromptForm.title.trim()}>
                  Save Recipe
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
