import React, { useState } from 'react';
import type { LoraReference } from '../../../core/types.js';
import { ExternalLinkIcon, LayersIcon } from '../icons/Icons.js';
import { MATCH_LABELS, NAME_MATCH_PILL_STYLE } from './LoraCard.js';
import { useT } from '../../i18n/index.js';
import styles from './LoraCard.module.css';

interface ModelCardProps {
  /** Checkpoint name as written in the image metadata */
  model?: string;
  modelHash?: string;
  resolved?: LoraReference['resolved'];
}

/**
 * The image's base model (checkpoint), shown like a LoRA card with a larger preview so
 * the model can be recognized at a glance.
 */
export const ModelCard: React.FC<ModelCardProps> = ({ model, modelHash, resolved }) => {
  const t = useT();
  const displayName = resolved?.name || model || modelHash || t('model.unknown');
  // Offline or a removed image: show the icon instead of broken-image alt text
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const cover = resolved?.coverImageUrl;
  const matchInfo = resolved?.matchedBy ? MATCH_LABELS[resolved.matchedBy] : undefined;
  // Show the file name from the metadata when it differs from the catalog title
  const fileName = model && resolved && model.trim().toLowerCase() !== resolved.name.trim().toLowerCase() ? model : undefined;

  const openLink = (e: React.MouseEvent, url: string) => {
    if (window.promptHound?.openExternal) {
      e.preventDefault();
      window.promptHound.openExternal(url);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.mainRow}>
        <div className={styles.thumbWrapper} style={{ width: 72, height: 72 }}>
          {cover && cover !== failedCover ? (
            <img
              src={cover}
              alt={displayName}
              className={styles.thumbImg}
              loading="lazy"
              onError={() => setFailedCover(cover)}
            />
          ) : (
            <div className={styles.thumbFallback}>
              <LayersIcon size={26} />
            </div>
          )}
          {resolved?.source && <span className={styles.sourceBadge}>{resolved.source}</span>}
        </div>

        <div className={styles.infoColumn}>
          <div className={styles.titleRow}>
            {resolved?.modelUrl ? (
              <a
                href={resolved.modelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.titleLink}
                onClick={(e) => openLink(e, resolved.modelUrl)}
                title={displayName}
              >
                {displayName}
                <ExternalLinkIcon size={12} />
              </a>
            ) : (
              <span className={styles.unresolvedTitle} title={displayName}>
                {displayName}
              </span>
            )}
          </div>

          {fileName && (
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }} title={fileName}>
              {fileName}
            </div>
          )}

          <div className={styles.metaRow}>
            {matchInfo && (
              <span
                className={styles.tagPill}
                style={resolved?.matchedBy === 'name-match' ? NAME_MATCH_PILL_STYLE : undefined}
                title={t(matchInfo.title)}
              >
                {t(matchInfo.label)}
                {resolved?.matchedBy === 'name-match' && resolved.matchScore !== undefined
                  ? ` ${Math.round(resolved.matchScore * 100)}%`
                  : ''}
              </span>
            )}
            {resolved?.baseModel && <span className={styles.tagPill}>{resolved.baseModel}</span>}
            {resolved?.versionName && <span className={styles.tagPill}>{resolved.versionName}</span>}
            {!resolved && modelHash && <span className={styles.tagPill}>{t('model.hash', { hash: modelHash.slice(0, 10) })}</span>}
            {!resolved && <span className={styles.tagPill}>{t('model.notIdentified')}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
