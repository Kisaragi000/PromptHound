import React, { forwardRef, useState } from 'react';
import type { ExtractedMetadata, LoraReference } from '../../core/types.js';
import { LayersIcon, PromptHoundLogo } from './icons/Icons.js';
import { useT, getLanguage } from '../i18n/index.js';
import styles from './ExportCard.module.css';

// Generator shown in the card header; unknown formats show no badge
const FORMAT_LABELS: Partial<Record<ExtractedMetadata['detectedFormat'], string>> = {
  a1111: 'A1111 / Forge',
  comfyui: 'ComfyUI',
  novelai: 'NovelAI',
  invokeai: 'InvokeAI',
  swarmui: 'SwarmUI',
  fooocus: 'Fooocus',
};

/** Model preview; shows an icon when there is no image or it cannot be loaded */
const Thumb: React.FC<{ url?: string; size: number; alt: string }> = ({ url, size, alt }) => {
  const [failed, setFailed] = useState(false);
  return (
    <div className={styles.thumb} style={{ width: size, height: size }}>
      {url && !failed ? (
        <img src={url} alt={alt} crossOrigin="anonymous" onError={() => setFailed(true)} />
      ) : (
        <LayersIcon size={Math.round(size * 0.42)} />
      )}
    </div>
  );
};

interface ExportCardProps {
  metadata: ExtractedMetadata;
  previewUrl?: string;
  sourceLabel?: string;
}

export const ExportCard = forwardRef<HTMLDivElement, ExportCardProps>(({ metadata, previewUrl, sourceLabel }, ref) => {
  const t = useT();
  const formatLabel =
    metadata.detectedFormat === 'page-json' ? t('card.webPage') : FORMAT_LABELS[metadata.detectedFormat];
  const formattedDate = new Date().toLocaleDateString({ en: 'en-US', ru: 'ru-RU', zh: 'zh-CN' }[getLanguage()], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Tall images fill the left column, so the model and LoRAs go under the settings;
  // wide images leave room for them under the picture
  const isPortrait = Boolean(metadata.width && metadata.height && metadata.height > metadata.width * 1.1);

  const modelAndLoras = (
    <>
      {/* Base Model */}
      {(metadata.model || metadata.modelResolved) && (
        <div className={styles.modelBlock}>
          <Thumb url={metadata.modelResolved?.coverImageUrl} size={64} alt="Base model preview" />
          <div className={styles.modelInfo}>
            <div className={styles.sectionLabel}>{t('param.baseModel')}</div>
            <div className={styles.modelName}>{metadata.modelResolved?.name ?? metadata.model}</div>
            <div className={styles.chipRow}>
              {metadata.modelResolved?.versionName && (
                <span className={styles.chip}>{metadata.modelResolved.versionName}</span>
              )}
              {metadata.modelResolved?.baseModel && (
                <span className={styles.chip}>{metadata.modelResolved.baseModel}</span>
              )}
              {!metadata.modelResolved && metadata.modelHash && (
                <span className={styles.chip}>{t('card.hash', { hash: metadata.modelHash.slice(0, 10) })}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LoRAs */}
      {metadata.loras && metadata.loras.length > 0 && (
        <div className={styles.loraSection}>
          <div className={styles.sectionLabel}>{t('param.loras', { count: metadata.loras.length })}</div>
          <div className={styles.loraGrid}>
            {metadata.loras.map((lora: LoraReference, idx: number) => (
              <div key={idx} className={styles.loraRow}>
                <Thumb url={lora.resolved?.coverImageUrl} size={44} alt="LoRA preview" />
                <div className={styles.loraInfo}>
                  <div className={styles.loraName}>{lora.resolved?.name ?? lora.rawName}</div>
                  {(lora.resolved?.baseModel || lora.resolved?.versionName) && (
                    <div className={styles.loraMeta}>
                      {[lora.resolved?.versionName, lora.resolved?.baseModel].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <span className={styles.loraStrength}>
                  {lora.strength !== undefined ? `× ${lora.strength}` : '× 1'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div ref={ref} className={styles.exportCard}>
      {/* Header */}
      <div className={styles.cardHeader}>
        <div className={styles.brandGroup}>
          <PromptHoundLogo size={32} />
          <div>
            <div className={styles.brandTitle}>PromptHound</div>
            <div className={styles.brandSubtitle}>{t('card.subtitle')}</div>
          </div>
        </div>
        {formatLabel && <div className={styles.formatBadge}>{formatLabel}</div>}
      </div>

      {/* Body Grid */}
      <div className={styles.bodyGrid}>
        {/* Left Column: Image Preview */}
        <div className={styles.imageSection}>
          {previewUrl && (
            <div className={styles.imageFrame}>
              <img src={previewUrl} alt="Generation export" className={styles.previewImg} crossOrigin="anonymous" />
            </div>
          )}
          <div className={styles.imageInfoRow}>
            <span>{metadata.width && metadata.height ? `${metadata.width} × ${metadata.height} px` : ''}</span>
            <span>{sourceLabel ? sourceLabel.slice(0, 32) : t('card.imageSource')}</span>
          </div>

          {!isPortrait && modelAndLoras}
        </div>

        {/* Right Column: Prompts & Parameters */}
        <div className={styles.contentSection}>
          {/* Positive Prompt */}
          {metadata.prompt && (
            <div className={styles.promptBlock}>
              <div className={styles.promptLabel}>{t('param.prompt')}</div>
              <div className={styles.promptText}>{metadata.prompt}</div>
            </div>
          )}

          {/* Negative Prompt */}
          {metadata.negativePrompt && (
            <div className={styles.negativePromptBlock}>
              <div className={styles.negativeLabel}>{t('param.negativePrompt')}</div>
              <div className={styles.negativeText}>{metadata.negativePrompt}</div>
            </div>
          )}

          {/* Parameters Grid */}
          <div className={styles.paramsGrid}>
            <div className={styles.paramCard}>
              <div className={styles.paramLabel}>{t('param.sampler')}</div>
              <div className={styles.paramValue}>{metadata.sampler ?? t('card.default')}</div>
            </div>

            <div className={styles.paramCard}>
              <div className={styles.paramLabel}>{t('param.steps')}</div>
              <div className={styles.paramValue}>{metadata.steps ?? '-'}</div>
            </div>

            <div className={styles.paramCard}>
              <div className={styles.paramLabel}>{t('param.cfgScale')}</div>
              <div className={styles.paramValue}>{metadata.cfgScale ?? '-'}</div>
            </div>

            <div className={styles.paramCard}>
              <div className={styles.paramLabel}>{t('param.seed')}</div>
              <div className={styles.paramValue}>{metadata.seed ?? '-'}</div>
            </div>
          </div>

          {isPortrait && modelAndLoras}
        </div>
      </div>

      {/* Footer */}
      <div className={styles.cardFooter}>
        <span>{t('card.footer')}</span>
        <span>{formattedDate}</span>
      </div>
    </div>
  );
});

ExportCard.displayName = 'ExportCard';
