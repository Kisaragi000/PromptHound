import React from 'react';
import { StarIcon, CopyIcon, EyeIcon, TrashIcon } from '../components/icons/Icons.js';
import { GlassCard } from '../components/primitives/GlassCard.js';
import { IconButton } from '../components/primitives/IconButton.js';
import { EmptyStatePanel } from '../components/primitives/EmptyStatePanel.js';
import { PrimaryButton } from '../components/primitives/PrimaryButton.js';
import { CatalogSyncButton } from '../components/lora/CatalogSyncButton.js';
import { useNavigation } from '../navigation/NavigationContext.js';
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
            Quickly access your starred prompts, configurations, and generation recipes. Click any card to open full settings.
          </p>
        </div>
        <CatalogSyncButton variant="full" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {favoriteItems.map((fav) => (
          <GlassCard
            key={fav.id}
            interactive
            style={{ display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer' }}
            onClick={() => openRecipeInResult(fav)}
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
                Click to open full settings →
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
    </div>
  );
};
