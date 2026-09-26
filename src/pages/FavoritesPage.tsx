import React, { useState } from 'react';
import { StarIcon, CopyIcon, EyeIcon, TrashIcon } from '../components/icons/Icons.js';
import { GlassCard } from '../components/primitives/GlassCard.js';
import { IconButton } from '../components/primitives/IconButton.js';
import { EmptyStatePanel } from '../components/primitives/EmptyStatePanel.js';
import { PrimaryButton } from '../components/primitives/PrimaryButton.js';
import { CatalogSyncButton } from '../components/lora/CatalogSyncButton.js';
import { useNavigation } from '../navigation/NavigationContext.js';
import type { SavedPromptItem } from '../../core/types.js';
import styles from './StaticPage.module.css';

export const FavoritesPage: React.FC = () => {
  const {
    navigate,
    favorites,
    toggleFavorite,
    libraryItems,
    openRecipeInResult,
    deleteFromLibrary,
  } = useNavigation();

  // Find all favorite items from the persistent library
  const favoriteItems = libraryItems.filter((item) => favorites.includes(item.id));

  // Two-click behavior, as in the Prompt Library: the first click previews a favorite
  // in the side pane, a second click (or double-click) opens the full result
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeFav = favoriteItems.find((f) => f.id === selectedId) ?? favoriteItems[0] ?? null;
  const handleCardClick = (id: string) => {
    const fav = favoriteItems.find((f) => f.id === id);
    if (!fav) return;
    if (selectedId === id) openRecipeInResult(fav);
    else setSelectedId(id);
  };

  if (favoriteItems.length === 0) {
    return (
      <div className={styles.page}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className={styles.headerTitle}>Favorite Prompts</h1>
            <p className={styles.headerSubtitle}>
              Quickly access your starred prompts, configurations, and generation recipes.
            </p>
          </div>
          <CatalogSyncButton variant="full" />
        </div>

        <EmptyStatePanel
          icon={<StarIcon size={32} />}
          title="No Favorite Prompts Yet"
          description="Mark prompts with the star icon in your library or extraction view to bookmark your best recipes here."
          action={
            <PrimaryButton onClick={() => navigate('library')}>
              Explore Library
            </PrimaryButton>
          }
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className={styles.headerTitle}>Favorite Prompts</h1>
          <p className={styles.headerSubtitle}>
            Quickly access your starred prompts, configurations, and generation recipes. Click a card to preview it, click
            again to open the full result.
          </p>
        </div>
        <CatalogSyncButton variant="full" />
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
        {favoriteItems.map((fav) => (
          <GlassCard
            key={fav.id}
            interactive
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              cursor: 'pointer',
              ...(activeFav?.id === fav.id
                ? { borderColor: 'var(--color-amber-primary)', boxShadow: '0 0 16px rgba(245, 154, 36, 0.2)' }
                : {}),
            }}
            onClick={() => handleCardClick(fav.id)}
            onDoubleClick={() => openRecipeInResult(fav)}
            title={selectedId === fav.id ? `Click again to open ${fav.title}` : `Click to preview ${fav.title}`}
          >
            <div style={{ width: '100%', height: '170px', borderRadius: 'var(--radius-control)', overflow: 'hidden', background: 'rgba(0,0,0,0.3)' }}>
              {fav.thumbnailUrl ? (
                <img
                  src={fav.thumbnailUrl}
                  alt={fav.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
                  No Preview
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fav.title}
              </h3>
              <IconButton
                title="Unfavorite"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(fav.id);
                }}
              >
                <StarIcon size={16} filled />
              </IconButton>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{fav.model}</span>
              <span>{fav.dimensions}</span>
            </div>

            <p style={{
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: '54px',
            }}>
              {fav.metadata?.prompt || 'No prompt content'}
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-brand-orange)' }}>
                {selectedId === fav.id ? 'Click again to open →' : 'Click to preview'}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <IconButton
                  title="Copy prompt"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(fav.metadata?.prompt || '');
                  }}
                >
                  <CopyIcon size={14} />
                </IconButton>
                <IconButton
                  title="Open full extraction result"
                  onClick={(e) => {
                    e.stopPropagation();
                    openRecipeInResult(fav);
                  }}
                >
                  <EyeIcon size={14} />
                </IconButton>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {activeFav && <FavoritePreviewPane fav={activeFav} onOpen={() => openRecipeInResult(activeFav)} />}
      </div>
    </div>
  );
};

const paneLabel: React.CSSProperties = {
  fontSize: '10.5px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
};

const paneBox: React.CSSProperties = {
  background: 'rgba(20, 24, 34, 0.7)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-control)',
  padding: '10px 12px',
};

/** Side preview of the selected favorite: image, prompt and key settings */
const FavoritePreviewPane: React.FC<{ fav: SavedPromptItem; onOpen: () => void }> = ({ fav, onOpen }) => {
  const meta = fav.metadata || {};
  const params: Array<[string, React.ReactNode]> = [
    ['Sampler', meta.sampler ?? '—'],
    ['Steps', meta.steps ?? '—'],
    ['CFG Scale', meta.cfgScale ?? '—'],
    ['Seed', meta.seed ?? '—'],
  ];
  const loras: any[] = Array.isArray(meta.loras) ? meta.loras : [];

  return (
    <GlassCard
      style={{
        width: '360px',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxHeight: 'calc(100vh - 160px)',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={onOpen}
        title="Open full result"
        style={{ borderRadius: 'var(--radius-control)', overflow: 'hidden', background: 'rgba(0,0,0,0.3)', cursor: 'pointer' }}
      >
        {fav.thumbnailUrl ? (
          <img src={fav.thumbnailUrl} alt={fav.title} style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', display: 'block' }} />
        ) : (
          <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
            No Preview
          </div>
        )}
      </div>

      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{fav.title}</h3>
        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
          {meta.modelResolved?.name || fav.model} · {fav.dimensions}
        </div>
      </div>

      <div style={paneBox}>
        <div style={paneLabel}>Prompt</div>
        <p style={{ fontSize: '13px', lineHeight: 1.45, marginTop: '6px', color: 'var(--color-text-primary)', maxHeight: '140px', overflowY: 'auto' }}>
          {meta.prompt || 'No prompt content'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {params.map(([label, value]) => (
          <div key={label} style={paneBox}>
            <div style={paneLabel}>{label}</div>
            <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {loras.length > 0 && (
        <div style={paneBox}>
          <div style={paneLabel}>LoRAs ({loras.length})</div>
          <ul style={{ margin: '6px 0 0', paddingLeft: '16px', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
            {loras.map((l, i) => (
              <li key={i}>
                {l.resolved?.name || l.rawName}
                {l.strength !== undefined ? ` · ${l.strength}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <PrimaryButton onClick={onOpen}>Open Full Result</PrimaryButton>
    </GlassCard>
  );
};
