import React, { useState } from 'react';
import { RefreshIcon, CheckIcon } from '../icons/Icons.js';
import { getLoraCacheStats, upsertLoraRecord } from '../../../core/lora-cache.js';

interface CatalogSyncButtonProps {
  variant?: 'compact' | 'full' | 'sidebar';
  style?: React.CSSProperties;
}

export const CatalogSyncButton: React.FC<CatalogSyncButtonProps> = ({
  variant = 'full',
  style,
}) => {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [stats, setStats] = useState(() => getLoraCacheStats());

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (syncing) return;

    setSyncing(true);
    setStatusMessage('Syncing latest community models...');
    setProgress({ current: 0, total: 100 });

    try {
      // Simulate incremental fetch of trending/latest LoRAs
      const apiKey = localStorage.getItem('prompthound_civitai_key') || '';
      const url = `https://civitai.com/api/v1/models?types=LORA&sort=Most%20Downloaded&limit=50`;

      setProgress({ current: 30, total: 100 });

      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
      });

      if (res.ok) {
        const data = await res.json();
        setProgress({ current: 70, total: 100 });

        if (Array.isArray(data.items)) {
          let added = 0;
          for (const model of data.items) {
            const version = model.modelVersions?.[0];
            if (!version) continue;

            const coverImage = version.images?.[0];
            upsertLoraRecord({
              civitaiModelId: model.id,
              civitaiVersionId: version.id,
              name: model.name,
              normalizedAlias: model.name
                .toLowerCase()
                .replace(/\.(safetensors|pt|ckpt)$/i, '')
                .replace(/[_\-]+/g, ' ')
                .trim(),
              hashSha256: version.files?.[0]?.hashes?.SHA256,
              coverImageId: coverImage?.id ? String(coverImage.id) : undefined,
              coverImageUrl: coverImage?.url,
              triggerWords: version.trainedWords || [],
              baseModel: version.baseModel || 'Unknown',
              source: 'civitai',
              modelUrl: `https://civitai.com/models/${model.id}?modelVersionId=${version.id}`,
            });
            added++;
          }
          setStats(getLoraCacheStats());
          setStatusMessage(`Synced ${added} new models!`);
        } else {
          setStatusMessage('Catalog up to date');
        }
      } else {
        // Offline / fallback mode
        setStatusMessage('Pre-bundled offline catalog is active');
      }
    } catch {
      setStatusMessage('Pre-bundled offline catalog is active');
    } finally {
      setProgress({ current: 100, total: 100 });
      setTimeout(() => {
        setSyncing(false);
        setProgress(null);
        setTimeout(() => setStatusMessage(null), 3500);
      }, 600);
    }
  };

  if (variant === 'sidebar') {
    return (
      <button
        onClick={handleSync}
        disabled={syncing}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          padding: '8px 12px',
          borderRadius: 'var(--radius-control)',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          color: syncing ? 'var(--color-accent-hover)' : 'var(--color-text-secondary)',
          fontSize: '12px',
          fontWeight: 600,
          cursor: syncing ? 'wait' : 'pointer',
          transition: 'all 0.15s ease',
          textAlign: 'left',
          ...style,
        }}
        title="Sync latest community LoRAs and models to your offline catalog"
      >
        <span style={{ display: 'inline-flex', animation: syncing ? 'spin 1s linear infinite' : 'none' }}>
          <RefreshIcon size={14} />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {syncing ? 'Syncing Catalog...' : 'Sync Models'}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
            {statusMessage || `${stats.count.toLocaleString()} offline ready`}
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        borderRadius: 'var(--radius-control)',
        background: syncing ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        color: 'var(--color-text-primary)',
        fontSize: '13px',
        fontWeight: 600,
        cursor: syncing ? 'wait' : 'pointer',
        transition: 'all 0.2s ease',
        ...style,
      }}
    >
      <span style={{ display: 'inline-flex', animation: syncing ? 'spin 1s linear infinite' : 'none' }}>
        {statusMessage?.includes('Synced') ? <CheckIcon size={16} /> : <RefreshIcon size={16} />}
      </span>
      <span>
        {syncing
          ? progress
            ? `Syncing (${progress.current}%)...`
            : 'Syncing...'
          : statusMessage || 'Sync Models Catalog'}
      </span>
      {!syncing && !statusMessage && (
        <span
          style={{
            fontSize: '11px',
            padding: '2px 6px',
            borderRadius: '10px',
            background: 'rgba(99, 102, 241, 0.2)',
            color: '#a5b4fc',
            marginLeft: '4px',
          }}
        >
          {stats.count.toLocaleString()} Offline
        </span>
      )}
    </button>
  );
};
