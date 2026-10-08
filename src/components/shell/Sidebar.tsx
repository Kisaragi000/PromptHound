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
import { useT, type StringKey } from '../../i18n/index.js';
import styles from './Sidebar.module.css';

interface NavEntry {
  key: RouteKey;
  label: StringKey;
  icon: React.ReactNode;
}

const mainNavItems: NavEntry[] = [
  { key: 'home', label: 'nav.home', icon: <HomeIcon size={18} /> },
  { key: 'library', label: 'nav.library', icon: <LibraryIcon size={18} /> },
  { key: 'favorites', label: 'nav.favorites', icon: <StarIcon size={18} /> },
];

const toolNavItems: NavEntry[] = [
  { key: 'settings', label: 'nav.settings', icon: <SettingsIcon size={18} /> },
  { key: 'about', label: 'nav.about', icon: <AboutIcon size={18} /> },
];

export const Sidebar: React.FC = () => {
  const t = useT();
  const { currentRoute, navigate } = useNavigation();
  const updateStatus = useUpdateStatus();

  const updateAction = (() => {
    if (updateStatus?.state === 'downloaded') {
      return { label: t('update.restart'), onClick: () => window.promptHound?.updates?.install(), disabled: false };
    }
    if (updateStatus?.state === 'unsupported') {
      return { label: t('update.openReleases'), onClick: () => window.promptHound?.openExternal?.(RELEASES_URL), disabled: false };
    }
    return {
      label: t('update.check'),
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
              <span>{t(item.label)}</span>
            </button>
          );
        })}

        <div style={{ padding: '4px 6px 8px 6px' }}>
          <CatalogSyncButton variant="sidebar" />
        </div>

        <div className={styles.sectionLabel}>{t('nav.tools')}</div>

        {toolNavItems.map((item) => {
          const isActive = currentRoute === item.key;
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              <span className={styles.navItemIcon}>{item.icon}</span>
              <span>{t(item.label)}</span>
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
        <div className={styles.utilityTitle}>{t('nav.tagline')}</div>
        <div className={styles.utilityBody}>
          {t('nav.taglineBody')}
        </div>
      </div>
    </aside>
  );
};
