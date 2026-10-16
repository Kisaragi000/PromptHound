import React, { useState } from 'react';
import type { LoraReference, LoraMatchMethod } from '../../../core/types.js';
import { ExternalLinkIcon, CopyIcon, CheckIcon, LayersIcon, SearchIcon } from '../icons/Icons.js';
import styles from './LoraCard.module.css';
import { isSeaArtLink, seaartSearchUrl } from '../../../core/seaart.js';
import { useT, type StringKey } from '../../i18n/index.js';

/** Site name for a model page link: "Civitai", "Civitai.red", or the host ("huggingface.co") */
export function linkSiteName(url: string): string {
  if (url.includes('civitai.red')) return 'Civitai.red';
  if (isSeaArtLink(url)) return 'SeaArt';
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return /(^|\.)civitai\.(com|green)$/.test(host) ? 'Civitai' : host;
  } catch {
    return 'Civitai';
  }
}

/** Corner badge on the cover: where the model was found; a hand-pasted link shows its site, or "link" */
export function sourceBadgeText(resolved: NonNullable<LoraReference['resolved']>): string {
  if (resolved.source !== 'link') return resolved.source;
  const site = linkSiteName(resolved.modelUrl);
  return site.startsWith('Civitai') ? 'civitai' : site === 'SeaArt' ? 'seaart' : 'link';
}

export const MATCH_LABELS: Record<LoraMatchMethod, { label: StringKey; title: StringKey }> = {
  hash: { label: 'lora.match.hash', title: 'lora.match.hashTitle' },
  'civitai-version': { label: 'lora.match.civitai', title: 'lora.match.civitaiTitle' },
  'name-match': { label: 'lora.match.name', title: 'lora.match.nameTitle' },
  manual: { label: 'lora.match.manual', title: 'lora.match.manualTitle' },
  local: { label: 'lora.match.local', title: 'lora.match.localTitle' },
};

// Name matches are guesses; tint them so they stand apart from exact identifications
export const NAME_MATCH_PILL_STYLE: React.CSSProperties = {
  background: 'rgba(245, 158, 11, 0.16)',
  borderColor: 'rgba(245, 158, 11, 0.4)',
  color: '#fcd34d',
};

interface LoraCardProps {
  lora: LoraReference;
  onOpenLink?: (url: string) => void;
  onInspect?: (lora: LoraReference) => void;
  /** Makes the weight clickable to type a new one */
  onChangeStrength?: (strength: number) => void;
}

