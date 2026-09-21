import React, { useState } from 'react';
import type { LoraReference } from '../../../core/types.js';
import { SparklesIcon, CopyIcon, CheckIcon, CpuIcon } from '../icons/Icons.js';
import styles from './LoraMixerPanel.module.css';

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
  const [activeTriggers, setActiveTriggers] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    loras.forEach((l) => {
      l.resolved?.triggerWords?.forEach((t) => {
        initial[t] = true;
      });
    });
    return initial;
  });

  const [localStrengths, setLocalStrengths] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    loras.forEach((l) => {
      initial[l.rawName] = l.strength ?? 0.8;
    });
    return initial;
  });

  const [copied, setCopied] = useState(false);

  if (!loras || loras.length === 0) return null;

  const toggleTrigger = (word: string) => {
    setActiveTriggers((prev) => ({ ...prev, [word]: !prev[word] }));
  };

  const handleStrengthChange = (rawName: string, val: number) => {
    setLocalStrengths((prev) => ({ ...prev, [rawName]: val }));
    if (onUpdateLoraStrength) {
      onUpdateLoraStrength(rawName, val);
    }
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <SparklesIcon size={16} />
          <h4 className={styles.title}>LoRA Weight &amp; Trigger Mixer</h4>
        </div>
        <button className={styles.copyBtn} onClick={handleCopy}>
          {copied ? <CheckIcon size={12} color="#4ade80" /> : <CopyIcon size={12} />}
          <span>{copied ? 'Copied' : 'Copy LoRA Stack'}</span>
        </button>
      </div>

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
                  min="0.0"
                  max="2.0"
                  step="0.05"
                  value={strength}
                  onChange={(e) => handleStrengthChange(lora.rawName, parseFloat(e.target.value))}
                  className={styles.slider}
                />
              </div>

              {/* Trigger Words Toggle Pills */}
              {triggerWords.length > 0 && (
                <div className={styles.triggerRow}>
                  <span className={styles.triggerLabel}>Triggers:</span>
                  <div className={styles.triggerList}>
                    {triggerWords.map((word) => {
                      const isActive = activeTriggers[word] !== false;
                      return (
                        <button
                          key={word}
                          className={`${styles.triggerChip} ${isActive ? styles.triggerActive : ''}`}
                          onClick={() => toggleTrigger(word)}
                          title="Click to toggle trigger tag in copied prompt"
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
    </div>
  );
};
