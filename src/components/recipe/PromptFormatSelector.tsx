import React, { useState } from 'react';
import type { ExtractedMetadata, LoraReference } from '../../../core/types.js';
import { CopyIcon, CheckIcon, SparklesIcon } from '../icons/Icons.js';
import { IconButton } from '../primitives/IconButton.js';
import styles from './PromptFormatSelector.module.css';

export type PromptSyntaxFormat = 'a1111' | 'comfyui' | 'plaintext';

interface PromptFormatSelectorProps {
  metadata: ExtractedMetadata;
  loras?: LoraReference[];
}

export const PromptFormatSelector: React.FC<PromptFormatSelectorProps> = ({
  metadata,
  loras = [],
}) => {
  const [format, setFormat] = useState<PromptSyntaxFormat>('a1111');
  const [copied, setCopied] = useState(false);

  // Generate formatted prompt output based on target syntax
  const getFormattedPrompt = (): string => {
    const rawPrompt = metadata.prompt || '';

    if (format === 'plaintext') {
      // Strip <lora:...> and (weight:1.2) syntax
      return rawPrompt
        .replace(/<lora:[^>]+>/gi, '')
        .replace(/\(([^:)]+):[0-9.]+\)/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .replace(/,\s*,/g, ',')
        .trim();
    }

    if (format === 'a1111') {
      // Append any missing LoRA tags in A1111 syntax if not already present
      let result = rawPrompt;
      loras.forEach((l) => {
        const tag = `<lora:${l.rawName}:${l.strength ?? 0.8}>`;
        if (!result.includes(l.rawName)) {
          result += `, ${tag}`;
        }
      });
      return result.trim();
    }

    if (format === 'comfyui') {
      // ComfyUI usually separates LoRA nodes and feeds clean conditioned prompt
      let base = rawPrompt.replace(/<lora:[^>]+>/gi, '').trim();
      const triggerWords: string[] = [];
      loras.forEach((l) => {
        if (l.resolved?.triggerWords && l.resolved.triggerWords.length > 0) {
          triggerWords.push(...l.resolved.triggerWords.slice(0, 3));
        }
      });
      if (triggerWords.length > 0) {
        const uniqueTriggers = Array.from(new Set(triggerWords)).join(', ');
        if (!base.toLowerCase().includes(triggerWords[0].toLowerCase())) {
          base = `${uniqueTriggers}, ${base}`;
        }
      }
      return base;
    }

    return rawPrompt;
  };

  const formattedText = getFormattedPrompt();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.formatTabs}>
          <button
            className={`${styles.tab} ${format === 'a1111' ? styles.tabActive : ''}`}
            onClick={() => setFormat('a1111')}
          >
            A1111 / Forge Syntax
          </button>
          <button
            className={`${styles.tab} ${format === 'comfyui' ? styles.tabActive : ''}`}
            onClick={() => setFormat('comfyui')}
          >
            ComfyUI Prompt
          </button>
          <button
            className={`${styles.tab} ${format === 'plaintext' ? styles.tabActive : ''}`}
            onClick={() => setFormat('plaintext')}
          >
            Clean Plaintext
          </button>
        </div>

        <button className={styles.copyBtn} onClick={handleCopy}>
          {copied ? (
            <>
              <CheckIcon size={13} color="#4ade80" /> Copied!
            </>
          ) : (
            <>
              <CopyIcon size={13} /> Copy Formatted
            </>
          )}
        </button>
      </div>

      <div className={styles.promptBox}>
        {formattedText || '(No prompt text available)'}
      </div>
    </div>
  );
};
