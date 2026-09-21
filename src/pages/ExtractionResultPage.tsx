import React, { useState, useRef } from 'react';
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
import { LoraCard } from '../components/lora/LoraCard.js';
import { LoraDetailsModal } from '../components/lora/LoraDetailsModal.js';
import { PromptFormatSelector } from '../components/recipe/PromptFormatSelector.js';
import { LoraMixerPanel } from '../components/recipe/LoraMixerPanel.js';
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

export const ExtractionResultPage: React.FC = () => {
  const { navigate, activeMetadata, activePreviewUrl, saveToLibrary } = useNavigation();
  const { status, result, error, reset, extractFromFile } = useExtraction();
  const [activeTab, setActiveTab] = useState<'overview' | 'raw'>('overview');
  const [isSaved, setIsSaved] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [inspectingLora, setInspectingLora] = useState<LoraReference | null>(null);
  const [customLoras, setCustomLoras] = useState<LoraReference[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportCardRef = useRef<HTMLDivElement>(null);

  // Fallback to activeMetadata/activePreviewUrl if navigation provided one (e.g. from Library or Favorites)
  const metadata: ExtractedMetadata | null =
    result?.metadata ?? (activeMetadata as ExtractedMetadata | null);

  const displayedLoras = customLoras ?? metadata?.loras ?? [];

  const handleUpdateLora = (updatedLora: LoraReference) => {
    const list = displayedLoras.map((l) =>
      l.rawName === updatedLora.rawName ? updatedLora : l
    );
    setCustomLoras(list);
  };
  const previewUrl = result?.previewUrl ?? activePreviewUrl ?? (activeMetadata as any)?.image?.url;
  const sourceLabel =
    result?.source.label ?? (activeMetadata as any)?.source?.url ?? 'Imported source';

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await extractFromFile(file);
    }
  };

  const handleOpenImageClick = async () => {
    if (window.promptHound?.extraction?.openFileDialog) {
      const selected = await window.promptHound.extraction.openFileDialog();
      if (selected) {
        // Electron IPC extraction
        return;
      }
    }
    fileInputRef.current?.click();
  };

  const handleSaveImageCard = async () => {
    if (!exportCardRef.current || isExporting) return;
    try {
      setIsExporting(true);
      const dataUrl = await toPng(exportCardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      });
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
    // Generate clean descriptive title from prompt or model
    const title =
      metadata.prompt
        ?.split(/,|\n/)[0]
        ?.trim()
        ?.slice(0, 36) ||
      metadata.model ||
      'AI Generation Recipe';

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

    saveToLibrary({
      title,
      folder: 'My Creations',
      source: sourcePlatform,
      model: metadata.model || 'Stable Diffusion',
      dimensions,
      isFavorite: false,
      thumbnailUrl: previewUrl || '',
      metadata,
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
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
    <div className={styles.page}>
      {/* Hidden File Picker */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png,image/webp,image/jpeg"
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
              reset();
              navigate('home');
            }}
          >
            <ChevronLeftIcon size={16} /> Back to Home
          </button>
          <div className={styles.headerTitleRow}>
            <h1 className={styles.headerTitle}>Extraction Result</h1>
            <StatusBadge status="success" label={metadata.detectedFormat || 'Extracted'} />
          </div>
          <p className={styles.headerSubtitle}>
            Parameters and checkpoint models parsed from image metadata
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
          <PrimaryButton onClick={handleSaveToLibrary}>
            <BookmarkIcon size={16} /> {isSaved ? 'Saved to Library' : 'Save to Library'}
          </PrimaryButton>
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
                  <span className={styles.metricLabel}>Base Model / Checkpoint</span>
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
          metadata={metadata}
          previewUrl={previewUrl}
          sourceLabel={sourceLabel}
        />
      </div>
    </div>
  );
};