export const LoraCard: React.FC<LoraCardProps> = ({ lora, onOpenLink, onInspect, onChangeStrength }) => {
  const t = useT();
  const [copiedTrigger, setCopiedTrigger] = useState<string | null>(null);
  // Offline or a removed image: show the icon instead of broken-image alt text
  const [failedCover, setFailedCover] = useState<string | null>(null);

  const strength = lora.strength ?? 1.0;
  const [weightDraft, setWeightDraft] = useState<string | null>(null);
  const weightText = strength.toFixed(2).replace(/\.?0+$/, '') || '0';

  const commitWeight = () => {
    if (weightDraft === null) return;
    const value = Number(weightDraft.replace(',', '.'));
    setWeightDraft(null);
    if (weightDraft.trim() && Number.isFinite(value) && value !== strength) onChangeStrength?.(Math.round(value * 100) / 100);
  };
  const strengthPercent = Math.min(Math.max((strength / 1.5) * 100, 5), 100);

  const handleCopyTrigger = (word: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(word);
    setCopiedTrigger(word);
    setTimeout(() => setCopiedTrigger(null), 1800);
  };

  const handleLinkClick = (e: React.MouseEvent, url: string) => {
    if (window.promptHound?.openExternal) {
      e.preventDefault();
      window.promptHound.openExternal(url);
    } else if (onOpenLink) {
      e.preventDefault();
      onOpenLink(url);
    }
  };

  const displayName = lora.resolved?.name || lora.rawName;
  const seaartUrl = seaartSearchUrl(displayName);
  const coverImg = lora.resolved?.coverImageUrl;
  const triggerWords = lora.resolved?.triggerWords || [];
  const matchedBy = lora.resolved?.matchedBy;
  const matchInfo = matchedBy ? MATCH_LABELS[matchedBy] : undefined;
  const matchScore = lora.resolved?.matchScore;

  return (
    <div
      className={styles.card}
      onClick={() => onInspect?.(lora)}
      style={{ cursor: onInspect ? 'pointer' : 'default' }}
      title={onInspect ? t('lora.inspectTitle') : undefined}
    >
      <div className={styles.mainRow}>
        {/* Thumbnail Preview */}
        <div className={styles.thumbWrapper}>
          {coverImg && coverImg !== failedCover ? (
            <img
              src={coverImg}
              alt={displayName}
              className={styles.thumbImg}
              loading="lazy"
              onError={() => setFailedCover(coverImg)}
            />
          ) : (
            <div className={styles.thumbFallback}>
              <LayersIcon size={22} />
            </div>
          )}
          {lora.resolved?.source && (
            <span className={styles.sourceBadge}>{sourceBadgeText(lora.resolved)}</span>
          )}
        </div>

        {/* Details and Strength Bar */}
        <div className={styles.infoColumn}>
          <div className={styles.titleRow}>
            {lora.resolved?.modelUrl ? (
              <a
                href={lora.resolved.modelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.titleLink}
                onClick={(e) => {
                  e.stopPropagation();
                  handleLinkClick(e, lora.resolved!.modelUrl);
                }}
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {onInspect && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInspect(lora);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '4px',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    fontSize: '10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title={t('lora.inspectSearch')}
                >
                  <SearchIcon size={10} />
                  {lora.resolved ? t('lora.inspect') : t('lora.link')}
                </button>
              )}
              {seaartUrl && (
                <a
                  href={seaartUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.seaartLink}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLinkClick(e, seaartUrl);
                  }}
                  title={t('lora.searchSeaart', { name: displayName })}
                >
                  SeaArt
                </a>
              )}
              {weightDraft !== null ? (
                <input
                  className={styles.weightInput}
                  type="number"
                  step={0.05}
                  value={weightDraft}
                  onChange={(e) => setWeightDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={commitWeight}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') commitWeight();
                    if (e.key === 'Escape') setWeightDraft(null);
                  }}
                  onFocus={(e) => e.target.select()}
                  aria-label={t('newPrompt.loraWeight')}
                  autoFocus
                />
              ) : onChangeStrength ? (
                <button
                  type="button"
                  className={`${styles.weightBadge} ${styles.weightBadgeButton}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setWeightDraft(weightText);
                  }}
                  title={t('lora.changeWeight')}
                >
                  {weightText}
                </button>
              ) : (
                <div className={styles.weightBadge}>{weightText}</div>
              )}
            </div>
          </div>

          {/* Strength Slider Bar */}
          <div className={styles.sliderRow}>
            <div className={styles.strengthBarTrack}>
              <div
                className={styles.strengthBarFill}
                style={{ width: `${strengthPercent}%` }}
              />
            </div>
          </div>

          {/* Meta Tags (Base Model, Version, or Hash) */}
          <div className={styles.metaRow}>
            {matchInfo && (
              <span
                className={styles.tagPill}
                style={matchedBy === 'name-match' ? NAME_MATCH_PILL_STYLE : undefined}
                title={t(matchInfo.title)}
              >
                {t(matchInfo.label)}
                {matchedBy === 'name-match' && matchScore !== undefined ? ` ${Math.round(matchScore * 100)}%` : ''}
              </span>
            )}
            {lora.resolved?.baseModel && (
              <span className={styles.tagPill}>{lora.resolved.baseModel}</span>
            )}
            {lora.resolved?.versionName && (
              <span className={styles.tagPill}>{lora.resolved.versionName}</span>
            )}
            {(lora.resolved?.nsfw || lora.resolved?.modelUrl?.includes('civitai.red')) && (
              <span
                className={styles.tagPill}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
                  fontWeight: 600,
                }}
                title={t('lora.redTitle')}
              >
                civitai.red
              </span>
            )}
            {!lora.resolved && lora.hash && (
              <span className={styles.tagPill}>{t('lora.hashShort', { hash: lora.hash.slice(0, 8) })}</span>
            )}
            {!lora.resolved && !lora.hash && (
              <span className={styles.tagPill}>{t('lora.promptTag')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Trigger Words Chips */}
      {triggerWords.length > 0 && (
        <div className={styles.triggersSection}>
          <span className={styles.triggerLabel}>{t('lora.triggers')}</span>
          {triggerWords.slice(0, 6).map((word) => (
            <button
              key={word}
              className={styles.triggerChip}
              onClick={(e) => handleCopyTrigger(word, e)}
              title={t('lora.copyWord', { word })}
            >
              <span>{word}</span>
              {copiedTrigger === word ? (
                <CheckIcon size={10} color="#4ade80" />
              ) : (
                <CopyIcon size={10} />
              )}
            </button>
          ))}
          {triggerWords.length > 6 && (
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>
              {t('lora.more', { count: triggerWords.length - 6 })}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

