import React from 'react';
import {
  HomeIcon,
  LibraryIcon,
  StarIcon,
  SettingsIcon,
  AboutIcon,
  LightningIcon,
} from '../icons/Icons.js';
import { useNavigation, RouteKey } from '../../navigation/NavigationContext.js';
import { CatalogSyncButton } from '../lora/CatalogSyncButton.js';
import styles from './Sidebar.module.css';

interface NavEntry {
  key: RouteKey;
  label: string;
  icon: React.ReactNode;
}

const mainNavItems: NavEntry[] = [
  { key: 'home', label: 'Home', icon: <HomeIcon size={18} /> },
  { key: 'library', label: 'Prompt Library', icon: <LibraryIcon size={18} /> },
  { key: 'favorites', label: 'Favorites', icon: <StarIcon size={18} /> },
];

const toolNavItems: NavEntry[] = [
  { key: 'settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
  { key: 'about', label: 'About', icon: <AboutIcon size={18} /> },
];

export const Sidebar: React.FC = () => {
  const { currentRoute, navigate } = useNavigation();

  return (
    <aside className={`${styles.sidebar} no-drag`}>
      <nav className={styles.nav}>
        {mainNavItems.map((item) => {
          const isActive = currentRoute === item.key;
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              <span className={styles.navItemIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}

        <div style={{ padding: '4px 6px 8px 6px' }}>
          <CatalogSyncButton variant="sidebar" />
        </div>

        <div className={styles.sectionLabel}>TOOLS</div>

        {toolNavItems.map((item) => {
          const isActive = currentRoute === item.key;
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              <span className={styles.navItemIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className={styles.spacer} />

      <div className={styles.utilityCard}>
        <div className={styles.utilityIconWrap}>
          <LightningIcon size={18} />
        </div>
        <div className={styles.utilityTitle}>Extract. Organize. Create.</div>
        <div className={styles.utilityBody}>
          Get the most out of your AI-generated images.
        </div>
      </div>

      <div className={styles.versionFooter}>
        PromptHound v{__APP_VERSION__}
      </div>
    </aside>
  );
};
