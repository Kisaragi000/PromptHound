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
  RefreshIcon,
} from '../components/icons/Icons.js';
import { GlassCard } from '../components/primitives/GlassCard.js';
import { PrimaryButton } from '../components/primitives/PrimaryButton.js';
import { SecondaryButton } from '../components/primitives/SecondaryButton.js';
import { GlassInput } from '../components/primitives/GlassInput.js';
import { InstallWizardModal } from '../components/setup/InstallWizardModal.js';
import { BatchExtractionQueue, type BatchItem } from '../components/home/BatchExtractionQueue.js';
import { RecentExtractionsStrip } from '../components/home/RecentExtractionsStrip.js';
import { useUpdateStatus } from '../components/shell/useUpdateStatus.js';
import { useNavigation } from '../navigation/NavigationContext.js';
import { useExtraction } from '../extraction/ExtractionContext.js';
import type { SavedPromptItem } from '../../core/types.js';
import { useT } from '../i18n/index.js';
import styles from './HomePage.module.css';

export const HomePage: React.FC = () => {
  const t = useT();
  const {
    navigate,
    libraryItems,
    saveToLibrary,
    openRecipeInResult,
    setActiveMetadata,
    setActivePreviewUrl,
  } = useNavigation();

  const { extractFromFile, extractMultipleFiles, extractFromFilePath, extractFromUrl } = useExtraction();

  const [showUrlModal, setShowUrlModal] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);

  // Setup Wizard Modal state; once finished, the banner shrinks to a quiet "run again" line
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [setupCompleted, setSetupCompleted] = useState(() => {
    try {
      return localStorage.getItem('prompthound_setup_completed') === 'true';
    } catch {
      return false;
    }
  });

  // A new version takes the setup banner's place while it downloads and until it is installed
  const updateStatus = useUpdateStatus();
  const [dismissedUpdate, setDismissedUpdate] = useState<string | null>(null);
  const pendingUpdate =
    updateStatus &&
    (updateStatus.state === 'available' || updateStatus.state === 'downloading' || updateStatus.state === 'downloaded') &&
    updateStatus.version !== dismissedUpdate
      ? updateStatus
      : null;

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
      setBatchNotice(t('home.batchLimit'));
      setTimeout(() => setBatchNotice(null), 4000);
      files = files.slice(0, 10);
    }

    // Direct multi-image session extraction
    navigate('result');
    void extractMultipleFiles(files);
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
    setBatchFeedback(t('home.savedToLibrary', { count }));
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

      {/* Update Banner (replaces the setup banner while a new version is on its way) */}
      {pendingUpdate ? (
        <div className={styles.wizardBanner} role="status">
          <div className={styles.wizardBannerLeft}>
            <RefreshIcon size={18} />
            <div>
              {pendingUpdate.state === 'downloaded' ? (
                <>
                  <strong>{t('update.home.readyTitle', { version: pendingUpdate.version })}</strong>{' '}
                  {t('update.home.readyBody')}
                </>
              ) : (
                <>
                  <strong>
                    {t('update.home.availableTitle', { version: pendingUpdate.version ? ` v${pendingUpdate.version}` : '' })}
                  </strong>{' '}
                  {t('update.home.availableBody', {
                    percent: pendingUpdate.state === 'downloading' ? ` (${pendingUpdate.percent}%)` : '',
                  })}
                </>
              )}
            </div>
          </div>
          {pendingUpdate.state === 'downloaded' && (
            <div className={styles.wizardBannerLeft}>
              <button className={styles.wizardBannerLater} onClick={() => setDismissedUpdate(pendingUpdate.version)}>
                {t('common.later')}
              </button>
              <button className={styles.wizardBannerBtn} onClick={() => window.promptHound?.updates?.install()}>
                {t('update.restart')}
              </button>
            </div>
          )}
        </div>
      ) : setupCompleted ? (
        <div className={`${styles.wizardBanner} ${styles.wizardBannerDone}`}>
          <div className={styles.wizardBannerLeft}>
            <SparklesIcon size={16} />
            <div>{t('home.setupDone')}</div>
          </div>
          <button className={styles.wizardBannerLater} onClick={() => setIsWizardOpen(true)}>
            {t('home.runAgain')}
          </button>
        </div>
      ) : (
        <div className={styles.wizardBanner}>
          <div className={styles.wizardBannerLeft}>
            <SparklesIcon size={18} />
            <div>
              <strong>{t('home.setupTitle')}</strong> {t('home.setupBody')}
            </div>
          </div>
          <button className={styles.wizardBannerBtn} onClick={() => setIsWizardOpen(true)}>
            {t('home.runSetup')}
          </button>
        </div>
      )}

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
          {t('home.welcome')} Prompt<span className={styles.heroTitleAccent}>Hound</span>
        </h1>
        <p className={styles.heroSubtitle}>
          {t('home.subtitle1')}
          <br />
          {t('home.subtitle2')}
        </p>
      </section>

      {/* 3 Primary Action Cards */}
      <section className={styles.actionGrid}>
        {/* Card A: Paste URL */}
        <GlassCard className={styles.actionCard} interactive onClick={() => setShowUrlModal(true)}>
          <div className={styles.actionIconWrap}>
            <LinkIcon size={24} />
          </div>
          <h3 className={styles.actionTitle}>{t('home.pasteUrl')}</h3>
          <p className={styles.actionDescription}>
            {t('home.pasteUrlBody')}
          </p>
          <div className={styles.actionButtonRow}>
            <PrimaryButton
              fullWidth
              onClick={(e) => {
                e.stopPropagation();
                setShowUrlModal(true);
              }}
            >
              {t('home.enterUrl')}
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
            {isCardHovered ? t('home.dropRelease') : t('home.dropTitle')}
          </h3>
          <p className={styles.actionDescription}>
            {t('home.dropBody')}
          </p>
          <div className={styles.actionButtonRow}>
            <SecondaryButton
              fullWidth
              onClick={(e) => {
                e.stopPropagation();
                void handleBrowseFilesClick();
              }}
            >
              {t('home.browseFiles')}
            </SecondaryButton>
          </div>
        </GlassCard>

        {/* Card C: Explore Library */}
        <GlassCard className={styles.actionCard} interactive onClick={() => navigate('library')}>
          <div className={styles.actionIconWrap}>
            <BookmarkIcon size={24} />
          </div>
          <h3 className={styles.actionTitle}>{t('nav.library')}</h3>
          <p className={styles.actionDescription}>
            {t('home.libraryBody')}
          </p>
          <div className={styles.actionButtonRow}>
            <SecondaryButton
              fullWidth
              onClick={(e) => {
                e.stopPropagation();
                navigate('library');
              }}
            >
              {t('home.openLibrary')}
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
            <strong>{t('home.feature1Title')}</strong>
            <span>{t('home.feature1Body')}</span>
          </div>
        </div>

        <div className={styles.featureDivider} />

        <div className={styles.featureItem}>
          <div className={styles.featureIcon}>
            <GlobeIcon size={18} />
          </div>
          <div className={styles.featureText}>
            <strong>{t('home.feature2Title')}</strong>
            <span>{t('home.feature2Body')}</span>
          </div>
        </div>

        <div className={styles.featureDivider} />

        <div className={styles.featureItem}>
          <div className={styles.featureIcon}>
            <SparklesIcon size={18} />
          </div>
          <div className={styles.featureText}>
            <strong>{t('home.feature3Title')}</strong>
            <span>{t('home.feature3Body')}</span>
          </div>
        </div>
      </section>

      {/* URL Input Modal */}
      {showUrlModal && (
        <div className={styles.modalOverlay} onClick={() => setShowUrlModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>{t('home.urlModalTitle')}</h3>
            <p className={styles.modalSubtitle}>
              {t('home.urlModalBody')}
            </p>
            <form onSubmit={handleUrlSubmit} className={styles.modalForm}>
              <GlassInput
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder={t('home.urlPlaceholder')}
                icon={<LinkIcon size={16} />}
                autoFocus
              />
              <div className={styles.modalActions}>
                <SecondaryButton type="button" onClick={() => setShowUrlModal(false)}>
                  {t('common.cancel')}
                </SecondaryButton>
                <PrimaryButton type="submit" disabled={!inputUrl.trim()}>
                  {t('home.extractMetadata')}
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
          setSetupCompleted(true);
        }}
      />
    </div>
  );
};
