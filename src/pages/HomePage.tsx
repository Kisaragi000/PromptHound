import React, { useState, useRef, useEffect } from 'react';
import {
  PromptHoundLogo,
  LinkIcon,
  CloudUploadIcon,
  StarIcon,
  GlobeIcon,
  CpuIcon,
  BookmarkIcon,
  SparklesIcon,
  LightningIcon,
} from '../components/icons/Icons.js';
import { GlassCard } from '../components/primitives/GlassCard.js';
import { PrimaryButton } from '../components/primitives/PrimaryButton.js';
import { SecondaryButton } from '../components/primitives/SecondaryButton.js';
import { GlassInput } from '../components/primitives/GlassInput.js';
import { InstallWizardModal } from '../components/setup/InstallWizardModal.js';
import { BatchExtractionQueue, type BatchItem } from '../components/home/BatchExtractionQueue.js';
import { RecentExtractionsStrip } from '../components/home/RecentExtractionsStrip.js';
import { useNavigation } from '../navigation/NavigationContext.js';
import { useExtraction } from '../extraction/ExtractionContext.js';
import type { SavedPromptItem } from '../../core/types.js';
import styles from './HomePage.module.css';

export const HomePage: React.FC = () => {
  const {
    navigate,
    libraryItems,
    saveToLibrary,
    openRecipeInResult,
    setActiveMetadata,
    setActivePreviewUrl,
  } = useNavigation();

  const { extractFromFile, extractFromFilePath, extractFromUrl } = useExtraction();

  const [showUrlModal, setShowUrlModal] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);

  // Setup Wizard Modal state
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  // Process a batch of files (max 10)
  const processBatchFiles = async (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList).filter((f) =>
      /\.(png|webp|jpg|jpeg|jfif|avif)$/i.test(f.name) || f.type.startsWith('image/')
    );

    if (rawFiles.length === 0) return;

    // Strict 10 file ceiling
    let files = rawFiles;
    if (files.length > 10) {
      setBatchNotice('Batch extraction is limited to 10 images at once. Processing first 10.');
      setTimeout(() => setBatchNotice(null), 4000);
      files = files.slice(0, 10);
    }

    if (files.length === 1) {
      // Single file - navigate directly to result
      navigate('result');
      void extractFromFile(files[0]);
      return;
    }

    // Multiple files (2 to 10) - populate batch queue
    const initialBatch: BatchItem[] = files.map((f, idx) => ({
      id: `batch_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      file: f,
      previewUrl: URL.createObjectURL(f),
      status: 'pending',
    }));

    setBatchItems(initialBatch);

    // Progressively extract metadata for each file in queue
    const { extractFromImageBuffer } = await import('../../core/link-fetch.js');

    for (const item of initialBatch) {
      setBatchItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'parsing' } : i))
      );

      try {
        const arrayBuffer = await item.file.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        const outcome = await extractFromImageBuffer(
          uint8,
          { kind: 'file', label: item.file.name },
          item.previewUrl
        );

        if ('code' in outcome) {
          setBatchItems((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, status: 'error', error: outcome.message } : i
            )
          );
        } else {
          setBatchItems((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, status: 'success', metadata: outcome.metadata } : i
            )
          );
        }
      } catch (err) {
        setBatchItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: 'error', error: err instanceof Error ? err.message : 'Parse error' }
              : i
          )
        );
      }
    }
  };

  const handleUrlSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUrl = inputUrl.trim();
    if (!cleanUrl) return;

    setShowUrlModal(false);
    setInputUrl('');
    navigate('result');
    void extractFromUrl(cleanUrl);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCardHovered(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void processBatchFiles(e.dataTransfer.files);
    }
  };

  const handleBrowseFilesClick = async () => {
    // If running in Electron desktop app, use native file picker dialog
    if (window.promptHound?.extraction) {
      const filePath = await window.promptHound.extraction.openFileDialog();
      if (filePath) {
        navigate('result');
        void extractFromFilePath(filePath);
        return;
      }
    }

    // Web / browser fallback: trigger standard file input
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void processBatchFiles(e.target.files);
    }
  };

  const handleBatchInspect = (item: BatchItem) => {
    if (item.metadata) {
      setActiveMetadata(item.metadata);
      setActivePreviewUrl(item.previewUrl);
      navigate('result');
    }
  };

  const handleRemoveBatchItem = (id: string) => {
    setBatchItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleClearBatch = () => {
    setBatchItems([]);
  };

  const handleSaveAllBatchToLibrary = () => {
    setIsSavingAll(true);
    let count = 0;
    batchItems.forEach((item) => {
      if (item.status === 'success' && item.metadata) {
        const title =
          item.metadata.prompt?.split(/,|\n/)[0]?.trim()?.slice(0, 32) ||
          item.file.name.replace(/\.[^/.]+$/, '');

        saveToLibrary({
          title,
          folder: 'My Creations',
          source: 'Local File',
          model: item.metadata.model || 'Stable Diffusion',
          dimensions:
            item.metadata.width && item.metadata.height
              ? `${item.metadata.width} × ${item.metadata.height}`
              : '1024 × 1024',
          isFavorite: false,
          thumbnailUrl: item.previewUrl,
          metadata: item.metadata,
        });
        count++;
      }
    });

    setIsSavingAll(false);
    setBatchFeedback(`Saved ${count} to Library!`);
    setTimeout(() => setBatchFeedback(null), 3000);
  };

  return (
    <div className={styles.page}>
      {/* Hidden File Inputs for Web Mode */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        accept=".png,.jpg,.jpeg,.webp,.jfif,.avif,image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
      />

      {/* Setup Wizard Banner */}
      <div className={styles.wizardBanner}>
        <div className={styles.wizardBannerLeft}>
          <SparklesIcon size={18} />
          <div>
            <strong>Quick Setup Wizard:</strong> Configure Civitai API key, workflow syntax, and local model paths.
          </div>
        </div>
        <button className={styles.wizardBannerBtn} onClick={() => setIsWizardOpen(true)}>
          Run Setup Wizard
        </button>
      </div>

      {/* Batch Notice Toast */}
      {batchNotice && <div className={styles.toastNotice}>{batchNotice}</div>}

      {/* Batch Extraction Queue Section (If items present) */}
      {batchItems.length > 0 && (
        <BatchExtractionQueue
          items={batchItems}
          onSelectInspect={handleBatchInspect}
          onRemoveItem={handleRemoveBatchItem}
          onClearAll={handleClearBatch}
          onSaveAllToLibrary={handleSaveAllBatchToLibrary}
          isSavingAll={isSavingAll}
          saveFeedback={batchFeedback}
        />
      )}

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroIconWrap}>
          <PromptHoundLogo size={56} />
        </div>
        <h1 className={styles.heroTitle}>
          Welcome to Prompt<span className={styles.heroTitleAccent}>Hound</span>
        </h1>
        <p className={styles.heroSubtitle}>
          Extract generation metadata, LoRAs, checkpoints, and parameters from any AI image.
          <br />
          Organize prompts. Build your creative library.
        </p>
      </section>

      {/* 3 Primary Action Cards */}
      <section className={styles.actionGrid}>
        {/* Card A: Paste URL */}
        <GlassCard className={styles.actionCard} interactive onClick={() => setShowUrlModal(true)}>
          <div className={styles.actionIconWrap}>
            <LinkIcon size={24} />
          </div>
          <h3 className={styles.actionTitle}>Paste URL</h3>
          <p className={styles.actionDescription}>
            Input a Civitai post, SeaArt artwork, or direct image URL to extract embedded generation metadata.
          </p>
          <div className={styles.actionButtonRow}>
            <PrimaryButton
              fullWidth
              onClick={(e) => {
                e.stopPropagation();
                setShowUrlModal(true);
              }}
            >
              Enter URL
            </PrimaryButton>
          </div>
        </GlassCard>

        {/* Card B: Drag & Drop (Supports up to 10 batch images) */}
        <GlassCard
          className={`${styles.actionCard} ${isCardHovered ? styles.actionCardActive : ''}`}
          interactive
          onDragOver={(e) => {
            e.preventDefault();
            setIsCardHovered(true);
          }}
          onDragLeave={() => setIsCardHovered(false)}
          onDrop={handleFileDrop}
          onClick={handleBrowseFilesClick}
        >
          <div className={styles.actionIconWrap}>
            <CloudUploadIcon size={24} />
          </div>
          <h3 className={styles.actionTitle}>
            {isCardHovered ? 'Release to Analyze (Up to 10)' : 'Drop Images (1–10 Max)'}
          </h3>
          <p className={styles.actionDescription}>
            Drag and drop up to 10 AI-generated PNGs or WebPs at once, or browse your local folders.
          </p>
          <div className={styles.actionButtonRow}>
            <SecondaryButton
              fullWidth
              onClick={(e) => {
                e.stopPropagation();
                void handleBrowseFilesClick();
              }}
            >
              Browse Files
            </SecondaryButton>
          </div>
        </GlassCard>

        {/* Card C: Explore Library */}
        <GlassCard className={styles.actionCard} interactive onClick={() => navigate('library')}>
          <div className={styles.actionIconWrap}>
            <BookmarkIcon size={24} />
          </div>
          <h3 className={styles.actionTitle}>Prompt Library</h3>
          <p className={styles.actionDescription}>
            Browse your saved collection of prompt recipes, compare generations, or filter by LoRA.
          </p>
          <div className={styles.actionButtonRow}>
            <SecondaryButton
              fullWidth
              onClick={(e) => {
                e.stopPropagation();
                navigate('library');
              }}
            >
              Open Library
            </SecondaryButton>
          </div>
        </GlassCard>
      </section>

      {/* Recent Extractions Strip */}
      <RecentExtractionsStrip
        items={libraryItems}
        onSelect={(item) => openRecipeInResult(item)}
      />

      {/* Feature Strip / Stats Strip */}
      <section className={styles.featureStrip}>
        <div className={styles.featureItem}>
          <div className={styles.featureIcon}>
            <CpuIcon size={18} />
          </div>
          <div className={styles.featureText}>
            <strong>Zero Latency Parsing</strong>
            <span>Instant client-side PNG chunk and ComfyUI graph extraction</span>
          </div>
        </div>

        <div className={styles.featureDivider} />

        <div className={styles.featureItem}>
          <div className={styles.featureIcon}>
            <GlobeIcon size={18} />
          </div>
          <div className={styles.featureText}>
            <strong>Civitai Auto-Resolution</strong>
            <span>Hashes resolved to real LoRA names, versions, and trained trigger tags</span>
          </div>
        </div>

        <div className={styles.featureDivider} />

        <div className={styles.featureItem}>
          <div className={styles.featureIcon}>
            <SparklesIcon size={18} />
          </div>
          <div className={styles.featureText}>
            <strong>Universal Formats</strong>
            <span>Full support for Automatic1111, Forge, ComfyUI, SDXL, and WebUI</span>
          </div>
        </div>
      </section>

      {/* URL Input Modal */}
      {showUrlModal && (
        <div className={styles.modalOverlay} onClick={() => setShowUrlModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Extract from Web Link</h3>
            <p className={styles.modalSubtitle}>
              Paste a link to a Civitai post, image page, or a direct .png/.webp image URL:
            </p>
            <form onSubmit={handleUrlSubmit} className={styles.modalForm}>
              <GlassInput
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://civitai.com/images/4819201 or direct image link..."
                icon={<LinkIcon size={16} />}
                autoFocus
              />
              <div className={styles.modalActions}>
                <SecondaryButton type="button" onClick={() => setShowUrlModal(false)}>
                  Cancel
                </SecondaryButton>
                <PrimaryButton type="submit" disabled={!inputUrl.trim()}>
                  Extract Metadata
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Install / First-Flight Setup Wizard Modal */}
      <InstallWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onComplete={() => {
          setIsWizardOpen(false);
        }}
      />
    </div>
  );
};
