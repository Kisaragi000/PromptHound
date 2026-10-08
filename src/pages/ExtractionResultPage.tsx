import React, { useState, useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';
import {
  ChevronLeftIcon,
  CopyIcon,
  CheckIcon,
  ExternalLinkIcon,
  BookmarkIcon,
  ImageIcon,
  LinkIcon,
  ExportIcon,
  PromptHoundLogo,
} from '../components/icons/Icons.js';
import { StatusBadge } from '../components/primitives/StatusBadge.js';
import { PrimaryButton } from '../components/primitives/PrimaryButton.js';
import { SecondaryButton } from '../components/primitives/SecondaryButton.js';
import { IconButton } from '../components/primitives/IconButton.js';
import { EmptyStatePanel } from '../components/primitives/EmptyStatePanel.js';
import { ExportCard } from '../components/ExportCard.js';
import { ContentCredentialsPanel } from '../components/recipe/ContentCredentialsPanel.js';
import { recipeTitle } from '../utils/recipeTitle.js';
import { imageToDataUrl } from '../utils/images.js';
import { ModelCard } from '../components/lora/ModelCard.js';
import { LoraCard } from '../components/lora/LoraCard.js';
import { LoraDetailsModal } from '../components/lora/LoraDetailsModal.js';
import { PromptFormatSelector } from '../components/recipe/PromptFormatSelector.js';
import { LoraMixerPanel } from '../components/recipe/LoraMixerPanel.js';
import { MultiImageSessionStrip } from '../components/recipe/MultiImageSessionStrip.js';
import { useNavigation } from '../navigation/NavigationContext.js';
import { useExtraction } from '../extraction/ExtractionContext.js';
import type { LoraReference, ExtractedMetadata } from '../../core/types.js';
import { useT } from '../i18n/index.js';
import { folderLabel, sourceLabel as sourceName, translateMessage } from '../i18n/labels.js';
import styles from './ExtractionResultPage.module.css';

function CopyFieldButton({ value, label }: { value: string; label?: string }): React.ReactElement {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <IconButton aria-label={label || t('common.copyToClipboard')} onClick={handleCopy}>
      {copied ? <CheckIcon size={15} color="#4ade80" /> : <CopyIcon size={15} />}
    </IconButton>
  );
}

function LoraItemRow({ lora }: { lora: LoraReference }): React.ReactElement {
  const t = useT();
  return (
    <div className={styles.loraRow}>
      <div className={styles.loraLeft}>
        <div>
          <div className={styles.loraName}>
            {lora.resolved?.name ?? lora.rawName}
          </div>
          {lora.resolved ? (
            <a
              className={styles.loraLink}
              href={lora.resolved.modelUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (window.promptHound?.openExternal) {
                  e.preventDefault();
                  window.promptHound.openExternal(lora.resolved!.modelUrl);
                }
              }}
            >
              civitai.com <ExternalLinkIcon size={11} />
            </a>
          ) : (
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {lora.hash ? t('result.hash', { hash: lora.hash.slice(0, 10) }) : t('result.directTag')}
            </span>
          )}
        </div>
      </div>
      {lora.strength !== undefined && (
        <span className={styles.loraStrength}>{lora.strength.toFixed(2)}</span>
      )}
    </div>
  );
}

