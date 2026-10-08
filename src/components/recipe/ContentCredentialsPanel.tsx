import React from 'react';
import type { ContentCredentials } from '../../../core/types.js';
import { CheckIcon, ImageIcon, SparklesIcon } from '../icons/Icons.js';
import { PrimaryButton } from '../primitives/PrimaryButton.js';
import { SecondaryButton } from '../primitives/SecondaryButton.js';
import { useT, type StringKey } from '../../i18n/index.js';
import styles from './ContentCredentialsPanel.module.css';

interface ContentCredentialsPanelProps {
  credentials: ContentCredentials;
  previewUrl?: string;
  fileName?: string;
  onSelectAnother: () => void;
  onBackHome: () => void;
}

// IPTC digital source types in plain words
const SOURCE_TYPES: Record<string, StringKey> = {
  trainedAlgorithmicMedia: 'cc.trainedAlgorithmicMedia',
  compositeWithTrainedAlgorithmicMedia: 'cc.compositeWithTrainedAlgorithmicMedia',
  algorithmicMedia: 'cc.algorithmicMedia',
  digitalCapture: 'cc.digitalCapture',
  computationalCapture: 'cc.computationalCapture',
  compositeCapture: 'cc.compositeCapture',
  composite: 'cc.composite',
  digitalArt: 'cc.digitalArt',
  virtualRecording: 'cc.virtualRecording',
};

function formatDate(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Result for images with a provenance label but no generation metadata, e.g. from
 * ChatGPT or Gemini: they mark images as AI-generated but never store the prompt.
 */
export const ContentCredentialsPanel: React.FC<ContentCredentialsPanelProps> = ({
  credentials,
  previewUrl,
  fileName,
  onSelectAnother,
  onBackHome,
}) => {
  const t = useT();
  const { aiGenerated, product } = credentials;
  const partlyAi = /^compositeWithTrainedAlgorithmicMedia$/i.test(credentials.digitalSourceType ?? '');
  const rows: Array<[string, string | undefined]> = [
    [t('cc.madeWith'), product],
    [t('cc.tool'), credentials.softwareAgent !== product ? credentials.softwareAgent : undefined],
    [t('cc.created'), formatDate(credentials.created)],
    [t('cc.writtenBy'), credentials.claimGenerator],
    [t('cc.signedBy'), credentials.signedBy],
    [
      t('cc.sourceType'),
      credentials.digitalSourceType &&
        (SOURCE_TYPES[credentials.digitalSourceType] ? t(SOURCE_TYPES[credentials.digitalSourceType]) : credentials.digitalSourceType),
    ],
    [t('cc.label'), credentials.source === 'c2pa' ? t('cc.labelC2pa') : t('cc.labelXmp')],
  ];

  return (
    <div className={styles.panel}>
      <div className={styles.imageCol}>
        {previewUrl ? (
          <img src={previewUrl} alt={fileName || t('cc.analyzedImage')} className={styles.image} />
        ) : (
          <div className={styles.imagePlaceholder}>
            <ImageIcon size={28} />
          </div>
        )}
        {fileName && <div className={styles.fileName}>{fileName}</div>}
      </div>

      <div className={styles.infoCol}>
        <div className={aiGenerated ? styles.badgeAi : styles.badgeNeutral}>
          {aiGenerated ? <CheckIcon size={14} /> : <SparklesIcon size={14} />}
          {aiGenerated ? (partlyAi ? t('cc.badgeEdited') : t('cc.badgeGenerated')) : t('cc.badgeFound')}
        </div>

        <h2 className={styles.title}>
          {aiGenerated ? (product ? t('cc.titleMadeWith', { product }) : t('cc.titleAi')) : t('cc.titleNoAi')}
        </h2>

        <p className={styles.lead}>
          {aiGenerated
            ? partlyAi
              ? t('cc.leadEdited')
              : t('cc.leadGenerated')
            : t('cc.leadNoAi')}
        </p>

        <dl className={styles.details}>
          {rows
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className={styles.detailRow}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
        </dl>

        <p className={styles.note}>
          {t('cc.note')}
        </p>

        <div className={styles.actions}>
          <PrimaryButton onClick={onSelectAnother}>
            <ImageIcon size={16} /> {t('common.selectAnotherImage')}
          </PrimaryButton>
          <SecondaryButton onClick={onBackHome}>{t('common.backToHome')}</SecondaryButton>
        </div>
      </div>
    </div>
  );
};
