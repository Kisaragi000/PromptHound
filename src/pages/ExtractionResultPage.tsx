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
import styles from './ExtractionResultPage.module.css';

function CopyFieldButton({ value, label }: { value: string; label?: string }): React.ReactElement {
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
    <IconButton aria-label={label || 'Copy to clipboard'} onClick={handleCopy}>
      {copied ? <CheckIcon size={15} color="#4ade80" /> : <CopyIcon size={15} />}
    </IconButton>
  );
}

function LoraItemRow({ lora }: { lora: LoraReference }): React.ReactElement {
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
              {lora.hash ? `Hash: ${lora.hash.slice(0, 10)}…` : 'Direct tag'}
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

// Quality / rating boilerplate that makes a poor title ("score_9", "masterpiece")
const BOILERPLATE_TAG =
  /^(score_\d+(_up)?|rating_\w+|source_\w+|masterpiece|best quality|(very |ultra |absurdly )?(high|good|amazing|best|normal|low|worst) quality|very aesthetic|aesthetic|(very )?awa|absurdres|highres|hires|ultra detailed|highly detailed|detailed|8k|4k|uhd|hdr|newest|photo|safe|sfw|nsfw|solo|\d+\+?(girl|boy|other)s?)$/i;

/** A short title from the first descriptive prompt tag */
function recipeTitle(prompt: string | undefined): string {
  const tags = (prompt || '')
    .replace(/<[^>]+>/g, ' ')
    .split(/,|\n/)
    .map((t) => t.replace(/[()[\]{}]/g, '').replace(/:\s*[\d.]+\s*$/, '').replace(/\\/g, '').trim())
    .filter((t) => /\p{L}/u.test(t) && !BOILERPLATE_TAG.test(t));
  const title = tags[0] || '';
  return title.length > 40 ? `${title.slice(0, 38).trimEnd()}…` : title;
}

export const ExtractionResultPage: React.FC = () => {
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
      setExportFeedback('Card Saved!');
      setTimeout(() => setExportFeedback(null), 2500);
    } catch (err) {
      console.error('Save card image failed:', err);
      setExportFeedback('Save Failed');
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
            <p className={styles.loadingText}>Extracting image metadata & resolving LoRAs…</p>
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
          <ChevronLeftIcon size={16} /> Back to Home
        </button>
        {/* Other images in this batch stay reachable from the error screen */}
        {sessionImages.length > 1 && (
          <div style={{ maxWidth: '380px' }}>
            <MultiImageSessionStrip />
          </div>
        )}
        <EmptyStatePanel
          icon={<LinkIcon size={28} />}
          title="Could Not Extract Metadata"
          description={error?.message ?? 'An unknown error occurred while analyzing the image.'}
          action={
            <div style={{ display: 'flex', gap: '12px' }}>
              <PrimaryButton onClick={handleOpenImageClick}>
                <ImageIcon size={16} /> Select Another Image
              </PrimaryButton>
              <SecondaryButton
                onClick={() => {
                  reset();
                  navigate('home');
                }}
              >
                Back to Home
              </SecondaryButton>
            </div>
          }
        />
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
          title="No Image Analyzed Yet"
          description="Drop an AI-generated image anywhere, select an image file, or paste a URL on Home."
          action={
            <div style={{ display: 'flex', gap: '12px' }}>
              <PrimaryButton onClick={handleOpenImageClick}>
                <ImageIcon size={16} /> Open Image
              </PrimaryButton>
              <SecondaryButton onClick={() => navigate('home')}>
                Go to Home
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
          title="No Result Available"
          description="Please analyze an image first."
          action={<PrimaryButton onClick={() => navigate('home')}>Back to Home</PrimaryButton>}
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
    const title = recipeTitle(metadata.prompt) || metadata.model || 'AI Generation Recipe';

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
              <span>{sourceLabel} {metadata.width && metadata.height ? `(${metadata.width} × ${metadata.height})` : ''}</span>
              <button
                className={styles.lightboxCloseBtn}
                onClick={() => setIsLightboxOpen(false)}
              >
                ✕ Close (Esc)
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
        <div>
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
              ? 'Back to Library'
              : previousRoute === 'favorites'
              ? 'Back to Favorites'
              : 'Back to Home'}
          </button>
          <div className={styles.headerTitleRow}>
            <h1 className={styles.headerTitle}>
              {selectedLibraryItem ? selectedLibraryItem.title : 'Extraction Result'}
            </h1>
            <StatusBadge status="success" label={metadata.detectedFormat || 'Extracted'} />
          </div>
          <p className={styles.headerSubtitle}>
            {selectedLibraryItem
              ? `${selectedLibraryItem.folder} · ${selectedLibraryItem.model} · Parameters & LoRAs`
              : 'Parameters and checkpoint models parsed from image metadata'}
          </p>
        </div>

        <div className={styles.headerActions}>
          <SecondaryButton onClick={handleOpenImageClick}>
            <ImageIcon size={16} /> Open Another Image
          </SecondaryButton>
          <SecondaryButton onClick={handleCopyAll}>
            <CopyIcon size={16} /> Copy All
          </SecondaryButton>
          <SecondaryButton onClick={handleSaveImageCard} disabled={isExporting}>
            <ExportIcon size={16} /> {isExporting ? 'Saving…' : exportFeedback ?? 'Save Image Card'}
          </SecondaryButton>
          {savedItemId ? (
            <PrimaryButton
              onClick={handleSaveToLibrary}
              className={`${styles.savedButton} ${savePulse ? styles.savedPulse : ''}`}
              title="Saved to My Creations. Click to open it in the Prompt Library"
            >
              <CheckIcon size={16} /> Saved · View in Library
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={handleSaveToLibrary}>
              <BookmarkIcon size={16} /> Save to Library
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
            title="Click to view full image in lightbox"
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
                <span>No preview available</span>
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
                {sourceLabel}
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
              Overview
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'raw' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('raw')}
            >
              Raw Parameters
            </button>
          </div>

          {activeTab === 'overview' ? (
            <>
              {/* Positive Prompt */}
              <div className={styles.fieldCard}>
                <div className={styles.fieldHeader}>
                  <span className={styles.fieldLabel}>Prompt</span>
                  <CopyFieldButton value={metadata.prompt} label="Copy prompt" />
                </div>
                <div className={styles.fieldText}>{metadata.prompt || '(Empty prompt)'}</div>
                {/* One-Click Prompt Format Switcher */}
                <PromptFormatSelector metadata={metadata} loras={displayedLoras} />
              </div>

              {/* Negative Prompt */}
              {metadata.negativePrompt && (
                <div className={styles.fieldCard}>
                  <div className={styles.fieldHeader}>
                    <span className={styles.fieldLabel}>Negative Prompt</span>
                    <CopyFieldButton value={metadata.negativePrompt} label="Copy negative prompt" />
                  </div>
                  <div className={styles.fieldText}>{metadata.negativePrompt}</div>
                </div>
              )}

              {/* Generation Settings Row 1 */}
              <div className={styles.settingsGridRow1}>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Sampler</span>
                  <span className={styles.metricValue}>{metadata.sampler || '—'}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Steps</span>
                  <span className={styles.metricValue}>{metadata.steps ?? '—'}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>CFG Scale</span>
                  <span className={styles.metricValue}>{metadata.cfgScale ?? '—'}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Seed</span>
                  <span className={styles.metricValue}>{metadata.seed ?? '—'}</span>
                </div>
              </div>

              {/* Generation Settings Row 2: Model & Resolution */}
              <div className={styles.settingsGridRow2}>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Checkpoint File</span>
                  <span className={styles.metricValue}>
                    {metadata.model || metadata.modelHash || 'Unknown Checkpoint'}
                  </span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Dimensions</span>
                  <span className={styles.metricValue}>
                    {metadata.width && metadata.height
                      ? `${metadata.width} × ${metadata.height}`
                      : 'Not specified'}
                  </span>
                </div>
              </div>

              {/* Base model, identified like the LoRAs, with a preview image */}
              {(metadata.model || metadata.modelHash || metadata.modelResolved) && (
                <div style={{ marginTop: '8px' }}>
                  <h3 className={styles.loraSectionTitle}>Base Model</h3>
                  <div style={{ marginTop: '8px' }}>
                    <ModelCard model={metadata.model} modelHash={metadata.modelHash} resolved={metadata.modelResolved} />
                  </div>
                </div>
              )}

              {/* Embedded LoRAs */}
              {displayedLoras.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <h3 className={styles.loraSectionTitle}>
                    Embedded LoRAs ({displayedLoras.length})
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
                <span className={styles.fieldLabel}>All Extracted Parameters</span>
                <CopyFieldButton
                  value={JSON.stringify(metadata, null, 2)}
                  label="Copy JSON metadata"
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
              <span>Extraction Source</span>
              <PromptHoundLogo size={18} />
            </div>
            <div className={styles.sourceUrlBox}>
              <span className={styles.sourceUrlText}>{sourceLabel}</span>
            </div>
          </div>

          <div className={styles.sideSection}>
            <div className={styles.sideSectionTitle}>Quick Actions</div>
            <button className={styles.quickActionBtn} onClick={handleOpenImageClick}>
              <div className={styles.quickActionLeft}>
                <ImageIcon size={16} />
                <span>Open Another Image</span>
              </div>
            </button>
            <button
              className={styles.quickActionBtn}
              onClick={handleSaveImageCard}
              disabled={isExporting}
            >
              <div className={styles.quickActionLeft}>
                <ExportIcon size={16} />
                <span>{isExporting ? 'Saving…' : (exportFeedback ?? 'Save Image Card')}</span>
              </div>
            </button>
            <button className={styles.quickActionBtn} onClick={handleCopyAll}>
              <div className={styles.quickActionLeft}>
                <CopyIcon size={16} />
                <span>Copy All Settings</span>
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
                <span>Extract from URL</span>
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
          sourceLabel={sourceLabel}
        />
      </div>
    </div>
  );
};

