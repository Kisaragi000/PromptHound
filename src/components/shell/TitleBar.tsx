import React, { useEffect, useState } from 'react';
import { PromptHoundLogo, MinimizeIcon, MaximizeIcon, RestoreIcon, CloseIcon } from '../icons/Icons.js';
import { IconButton } from '../primitives/IconButton.js';
import { StatusBadge } from '../primitives/StatusBadge.js';
import { useNavigation } from '../../navigation/NavigationContext.js';
import { useT, type StringKey } from '../../i18n/index.js';
import styles from './TitleBar.module.css';

const routeTitleMap: Record<string, StringKey> = {
  home: 'title.home',
  result: 'title.result',
  library: 'title.library',
  archive: 'title.archive',
  favorites: 'title.favorites',
  settings: 'title.settings',
  about: 'title.about',
};

export const TitleBar: React.FC = () => {
  const t = useT();
  const { currentRoute } = useNavigation();
  const contextTitle = t(routeTitleMap[currentRoute] ?? 'title.home');
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const controls = window.promptHound?.windowControls;
    if (!controls) return;
    controls.isMaximized().then(setIsMaximized).catch(() => undefined);
    return controls.onMaximizedChange?.(setIsMaximized);
  }, []);

  const handleMinimize = () => {
    window.promptHound?.windowControls.minimize();
  };

  const handleMaximize = () => {
    if (window.promptHound?.windowControls.toggleMaximize) {
      void window.promptHound.windowControls.toggleMaximize();
    } else {
      window.promptHound?.windowControls.maximize();
    }
  };

  const handleClose = () => {
    window.promptHound?.windowControls.close();
  };

  return (
    <header className={`${styles.titleBar} drag-region`}>
      <div className={styles.left}>
        <PromptHoundLogo size={28} />
        <div className={styles.wordmark}>
          <span>Prompt</span>
          <span className={styles.wordmarkAccent}>Hound</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.contextTitle}>{contextTitle}</div>
      </div>

      <div className={`${styles.right} no-drag`}>
        <StatusBadge label={t('window.ready')} status="success" />

        <div className={styles.windowControls}>
          <IconButton title={t('window.minimize')} onClick={handleMinimize}>
            <MinimizeIcon size={14} />
          </IconButton>
          <IconButton title={isMaximized ? t('window.restore') : t('window.maximize')} onClick={handleMaximize}>
            {isMaximized ? <RestoreIcon size={14} /> : <MaximizeIcon size={14} />}
          </IconButton>
          <IconButton title={t('window.close')} variant="danger" onClick={handleClose}>
            <CloseIcon size={14} />
          </IconButton>
        </div>
      </div>
    </header>
  );
};
