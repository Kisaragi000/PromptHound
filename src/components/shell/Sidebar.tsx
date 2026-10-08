import React from 'react';
import {
  HomeIcon,
  LibraryIcon,
  StarIcon,
  SettingsIcon,
  AboutIcon,
  LightningIcon,
  RefreshIcon,
} from '../icons/Icons.js';
import { useNavigation, RouteKey } from '../../navigation/NavigationContext.js';
import { CatalogSyncButton } from '../lora/CatalogSyncButton.js';
import {
  useUpdateStatus,
  shortUpdateLabel,
  describeUpdateStatus,
  canCheckForUpdates,
  isUpdateBusy,
  RELEASES_URL,
} from './useUpdateStatus.js';
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
  const updateStatus = useUpdateStatus();

  const updateAction = (() => {
    if (updateStatus?.state === 'downloaded') {
      return { label: 'Restart to update', onClick: () => window.promptHound?.updates?.install(), disabled: false };
    }
    if (updateStatus?.state === 'unsupported') {
      return { label: 'Open Releases page', onClick: () => window.promptHound?.openExternal?.(RELEASES_URL), disabled: false };
    }
    return {
      label: 'Check for updates',
      onClick: () => window.promptHound?.updates?.check(),
      disabled: !canCheckForUpdates(updateStatus),
    };
  })();

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

        <div className={styles.updateBox} title={describeUpdateStatus(updateStatus)}>
          <div className={styles.updateText}>
            <span className={styles.updateVersion}>PromptHound v{__APP_VERSION__}</span>
            <span
              className={`${styles.updateState} ${updateStatus?.state === 'downloaded' ? styles.updateStateReady : ''}`}
            >
              {shortUpdateLabel(updateStatus)}
            </span>
          </div>
          <button
            type="button"
            className={styles.updateButton}
            onClick={updateAction.onClick}
            disabled={updateAction.disabled}
          >
            <RefreshIcon size={13} className={isUpdateBusy(updateStatus) ? styles.spinning : undefined} />
            <span>{updateAction.label}</span>
          </button>
        </div>
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
    </aside>
  );
};
