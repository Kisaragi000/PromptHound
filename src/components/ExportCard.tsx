import React, { forwardRef } from 'react';
import type { ExtractedMetadata, LoraReference } from '../../core/types.js';
import { PromptHoundLogo } from './icons/Icons.js';
import styles from './ExportCard.module.css';

// Generator shown in the card header; unknown formats show no badge
const FORMAT_LABELS: Partial<Record<ExtractedMetadata['detectedFormat'], string>> = {
  a1111: 'A1111 / Forge',
  comfyui: 'ComfyUI',
  novelai: 'NovelAI',
  invokeai: 'InvokeAI',
  swarmui: 'SwarmUI',
  fooocus: 'Fooocus',
  'page-json': 'Web Page',
};

interface ExportCardProps {
  metadata: ExtractedMetadata;
  previewUrl?: string;
  sourceLabel?: string;
}

export const ExportCard = forwardRef<HTMLDivElement, ExportCardProps>(
  ({ metadata, previewUrl, sourceLabel }, ref) => {
    const formattedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    return (
      <div ref={ref} className={styles.exportCard}>
        {/* Header */}
        <div className={styles.cardHeader}>
          <div className={styles.brandGroup}>
            <PromptHoundLogo size={32} />
            <div>
              <div className={styles.brandTitle}>PromptHound</div>
              <div className={styles.brandSubtitle}>AI Generation Metadata Card</div>
            </div>
          </div>
          {FORMAT_LABELS[metadata.detectedFormat] && (
            <div className={styles.formatBadge}>{FORMAT_LABELS[metadata.detectedFormat]}</div>
          )}
        </div>

        {/* Body Grid */}
        <div className={styles.bodyGrid}>
          {/* Left Column: Image Preview */}
          <div className={styles.imageSection}>
            {previewUrl && (
              <div className={styles.imageFrame}>
                <img
                  src={previewUrl}
                  alt="Generation export"
                  className={styles.previewImg}
                  crossOrigin="anonymous"
                />
              </div>
            )}
            <div className={styles.imageInfoRow}>
              <span>{metadata.width && metadata.height ? `${metadata.width} × ${metadata.height} px` : ''}</span>
              <span>{sourceLabel ? sourceLabel.slice(0, 32) : 'Image Source'}</span>
            </div>
          </div>

          {/* Right Column: Prompts & Parameters */}
          <div className={styles.contentSection}>
            {/* Positive Prompt */}
            {metadata.prompt && (
              <div className={styles.promptBlock}>
                <div className={styles.promptLabel}>Prompt</div>
                <div className={styles.promptText}>{metadata.prompt}</div>
              </div>
            )}

            {/* Negative Prompt */}
            {metadata.negativePrompt && (
              <div className={styles.negativePromptBlock}>
                <div className={styles.negativeLabel}>Negative Prompt</div>
                <div className={styles.negativeText}>{metadata.negativePrompt}</div>
              </div>
            )}

            {/* Parameters Grid */}
            <div className={styles.paramsGrid}>
              <div className={styles.paramCard}>
                <div className={styles.paramLabel}>Model</div>
                <div className={styles.paramValue} title={metadata.model ?? 'Unknown'}>
                  {metadata.model ?? 'Unknown'}
                </div>
              </div>

              <div className={styles.paramCard}>
                <div className={styles.paramLabel}>Sampler</div>
                <div className={styles.paramValue}>{metadata.sampler ?? 'Default'}</div>
              </div>

              <div className={styles.paramCard}>
                <div className={styles.paramLabel}>Steps</div>
                <div className={styles.paramValue}>{metadata.steps ?? '-'}</div>
              </div>

              <div className={styles.paramCard}>
                <div className={styles.paramLabel}>CFG Scale</div>
                <div className={styles.paramValue}>{metadata.cfgScale ?? '-'}</div>
              </div>

              <div className={styles.paramCard}>
                <div className={styles.paramLabel}>Seed</div>
                <div className={styles.paramValue}>{metadata.seed ?? '-'}</div>
              </div>

              {metadata.modelHash && (
                <div className={styles.paramCard}>
                  <div className={styles.paramLabel}>Model Hash</div>
                  <div className={styles.paramValue}>{metadata.modelHash}</div>
                </div>
              )}
            </div>

            {/* LoRAs list */}
            {metadata.loras && metadata.loras.length > 0 && (
              <div className={styles.loraSection}>
                <div className={styles.loraLabel}>LoRA Weights ({metadata.loras.length})</div>
                <div className={styles.loraTagsList}>
                  {metadata.loras.map((lora: LoraReference, idx: number) => {
                    const loraName = lora.resolved?.name ?? lora.rawName;
                    const strengthText = lora.strength !== undefined ? `× ${lora.strength}` : '';
                    return (
                      <div key={idx} className={styles.loraPill}>
                        <span>{loraName}</span>
                        {strengthText && <span className={styles.loraStrength}>{strengthText}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.cardFooter}>
          <span>Generated with PromptHound</span>
          <span>{formattedDate}</span>
        </div>
      </div>
    );
  }
);

ExportCard.displayName = 'ExportCard';
