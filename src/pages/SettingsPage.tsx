import React, { useState, useEffect } from 'react';
import { GlassInput } from '../components/primitives/GlassInput.js';
import { PrimaryButton } from '../components/primitives/PrimaryButton.js';
import { StatusBadge } from '../components/primitives/StatusBadge.js';
import { getLoraCacheStats, clearLoraCache } from '../../core/lora-cache.js';
import {
  setRuntimeCivitaiApiKey,
  getPreferredCivitaiDomain,
  setPreferredCivitaiDomain,
  type CivitaiDomainPreference,
} from '../../core/lora-resolution.js';
import { Dropdown } from '../components/primitives/Dropdown.js';
import { LibraryBackupControls } from '../components/library/LibraryBackupControls.js';
import { useT, useLanguage, setLanguage, LANGUAGES, type Language } from '../i18n/index.js';
import styles from './StaticPage.module.css';

export const SettingsPage: React.FC = () => {
  const t = useT();
  const language = useLanguage();
  const [civitaiDomain, setCivitaiDomain] = useState<CivitaiDomainPreference>(() => {
    return getPreferredCivitaiDomain();
  });
  const [civitaiApiKey, setCivitaiApiKey] = useState('');
  const [isKeyConfigured, setIsKeyConfigured] = useState(false);
  const [cacheStats, setCacheStats] = useState<{ count: number; userCount: number; lastUpdated?: number }>({
    count: 0,
    userCount: 0,
  });
  const [explorerMenu, setExplorerMenu] = useState<{ supported: boolean; enabled: boolean; busy?: boolean; error?: string }>({
    supported: false,
    enabled: false,
  });
  const [saved, setSaved] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    setCacheStats(getLoraCacheStats());
    window.promptHound?.shellIntegration?.get().then(setExplorerMenu).catch(() => undefined);

    // Load Civitai key from native safeStorage if available
    if (window.promptHound?.settings?.getCivitaiKey) {
      window.promptHound.settings.getCivitaiKey().then((key) => {
        if (key) {
          setCivitaiApiKey(key);
          setIsKeyConfigured(true);
          setRuntimeCivitaiApiKey(key);
        }
      });
    } else {
      const stored = localStorage.getItem('prompthound_civitai_key') || '';
      if (stored) {
        setCivitaiApiKey(stored);
        setIsKeyConfigured(true);
        setRuntimeCivitaiApiKey(stored);
      }
    }
  }, []);

  const handleSave = () => {
    try {
      // The desktop app stores the key encrypted below; only the web preview keeps it here
      if (!window.promptHound?.settings) localStorage.setItem('prompthound_civitai_key', civitaiApiKey.trim());
      setPreferredCivitaiDomain(civitaiDomain);

      setRuntimeCivitaiApiKey(civitaiApiKey.trim() || null);

      if (window.promptHound?.settings?.saveCivitaiKey) {
        window.promptHound.settings.saveCivitaiKey(civitaiApiKey.trim());
      }
      setIsKeyConfigured(Boolean(civitaiApiKey.trim()));
      // Saving settings by hand counts as setup, so Home stops offering the wizard
      localStorage.setItem('prompthound_setup_completed', 'true');
    } catch {
      // storage error
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Applies at once: the menu is added to or removed from Explorer when toggled
  const handleExplorerMenuChange = async (enabled: boolean) => {
    const integration = window.promptHound?.shellIntegration;
    if (!integration) return;
    setExplorerMenu((s) => ({ ...s, busy: true, error: undefined }));
    try {
      setExplorerMenu(await integration.set(enabled));
    } catch {
      setExplorerMenu((s) => ({ ...s, busy: false, error: t('settings.explorerMenuError') }));
    }
  };

  const handleOpenCivitaiAccount = (e: React.MouseEvent) => {
    e.preventDefault();
    const url = 'https://civitai.com/user/account';
    if (window.promptHound?.openExternal) {
      window.promptHound.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleClearCache = () => {
    clearLoraCache();
    setCacheStats(getLoraCacheStats());
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2500);
  };

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.headerTitle}>{t('settings.title')}</h1>
        <p className={styles.headerSubtitle}>{t('settings.subtitle')}</p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('settings.languageSection')}</div>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>{t('settings.language')}</div>
            <div className={styles.settingDesc}>{t('settings.languageDesc')}</div>
          </div>
          <div className={styles.settingControl}>
            <Dropdown
              value={language}
              ariaLabel={t('settings.language')}
              className={styles.platformDropdown}
              onChange={(v) => setLanguage(v as Language)}
              options={LANGUAGES.map((l) => ({ value: l.value, label: l.label }))}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('settings.windowsSection')}</div>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>{t('settings.explorerMenu')}</div>
            <div className={styles.settingDesc}>
              {explorerMenu.supported
                ? t('settings.explorerMenuDesc')
                : t('settings.explorerMenuInstalled')}
              {explorerMenu.error && <div style={{ marginTop: '4px', color: '#f87171' }}>{explorerMenu.error}</div>}
            </div>
          </div>
          <label className={styles.toggleSwitch}>
            <input
              type="checkbox"
              checked={explorerMenu.enabled}
              disabled={!explorerMenu.supported || explorerMenu.busy}
              onChange={(e) => void handleExplorerMenuChange(e.target.checked)}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('settings.apiSection')}</div>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>{t('settings.apiKey')}</div>
            <div className={styles.settingDesc}>
              {t('settings.apiKeyDesc')}{' '}
              <a
                href="https://civitai.com/user/account"
                onClick={handleOpenCivitaiAccount}
                style={{ color: '#38bdf8', textDecoration: 'underline', cursor: 'pointer' }}
              >
                {t('settings.getKey')}
              </a>
            </div>
          </div>
          <div className={styles.settingControl} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <GlassInput
              type="password"
              placeholder={isKeyConfigured && !civitaiApiKey ? t('settings.keyEncrypted') : t('settings.keyPlaceholder')}
              value={civitaiApiKey}
              onChange={(e) => setCivitaiApiKey(e.target.value)}
            />
            {isKeyConfigured && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start' }}>
                <StatusBadge label={t('settings.keySaved')} status="success" />
              </div>
            )}
          </div>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>{t('settings.platform')}</div>
            <div className={styles.settingDesc}>
              <strong>civitai.red</strong> {t('settings.platformDesc')}
            </div>
          </div>
          <div className={styles.settingControl}>
            <Dropdown
              value={civitaiDomain}
              ariaLabel={t('settings.platformAria')}
              className={styles.platformDropdown}
              onChange={(v) => setCivitaiDomain(v as CivitaiDomainPreference)}
              options={[
                { value: 'civitai.red', label: t('settings.platformRed') },
                { value: 'auto', label: t('settings.platformAuto') },
                { value: 'civitai.com', label: t('settings.platformCom') },
              ]}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('settings.storageSection')}</div>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>{t('settings.backup')}</div>
            <div className={styles.settingDesc}>
              {t('settings.backupDesc')}
            </div>
          </div>
          <div className={styles.settingControl}>
            <LibraryBackupControls />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('settings.cacheSection')}</div>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>{t('settings.cache')}</div>
            <div className={styles.settingDesc}>
              {cacheStats.count > 0
                ? t('settings.cacheCount', {
                    count: cacheStats.count,
                    seed: cacheStats.count - cacheStats.userCount,
                    user: cacheStats.userCount,
                  })
                : t('settings.cacheEmpty')}
              {cacheStats.lastUpdated && (
                <div style={{ marginTop: '4px', fontSize: '11px', color: '#94a3b8' }}>
                  {t('settings.cacheUpdated', { date: `${new Date(cacheStats.lastUpdated).toLocaleDateString()} ${new Date(cacheStats.lastUpdated).toLocaleTimeString()}` })}
                </div>
              )}
            </div>
          </div>
          <div className={styles.settingControl} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleClearCache}
              disabled={cacheStats.count === 0}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: cacheStats.count === 0 ? 'not-allowed' : 'pointer',
                opacity: cacheStats.count === 0 ? 0.5 : 1,
              }}
            >
              {t('settings.clearCache')}
            </button>
            {cacheCleared && <StatusBadge label={t('settings.cacheCleared')} status="neutral" />}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <PrimaryButton onClick={handleSave}>
          {saved ? t('settings.saved') : t('settings.save')}
        </PrimaryButton>
        {saved && <StatusBadge label={t('settings.savedLocal')} status="success" />}
      </div>
    </div>
  );
};
