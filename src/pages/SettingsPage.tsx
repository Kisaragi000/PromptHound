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
import styles from './StaticPage.module.css';

export const SettingsPage: React.FC = () => {
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
      setExplorerMenu((s) => ({ ...s, busy: false, error: 'Windows did not accept the change. Try again.' }));
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
        <h1 className={styles.headerTitle}>Preferences & Settings</h1>
        <p className={styles.headerSubtitle}>
          Windows integration, Civitai access, library backups and the model cache.
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>WINDOWS INTEGRATION</div>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Explorer Right-Click Menu</div>
            <div className={styles.settingDesc}>
              {explorerMenu.supported
                ? 'Adds "Extract with PromptHound" when you right-click a PNG, JPEG, WebP or AVIF file in Windows Explorer.'
                : 'Available in the installed Windows app.'}
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
        <div className={styles.sectionTitle}>API & INTEGRATIONS</div>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Civitai API Key (Optional)</div>
            <div className={styles.settingDesc}>
              Required for private models and significantly higher rate limits.{' '}
              <a
                href="https://civitai.com/user/account"
                onClick={handleOpenCivitaiAccount}
                style={{ color: '#38bdf8', textDecoration: 'underline', cursor: 'pointer' }}
              >
                Get your Civitai API key ↗
              </a>
            </div>
          </div>
          <div className={styles.settingControl} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <GlassInput
              type="password"
              placeholder={isKeyConfigured && !civitaiApiKey ? '•••••••••••••••• (Encrypted in safe storage)' : 'Enter Civitai API Key...'}
              value={civitaiApiKey}
              onChange={(e) => setCivitaiApiKey(e.target.value)}
            />
            {isKeyConfigured && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start' }}>
                <StatusBadge label="Key saved (encrypted)" status="success" />
              </div>
            )}
          </div>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Preferred Civitai Platform (civitai.red vs civitai.com)</div>
            <div className={styles.settingDesc}>
              <strong>civitai.red</strong> hosts the complete catalog (both SFW and NSFW) without filtering restrictions. Choose your default platform for viewing models:
            </div>
          </div>
          <div className={styles.settingControl}>
            <Dropdown
              value={civitaiDomain}
              ariaLabel="Preferred Civitai platform"
              className={styles.platformDropdown}
              onChange={(v) => setCivitaiDomain(v as CivitaiDomainPreference)}
              options={[
                { value: 'civitai.red', label: 'civitai.red (full catalog)' },
                { value: 'auto', label: 'Automatic (by rating)' },
                { value: 'civitai.com', label: 'civitai.com (SFW only)' },
              ]}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>STORAGE & EXPORTS</div>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Prompt Library Backup</div>
            <div className={styles.settingDesc}>
              Save every prompt, folder, favorite and image to one .zip file, to keep as a backup, move to
              another PC or share. Importing adds the prompts you don't have yet and keeps the ones you do.
            </div>
          </div>
          <div className={styles.settingControl}>
            <LibraryBackupControls />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>LOCAL MODEL CACHE (TIER 1)</div>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Indexed LoRAs & Models</div>
            <div className={styles.settingDesc}>
              {cacheStats.count > 0
                ? `${cacheStats.count.toLocaleString()} model${cacheStats.count === 1 ? '' : 's'} available locally (${cacheStats.count - cacheStats.userCount} bundled seed + ${cacheStats.userCount} user discoveries).`
                : 'No models cached yet. Models resolve live and auto-save here as you extract images.'}
              {cacheStats.lastUpdated && (
                <div style={{ marginTop: '4px', fontSize: '11px', color: '#94a3b8' }}>
                  Last user auto-upsert: {new Date(cacheStats.lastUpdated).toLocaleDateString()} {new Date(cacheStats.lastUpdated).toLocaleTimeString()}
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
              Clear Cache
            </button>
            {cacheCleared && <StatusBadge label="Cache cleared" status="neutral" />}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <PrimaryButton onClick={handleSave}>
          {saved ? 'Settings Saved' : 'Save Preferences'}
        </PrimaryButton>
        {saved && <StatusBadge label="Saved to local storage" status="success" />}
      </div>
    </div>
  );
};