export const ExtractionResultPage: React.FC = () => {
  const t = useT();
  const {
    navigate,
    previousRoute,
    goBack,
    activeMetadata,
    setActiveMetadata,
    activePreviewUrl,
    setActivePreviewUrl,
    selectedLibraryItem,
    setSelectedLibraryItem,
    saveToLibrary,
    libraryItems,
    showInLibrary,
  } = useNavigation();
  const {
    status,
    result,
    error,
    reset,
    extractFromFile,
    extractFromFilePath,
    extractMultipleFiles,
    addSessionImages,
    sessionImages,
    activeImageIndex,
  } = useExtraction();
  const [activeTab, setActiveTab] = useState<'overview' | 'raw'>('overview');
  // Library item saved from this result; the button then shows it and opens it
  const [savedItemId, setSavedItemId] = useState<string | null>(null);
  const [savePulse, setSavePulse] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [inspectingLora, setInspectingLora] = useState<LoraReference | null>(null);
  const [customLoras, setCustomLoras] = useState<LoraReference[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportCardRef = useRef<HTMLDivElement>(null);

  // activeMetadata is set only while a saved recipe (library, favorites, recent strip)
  // or a batch item is being inspected; every new extraction clears it. Deciding by
  // anything else (e.g. the previous route) showed stale library images after a drop.
  const isViewingSavedRecipe = Boolean(activeMetadata);
  const isFromLibraryOrFavorites = Boolean(selectedLibraryItem);

  const metadata: ExtractedMetadata | null = isViewingSavedRecipe
    ? (activeMetadata as ExtractedMetadata)
    : (result?.metadata ?? null);

  // Esc closes the full-size image view, as its close button promises
  useEffect(() => {
    if (!isLightboxOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsLightboxOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isLightboxOpen]);

  // LoRA edits (re-link / unlink) belong to the image they were made on
  useEffect(() => {
    setCustomLoras(null);
    setSavedItemId(null);
  }, [result, activeMetadata]);

  const displayedLoras = customLoras ?? metadata?.loras ?? [];

  const handleUpdateLora = (updatedLora: LoraReference) => {
    const list = displayedLoras.map((l) =>
      l.rawName === updatedLora.rawName ? updatedLora : l
    );
    setCustomLoras(list);
  };
  const previewUrl = isViewingSavedRecipe
    ? (activePreviewUrl || selectedLibraryItem?.thumbnailUrl || (activeMetadata as any)?.image?.url || null)
    : (result?.previewUrl ?? null);

  const sourceLabel = isFromLibraryOrFavorites && selectedLibraryItem
    ? `${selectedLibraryItem.source || 'Saved'} · ${selectedLibraryItem.folder || 'Library'}`
    : (result?.source.label ?? (activeMetadata as any)?.source?.url ?? 'Imported source');
  // The same, in the interface language (sourceLabel itself also decides the saved source below)
  const sourceDisplay = isFromLibraryOrFavorites && selectedLibraryItem
    ? `${selectedLibraryItem.source ? sourceName(selectedLibraryItem.source) : t('source.saved')} · ${selectedLibraryItem.folder ? folderLabel(selectedLibraryItem.folder) : t('source.library')}`
    : (result?.source.label ?? (activeMetadata as any)?.source?.url ?? t('source.imported'));

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedLibraryItem(null);
      setActiveMetadata(null);
      setActivePreviewUrl(null);
      if (files.length === 1) {
        await extractFromFile(files[0]);
      } else {
        await extractMultipleFiles(Array.from(files));
      }
      e.target.value = '';
    }
  };

  const handleOpenImageClick = async () => {
    if (window.promptHound?.extraction?.openFileDialog) {
      const selected = await window.promptHound.extraction.openFileDialog();
      if (selected) {
        await extractFromFilePath(selected);
        return;
      }
    }
    fileInputRef.current?.click();
  };

  const handleDropOnPage = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedLibraryItem(null);
      setActiveMetadata(null);
      setActivePreviewUrl(null);
      const files = Array.from(e.dataTransfer.files);
      if (sessionImages.length > 0) {
        await addSessionImages(files);
      } else {
        await extractMultipleFiles(files);
      }
    }
  };

  const handleSaveImageCard = async () => {
    if (!exportCardRef.current || isExporting) return;
    try {
      setIsExporting(true);
      // Embed every image first: html-to-image cannot re-fetch blob: previews of dropped
      // files (they rendered as black boxes), and its cache-busting query breaks them too.
      const node = exportCardRef.current;
      const images = Array.from(node.querySelectorAll('img'));
      const originals = images.map((img) => img.getAttribute('src'));
      await Promise.all(
        images.map(async (img, i) => {
          const embedded = await imageToDataUrl(originals[i]);
          if (!embedded) return;
          img.src = embedded;
          await img.decode().catch(() => undefined);
        })
      );
      let dataUrl: string;
      try {
        dataUrl = await toPng(node, {
          pixelRatio: 2,
          cacheBust: false,
          // A preview that cannot be read (offline) must not abort the export
          imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
        });
      } finally {
        images.forEach((img, i) => {
          const original = originals[i];
          if (original && img.getAttribute('src') !== original) img.src = original;
        });
      }
      const link = document.createElement('a');
      const baseFilename = metadata?.model
        ? `PromptHound-${metadata.model.replace(/[^a-z0-9]/gi, '_')}-Card.png`
        : `PromptHound-Card-${Date.now()}.png`;
      link.download = baseFilename;
      link.href = dataUrl;
      link.click();
      setExportFeedback(t('result.cardSaved'));
      setTimeout(() => setExportFeedback(null), 2500);
    } catch (err) {
      console.error('Save card image failed:', err);
      setExportFeedback(t('result.saveFailed'));
      setTimeout(() => setExportFeedback(null), 2500);
    } finally {
      setIsExporting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.loadingWrap}>
          <div style={{ textAlign: 'center' }}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>{t('result.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.page}>
        <input
          type="file"
          ref={fileInputRef}
          accept=".png,.jpg,.jpeg,.webp,.jfif,.avif,image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
        <button
          className={styles.backBtn}
          onClick={() => {
            reset();
            navigate('home');
          }}
        >
          <ChevronLeftIcon size={16} /> {t('common.backToHome')}
        </button>
        {/* Other images in this batch stay reachable from the error screen */}
        {sessionImages.length > 1 && (
          <div style={{ maxWidth: '380px' }}>
            <MultiImageSessionStrip />
          </div>
        )}
        {error?.contentCredentials ? (
          <ContentCredentialsPanel
            credentials={error.contentCredentials}
            previewUrl={sessionImages[activeImageIndex]?.previewUrl}
            fileName={sessionImages[activeImageIndex]?.file?.name}
            onSelectAnother={handleOpenImageClick}
            onBackHome={() => {
              reset();
              navigate('home');
            }}
          />
        ) : (
        <EmptyStatePanel
          icon={<LinkIcon size={28} />}
          title={t('result.errorTitle')}
          description={error?.message ? translateMessage(error.message) : t('result.unknownError')}
          action={
            <div style={{ display: 'flex', gap: '12px' }}>
              <PrimaryButton onClick={handleOpenImageClick}>
                <ImageIcon size={16} /> {t('common.selectAnotherImage')}
              </PrimaryButton>
              <SecondaryButton
                onClick={() => {
                  reset();
                  navigate('home');
                }}
              >
                {t('common.backToHome')}
              </SecondaryButton>
            </div>
          }
        />
        )}
      </div>
    );
  }

  if (!metadata && status === 'idle') {
    return (
      <div className={styles.page}>
        <input
          type="file"
          ref={fileInputRef}
          accept=".png,.jpg,.jpeg,.webp,.jfif,.avif,image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
        <EmptyStatePanel
          icon={<LinkIcon size={28} />}
          title={t('result.emptyTitle')}
          description={t('result.emptyBody')}
          action={
            <div style={{ display: 'flex', gap: '12px' }}>
              <PrimaryButton onClick={handleOpenImageClick}>
                <ImageIcon size={16} /> {t('result.openImage')}
              </PrimaryButton>
              <SecondaryButton onClick={() => navigate('home')}>
                {t('common.goToHome')}
              </SecondaryButton>
            </div>
          }
        />
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className={styles.page}>
        <EmptyStatePanel
          icon={<LinkIcon size={28} />}
          title={t('result.noResultTitle')}
          description={t('result.noResultBody')}
          action={<PrimaryButton onClick={() => navigate('home')}>{t('common.backToHome')}</PrimaryButton>}
        />
      </div>
    );
  }

  const handleSaveToLibrary = () => {
    // Already saved: show it instead of saving a duplicate
    if (savedItemId && libraryItems.some((i) => i.id === savedItemId)) {
      showInLibrary(savedItemId);
      return;
    }
    // Generate clean descriptive title from prompt or model
    const title = recipeTitle(metadata.prompt) || metadata.model || t('result.defaultTitle');

    const sourcePlatform: 'Civitai' | 'SeaArt' | 'Local File' | 'Clipboard' | 'Web' =
      sourceLabel.toLowerCase().includes('civitai')
        ? 'Civitai'
        : sourceLabel.toLowerCase().includes('seaart')
        ? 'SeaArt'
        : sourceLabel.toLowerCase().includes('file') || sourceLabel.toLowerCase().includes('.png') || sourceLabel.toLowerCase().includes('.jpg') || sourceLabel.toLowerCase().includes('.webp')
        ? 'Local File'
        : 'Web';

    const dimensions =
      metadata.width && metadata.height
        ? `${metadata.width} × ${metadata.height}`
        : '1024 × 1024';

    const saved = saveToLibrary({
      title,
      folder: 'My Creations',
      source: sourcePlatform,
      model: metadata.model || 'Stable Diffusion',
      dimensions,
      isFavorite: false,
      thumbnailUrl: previewUrl || '',
      // Keep LoRA re-links / unlinks made on this page
      metadata: { ...metadata, loras: displayedLoras },
    });

    setSavedItemId(saved.id);
    setSavePulse(true);
    setTimeout(() => setSavePulse(false), 700);
  };

  const handleCopyAll = async () => {
    const rawParams = [
      metadata.prompt,
      metadata.negativePrompt ? `Negative prompt: ${metadata.negativePrompt}` : '',
      [
        metadata.steps ? `Steps: ${metadata.steps}` : '',
        metadata.sampler ? `Sampler: ${metadata.sampler}` : '',
        metadata.cfgScale ? `CFG scale: ${metadata.cfgScale}` : '',
        metadata.seed ? `Seed: ${metadata.seed}` : '',
        metadata.width && metadata.height ? `Size: ${metadata.width}x${metadata.height}` : '',
        metadata.model ? `Model: ${metadata.model}` : '',
      ]
        .filter(Boolean)
        .join(', '),
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(rawParams);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className={styles.page}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={handleDropOnPage}
    >
      {/* Hidden File Picker */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept="image/png,image/webp,image/jpeg,image/jfif,image/avif"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* Lightbox Modal */}
      {isLightboxOpen && previewUrl && (
        <div
          className={styles.lightboxBackdrop}
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className={styles.lightboxContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.lightboxBar}>
              <span>{sourceDisplay} {metadata.width && metadata.height ? `(${metadata.width} × ${metadata.height})` : ''}</span>
              <button
                className={styles.lightboxCloseBtn}
                onClick={() => setIsLightboxOpen(false)}
              >
                {t('result.closeEsc')}
              </button>
            </div>
            <img
              src={previewUrl}
              alt="Full-size inspection"
              className={styles.lightboxImage}
            />
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className={styles.header}>
        <div className={styles.headerTitleBlock}>
          <button
            className={styles.backBtn}
            onClick={() => {
              if (previousRoute) {
                goBack();
              } else {
                reset();
                navigate('home');
              }
            }}
          >
            <ChevronLeftIcon size={16} />{' '}
            {previousRoute === 'library'
              ? t('common.backToLibrary')
              : previousRoute === 'favorites'
              ? t('common.backToFavorites')
              : t('common.backToHome')}
          </button>
          <div className={styles.headerTitleRow}>
            <h1 className={styles.headerTitle}>
              {selectedLibraryItem ? selectedLibraryItem.title : t('result.title')}
            </h1>
            <StatusBadge status="success" label={metadata.detectedFormat || t('result.extracted')} />
          </div>
          <p className={styles.headerSubtitle}>
            {selectedLibraryItem
              ? t('result.subtitleSaved', {
                  folder: selectedLibraryItem.folder ? folderLabel(selectedLibraryItem.folder) : t('folder.unfiled'),
                  model: selectedLibraryItem.model,
                })
              : t('result.subtitle')}
          </p>
        </div>

        <div className={styles.headerActions}>
          <SecondaryButton onClick={handleOpenImageClick}>
            <ImageIcon size={16} /> {t('result.openAnother')}
          </SecondaryButton>
          <SecondaryButton onClick={handleCopyAll}>
            <CopyIcon size={16} /> {t('result.copyAll')}
          </SecondaryButton>
          <SecondaryButton onClick={handleSaveImageCard} disabled={isExporting}>
            <ExportIcon size={16} /> {isExporting ? t('common.saving') : exportFeedback ?? t('result.saveCard')}
          </SecondaryButton>
          {savedItemId ? (
            <PrimaryButton
              onClick={handleSaveToLibrary}
              className={`${styles.savedButton} ${savePulse ? styles.savedPulse : ''}`}
              title={t('result.savedTitle')}
            >
              <CheckIcon size={16} /> {t('result.savedView')}
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={handleSaveToLibrary}>
              <BookmarkIcon size={16} /> {t('result.saveToLibrary')}
            </PrimaryButton>
          )}
        </div>
      </div>

      {/* 3-Column Workspace Grid */}
      <div className={styles.workspaceGrid}>
        {/* Left: Image Preview & Details */}
        <div className={styles.imagePanel}>
          <div
            className={styles.imageWrap}
            onClick={() => {
              if (previewUrl) setIsLightboxOpen(true);
            }}
            title={t('result.viewFull')}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Analyzed source"
                className={styles.mainImage}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--color-text-muted)',
                  gap: 8,
                }}
              >
                <ImageIcon size={32} />
                <span>{t('result.noPreview')}</span>
              </div>
            )}
          </div>

          <div className={styles.imageCaption}>
            <div className={styles.imageCaptionLeft}>
              <LinkIcon size={13} />
              <span
                style={{
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {sourceDisplay}
              </span>
            </div>
            {metadata.width && metadata.height && (
              <span className={styles.resolutionText}>
                {metadata.width} × {metadata.height}
              </span>
            )}
          </div>

          {/* Multi-Image Session Carousel & Switcher Strip */}
          {!isFromLibraryOrFavorites && <MultiImageSessionStrip />}
        </div>

        {/* Center: Metadata Fields & Tabs */}
        <div className={styles.centerPanel}>
          <div className={styles.tabsRow}>
            <button
              className={`${styles.tab} ${activeTab === 'overview' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              {t('result.tabOverview')}
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'raw' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('raw')}
            >
              {t('result.tabRaw')}
            </button>
          </div>

          {activeTab === 'overview' ? (
            <>
              {/* Positive Prompt */}
              <div className={styles.fieldCard}>
                <div className={styles.fieldHeader}>
                  <span className={styles.fieldLabel}>{t('param.prompt')}</span>
                  <CopyFieldButton value={metadata.prompt} label={t('common.copyPrompt')} />
                </div>
                <div className={styles.fieldText}>{metadata.prompt || t('param.emptyPrompt')}</div>
                {/* One-Click Prompt Format Switcher */}
                <PromptFormatSelector metadata={metadata} loras={displayedLoras} />
              </div>

              {/* Negative Prompt */}
              {metadata.negativePrompt && (
                <div className={styles.fieldCard}>
                  <div className={styles.fieldHeader}>
                    <span className={styles.fieldLabel}>{t('param.negativePrompt')}</span>
                    <CopyFieldButton value={metadata.negativePrompt} label={t('result.copyNegative')} />
                  </div>
                  <div className={styles.fieldText}>{metadata.negativePrompt}</div>
                </div>
              )}

              {/* Generation Settings Row 1 */}
              <div className={styles.settingsGridRow1}>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t('param.sampler')}</span>
                  <span className={styles.metricValue}>{metadata.sampler || '—'}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t('param.steps')}</span>
                  <span className={styles.metricValue}>{metadata.steps ?? '—'}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t('param.cfgScale')}</span>
                  <span className={styles.metricValue}>{metadata.cfgScale ?? '—'}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t('param.seed')}</span>
                  <span className={styles.metricValue}>{metadata.seed ?? '—'}</span>
                </div>
              </div>

              {/* Generation Settings Row 2: Model & Resolution */}
              <div className={styles.settingsGridRow2}>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t('result.checkpointFile')}</span>
                  <span className={styles.metricValue}>
                    {metadata.model || metadata.modelHash || t('result.unknownCheckpoint')}
                  </span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>{t('param.dimensions')}</span>
                  <span className={styles.metricValue}>
                    {metadata.width && metadata.height
                      ? `${metadata.width} × ${metadata.height}`
                      : t('result.notSpecified')}
                  </span>
                </div>
              </div>

              {/* Base model, identified like the LoRAs, with a preview image */}
              {(metadata.model || metadata.modelHash || metadata.modelResolved) && (
                <div style={{ marginTop: '8px' }}>
                  <h3 className={styles.loraSectionTitle}>{t('param.baseModel')}</h3>
                  <div style={{ marginTop: '8px' }}>
                    <ModelCard model={metadata.model} modelHash={metadata.modelHash} resolved={metadata.modelResolved} />
                  </div>
                </div>
              )}

              {/* Embedded LoRAs */}
              {displayedLoras.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <h3 className={styles.loraSectionTitle}>
                    {t('param.embeddedLoras', { count: displayedLoras.length })}
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      marginTop: '8px',
                    }}
                  >
                    {displayedLoras.map((lora, i) => (
                      <LoraCard
                        key={`${lora.rawName}-${i}`}
                        lora={lora}
                        onInspect={(l) => setInspectingLora(l)}
                      />
                    ))}
                  </div>

                  {/* Interactive LoRA Weight & Trigger Mixer */}
                  <LoraMixerPanel
                    loras={displayedLoras}
                    basePrompt={metadata.prompt}
                    onUpdateLoraStrength={(rawName, strength) => {
                      const updated = displayedLoras.map((l) =>
                        l.rawName === rawName ? { ...l, strength } : l
                      );
                      setCustomLoras(updated);
                    }}
                  />
                </div>
              )}
            </>
          ) : (
            <div className={styles.fieldCard}>
              <div className={styles.fieldHeader}>
                <span className={styles.fieldLabel}>{t('result.allParams')}</span>
                <CopyFieldButton
                  value={JSON.stringify(metadata, null, 2)}
                  label={t('result.copyJson')}
                />
              </div>
              <pre
                style={{
                  fontSize: '12px',
                  color: 'var(--color-text-secondary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '420px',
                  overflowY: 'auto',
                }}
              >
                {JSON.stringify(metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Right Side Panel: Quick Actions & Source Info */}
        <div className={styles.rightPanel}>
          <div className={styles.sideSection}>
            <div className={styles.sideSectionTitle}>
              <span>{t('result.source')}</span>
              <PromptHoundLogo size={18} />
            </div>
            <div className={styles.sourceUrlBox}>
              <span className={styles.sourceUrlText}>{sourceDisplay}</span>
            </div>
          </div>

          <div className={styles.sideSection}>
            <div className={styles.sideSectionTitle}>{t('result.quickActions')}</div>
            <button className={styles.quickActionBtn} onClick={handleOpenImageClick}>
              <div className={styles.quickActionLeft}>
                <ImageIcon size={16} />
                <span>{t('result.openAnother')}</span>
              </div>
            </button>
            <button
              className={styles.quickActionBtn}
              onClick={handleSaveImageCard}
              disabled={isExporting}
            >
              <div className={styles.quickActionLeft}>
                <ExportIcon size={16} />
                <span>{isExporting ? t('common.saving') : (exportFeedback ?? t('result.saveCard'))}</span>
              </div>
            </button>
            <button className={styles.quickActionBtn} onClick={handleCopyAll}>
              <div className={styles.quickActionLeft}>
                <CopyIcon size={16} />
                <span>{t('result.copyAllSettings')}</span>
              </div>
            </button>
            <button
              className={styles.quickActionBtn}
              onClick={() => {
                reset();
                navigate('home');
              }}
            >
              <div className={styles.quickActionLeft}>
                <LinkIcon size={16} />
                <span>{t('result.extractFromUrl')}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* LoRA Details & Re-link Modal */}
      {inspectingLora && (
        <LoraDetailsModal
          lora={inspectingLora}
          isOpen={Boolean(inspectingLora)}
          onClose={() => setInspectingLora(null)}
          onUpdateLora={handleUpdateLora}
        />
      )}

      {/* Off-screen Export Card captured by html-to-image */}
      <div
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          pointerEvents: 'none',
          zIndex: -1,
        }}
        aria-hidden="true"
      >
        <ExportCard
          ref={exportCardRef}
          metadata={{ ...metadata, loras: displayedLoras }}
          previewUrl={previewUrl}
          sourceLabel={sourceDisplay}
        />
      </div>
    </div>
  );
};

