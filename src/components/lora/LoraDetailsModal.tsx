import React, { useState, useEffect } from 'react';
import type { LoraReference } from '../../../core/types.js';
import {
  SearchIcon,
  CheckIcon,
  ExternalLinkIcon,
  CloseIcon,
  LayersIcon,
  RefreshIcon,
  SparklesIcon,
  FolderIcon,
} from '../icons/Icons.js';
import {
  searchCivitaiCandidates,
  normalizeLoraName,
  buildCivitaiModelUrl,
} from '../../../core/lora-resolution.js';
import {
  upsertLoraRecord,
  removeLoraRecord,
  toResolvedLora,
} from '../../../core/lora-cache.js';
import type { CandidateMatchResult } from '../../../core/similarity.js';

interface LoraDetailsModalProps {
  lora: LoraReference;
  isOpen: boolean;
  onClose: () => void;
  onUpdateLora: (updated: LoraReference) => void;
}

export const LoraDetailsModal: React.FC<LoraDetailsModalProps> = ({
  lora,
  isOpen,
  onClose,
  onUpdateLora,
}) => {
  const [searchQuery, setSearchQuery] = useState(
    lora.resolved?.name || normalizeLoraName(lora.rawName)
  );
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<CandidateMatchResult[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery(lora.resolved?.name || normalizeLoraName(lora.rawName));
      performSearch(lora.resolved?.name || normalizeLoraName(lora.rawName));
    }
  }, [isOpen, lora]);

  if (!isOpen) return null;

  const performSearch = async (queryText: string) => {
    setLoading(true);
    setFeedback(null);
    try {
      const results = await searchCivitaiCandidates(queryText, lora.hash);
      setCandidates(results);
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkCandidate = (match: CandidateMatchResult) => {
    const model = match.candidate;
    const version = match.matchedVersionId
      ? model.modelVersions?.find((v) => v.id === match.matchedVersionId)
      : model.modelVersions?.[0];

    const modelId = Number(model.id);
    const versionId = version?.id ? Number(version.id) : undefined;
    const coverImage = version?.images?.[0];
    const triggerWords = Array.isArray(version?.trainedWords) ? version.trainedWords : [];
    const isNsfw = Boolean(model.nsfw ?? (model.nsfwLevel && model.nsfwLevel > 1));

    const record = {
      civitaiModelId: modelId,
      civitaiVersionId: versionId,
      name: model.name,
      normalizedAlias: normalizeLoraName(lora.rawName),
      hashSha256: lora.hash?.trim().toLowerCase(),
      coverImageId: coverImage?.id ? String(coverImage.id) : undefined,
      coverImageUrl: coverImage?.url,
      triggerWords,
      baseModel: version?.baseModel || 'Unknown',
      nsfw: isNsfw,
      source: 'civitai' as const,
      modelUrl: buildCivitaiModelUrl(modelId, versionId, isNsfw),
    };

    upsertLoraRecord(record);

    const updated: LoraReference = {
      ...lora,
      resolved: toResolvedLora({ ...record, cachedAt: Date.now() }),
    };

    onUpdateLora(updated);
    setFeedback(`Linked to "${model.name}"`);
    setTimeout(() => onClose(), 600);
  };

  const handleUnlink = () => {
    if (lora.hash) removeLoraRecord(lora.hash);
    const alias = normalizeLoraName(lora.rawName);
    if (alias) removeLoraRecord(alias);

    const updated: LoraReference = {
      ...lora,
      resolved: undefined,
    };

    onUpdateLora(updated);
    setFeedback('Unlinked from online catalog');
    setTimeout(() => onClose(), 600);
  };

  const handleInspectLocalSafetensors = async () => {
    if (!window.promptHound?.safetensors) return;
    try {
      const filePath = await window.promptHound.safetensors.openFileDialog();
      if (!filePath) return;

      setLoading(true);
      const parsed = await window.promptHound.safetensors.readFile(filePath);
      if (parsed) {
        const fileName = filePath.split(/[/\\]/).pop() || lora.rawName;
        const cleanName = fileName.replace(/\.safetensors$/i, '');
        const record = {
          name: cleanName,
          normalizedAlias: normalizeLoraName(cleanName),
          triggerWords: parsed.triggerWords || [],
          baseModel: parsed.baseModel || 'Custom',
          source: 'local' as const,
          modelUrl: `file://${filePath}`,
        };

        upsertLoraRecord(record);

        const updated: LoraReference = {
          ...lora,
          resolved: toResolvedLora({ ...record, cachedAt: Date.now() }),
        };

        onUpdateLora(updated);
        setFeedback(`Loaded ${parsed.triggerWords.length} trigger words from .safetensors`);
        setTimeout(() => onClose(), 800);
      } else {
        setFeedback('No valid LoRA metadata found in safetensors header');
      }
    } catch {
      setFeedback('Failed to read safetensors file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '85vh',
          background: 'var(--color-bg-elevated, #181920)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LayersIcon size={20} color="var(--color-accent, #6366f1)" />
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                LoRA Model Inspector & Resolver
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Raw prompt tag: <code style={{ color: '#e2e8f0' }}>{lora.rawName}</code>
                {lora.strength !== undefined && ` (weight: ${lora.strength})`}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
            }}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Current Status Box */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: lora.resolved ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${lora.resolved ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.08)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Current Recognition State
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                {lora.resolved?.name || 'Unresolved / Custom LoRA'}
              </div>
              {lora.resolved?.modelUrl && (
                <a
                  href={lora.resolved.modelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '12px', color: '#818cf8', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}
                >
                  View on {lora.resolved.modelUrl.includes('civitai.red') ? 'Civitai.red' : 'Civitai'} <ExternalLinkIcon size={12} />
                </a>
              )}
            </div>

            {lora.resolved && (
              <button
                onClick={handleUnlink}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#fca5a5',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Unlink
              </button>
            )}
          </div>

          {/* Search Bar */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
              Search Civitai Models or Paste Model ID / URL
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                }}
              >
                <SearchIcon size={16} color="var(--color-text-muted)" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && performSearch(searchQuery)}
                  placeholder="e.g. EpiCRealism, Add Detail, Ghibli..."
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#fff',
                    fontSize: '13px',
                    width: '100%',
                  }}
                />
              </div>
              <button
                onClick={() => performSearch(searchQuery)}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'var(--color-accent, #6366f1)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: loading ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <RefreshIcon size={14} />
                Search
              </button>
              {typeof window !== 'undefined' && window.promptHound?.safetensors && (
                <button
                  type="button"
                  onClick={handleInspectLocalSafetensors}
                  disabled={loading}
                  title="Inspect local .safetensors header metadata for trigger tags"
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#e2e8f0',
                    fontWeight: 500,
                    fontSize: '12px',
                    cursor: loading ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <FolderIcon size={14} />
                  Inspect .safetensors
                </button>
              )}
            </div>
          </div>

          {/* Candidates List */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '8px' }}>
              {loading ? 'Searching Civitai catalog...' : `Matching Candidates (${candidates.length})`}
            </div>

            {feedback && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(245, 154, 36, 0.15)',
                  border: '1px solid rgba(245, 154, 36, 0.35)',
                  color: 'var(--color-amber-primary)',
                  fontSize: '12px',
                  marginBottom: '10px',
                }}
              >
                {feedback}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '300px',
                overflowY: 'auto',
              }}
            >
              {candidates.length > 0 ? (
                candidates.map((res) => {
                  const m = res.candidate;
                  const v = m.modelVersions?.[0];
                  const img = v?.images?.[0]?.url;
                  const isCurrent = lora.resolved?.modelUrl?.includes(String(m.id));

                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: isCurrent ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        border: isCurrent
                          ? '1px solid rgba(99, 102, 241, 0.4)'
                          : '1px solid rgba(255, 255, 255, 0.06)',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            background: '#1e293b',
                            flexShrink: 0,
                          }}
                        >
                          {img ? (
                            <img src={img} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                              <LayersIcon size={18} />
                            </div>
                          )}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#f1f5f9',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {m.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                            <span>{v?.baseModel || 'LoRA'}</span>
                            <span>•</span>
                            <span style={{ color: res.score >= 0.7 ? '#4ade80' : res.score >= 0.45 ? '#fbbf24' : '#94a3b8' }}>
                              {res.matchReason}
                            </span>
                            {Boolean(m.nsfw || (m.nsfwLevel && m.nsfwLevel > 1)) && (
                              <span
                                style={{
                                  background: 'rgba(239, 68, 68, 0.2)',
                                  border: '1px solid rgba(239, 68, 68, 0.4)',
                                  color: '#fca5a5',
                                  borderRadius: '4px',
                                  padding: '1px 5px',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                }}
                              >
                                civitai.red (NSFW)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleLinkCandidate(res)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          background: isCurrent ? 'rgba(245, 154, 36, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                          border: isCurrent ? '1px solid rgba(245, 154, 36, 0.5)' : '1px solid rgba(255, 255, 255, 0.15)',
                          color: isCurrent ? 'var(--color-amber-primary)' : '#f8fafc',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          flexShrink: 0,
                        }}
                      >
                        {isCurrent ? <CheckIcon size={14} /> : <SparklesIcon size={14} />}
                        {isCurrent ? 'Linked' : 'Link Model'}
                      </button>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                  No Civitai models found for this query. You can keep it as a custom/private LoRA.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
