import React, { useRef, useState } from 'react';
import type { LoraReference } from '../../../core/types.js';
import { SparklesIcon, CopyIcon, CheckIcon, ChevronRightIcon } from '../icons/Icons.js';
import { useT } from '../../i18n/index.js';
import { MAX_WEIGHT, SNAP_WEIGHTS, snapWeight } from '../../utils/loraWeights.js';
import styles from './LoraMixerPanel.module.css';

const OPEN_KEY = 'prompthound_mixer_open';

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
  }
}

interface LoraMixerPanelProps {
  loras: LoraReference[];
  basePrompt?: string;
  onUpdateLoraStrength?: (rawName: string, strength: number) => void;
}

export const LoraMixerPanel: React.FC<LoraMixerPanelProps> = ({
  loras,
  basePrompt = '',
  onUpdateLoraStrength,
}) => {
  const t = useT();
  const [activeTriggers, setActiveTriggers] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    loras.forEach((l) => {
      l.resolved?.triggerWords?.forEach((word) => {
        initial[word] = true;
      });
    });
    return initial;
  });

  // Weights come from the LoRAs, so a weight changed elsewhere on the page shows here too
  const localStrengths: Record<string, number> = {};
  loras.forEach((l) => {
    localStrengths[l.rawName] = l.strength ?? 0.8;
  });

  const [copied, setCopied] = useState(false);
  // Folded unless it was left open last time
  const [open, setOpen] = useState(readOpen);
  // Snapping applies to dragging only, so arrow keys can still step past a snap weight
  const dragging = useRef(false);

  const toggleOpen = () => {
    setOpen((prev) => {
      try {
        localStorage.setItem(OPEN_KEY, prev ? '0' : '1');
      } catch {
        // ignore
      }
      return !prev;
    });
  };

  if (!loras || loras.length === 0) return null;

  const toggleTrigger = (word: string) => {
    setActiveTriggers((prev) => ({ ...prev, [word]: !prev[word] }));
  };

  const handleStrengthChange = (rawName: string, val: number) => {
    onUpdateLoraStrength?.(rawName, dragging.current ? snapWeight(val) : Math.round(val * 100) / 100);
  };

  // Generate weighted prompt string
  const generateSnippet = (): string => {
    const selectedTriggers = Object.entries(activeTriggers)
      .filter(([_, active]) => active)
      .map(([word]) => word);

    const loraTags = loras
      .map((l) => `<lora:${l.rawName}:${(localStrengths[l.rawName] ?? 0.8).toFixed(2)}>`)
      .join(' ');

    const triggerSection = selectedTriggers.length > 0 ? selectedTriggers.join(', ') + ', ' : '';
    return `${triggerSection}${loraTags}`;
  };

  const snippet = generateSnippet();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className={`${styles.panel} ${open ? '' : styles.panelFolded}`}>
      <div
        className={styles.header}
        onClick={toggleOpen}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        title={t('mixer.foldTitle')}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleOpen();
          }
        }}
      >
        <div className={styles.titleRow}>
          <ChevronRightIcon size={14} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
          <SparklesIcon size={16} />
          <h4 className={styles.title}>{t('mixer.title')}</h4>
        </div>
        <button className={styles.copyBtn} onClick={handleCopy}>
          {copied ? <CheckIcon size={12} color="#4ade80" /> : <CopyIcon size={12} />}
          <span>{copied ? t('common.copied') : t('mixer.copy')}</span>
        </button>
      </div>

      {open && (
      <>
      <div className={styles.loraList}>
        {loras.map((lora) => {
          const strength = localStrengths[lora.rawName] ?? lora.strength ?? 0.8;
          const triggerWords = lora.resolved?.triggerWords || [];

          return (
            <div key={lora.rawName} className={styles.loraItem}>
              <div className={styles.loraTop}>
                <span className={styles.loraName}>
                  {lora.resolved?.name || lora.rawName}
                </span>
                <span className={styles.strengthValue}>{strength.toFixed(2)}</span>
              </div>

              {/* Slider */}
              <div className={styles.sliderRow}>
                <input
                  type="range"
                  min="0"
                  max={MAX_WEIGHT}
                  step="0.01"
                  value={Math.min(Math.max(strength, 0), MAX_WEIGHT)}
                  onPointerDown={() => (dragging.current = true)}
                  onPointerUp={() => (dragging.current = false)}
                  onPointerCancel={() => (dragging.current = false)}
                  onKeyDown={() => (dragging.current = false)}
                  onChange={(e) => handleStrengthChange(lora.rawName, parseFloat(e.target.value))}
                  className={styles.slider}
                  aria-label={lora.resolved?.name || lora.rawName}
                />
                {/* Marks at the snap weights */}
                <div className={styles.ticks} aria-hidden="true">
                  {SNAP_WEIGHTS.map((w) => (
                    <span
                      key={w}
                      className={`${styles.tick} ${Math.abs(strength - w) < 0.001 ? styles.tickOn : ''}`}
                      style={{ left: `calc(${(w / MAX_WEIGHT) * 100}% + ${8 - (w / MAX_WEIGHT) * 16}px)` }}
                    />
                  ))}
                </div>
              </div>

              {/* Trigger Words Toggle Pills */}
              {triggerWords.length > 0 && (
                <div className={styles.triggerRow}>
                  <span className={styles.triggerLabel}>{t('param.triggers')}</span>
                  <div className={styles.triggerList}>
                    {triggerWords.map((word) => {
                      const isActive = activeTriggers[word] !== false;
                      return (
                        <button
                          key={word}
                          className={`${styles.triggerChip} ${isActive ? styles.triggerActive : ''}`}
                          onClick={() => toggleTrigger(word)}
                          title={t('mixer.toggle')}
                        >
                          {isActive ? '✓ ' : '+ '}
                          {word}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.snippetPreview}>
        <span className={styles.snippetCode}>{snippet}</span>
      </div>
      </>
      )}
    </div>
  );
};
