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
import styles from './StaticPage.module.css';

export const SettingsPage: React.FC = () => {
  const [autoExtractClipboard, setAutoExtractClipboard] = useState(() => {
    return localStorage.getItem('prompthound_auto_clipboard') !== 'false';
  });
  const [resolveLoras, setResolveLoras] = useState(() => {
    return localStorage.getItem('prompthound_resolve_loras') !== 'false';
  });
  const [downloadFolder, setDownloadFolder] = useState(() => {
    return localStorage.getItem('prompthound_download_folder') || 'C:\\Users\\Artist\\Pictures\\PromptHound';
  });
  const [civitaiDomain, setCivitaiDomain] = useState<CivitaiDomainPreference>(() => {
    return getPreferredCivitaiDomain();
  });
  const [civitaiApiKey, setCivitaiApiKey] = useState('');
  const [isKeyConfigured, setIsKeyConfigured] = useState(false);
  const [cacheStats, setCacheStats] = useState<{ count: number; userCount: number; lastUpdated?: number }>({
    count: 0,
    userCount: 0,
  });
  const [saved, setSaved] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    setCacheStats(getLoraCacheStats());

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
      localStorage.setItem('prompthound_auto_clipboard', String(autoExtractClipboard));
      localStorage.setItem('prompthound_resolve_loras', String(resolveLoras));
      localStorage.setItem('prompthound_download_folder', downloadFolder);
      localStorage.setItem('prompthound_civitai_key', civitaiApiKey.trim());
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
          Configure metadata extraction, network resolvers, and storage directories.
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>AUTOMATION</div>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Clipboard Auto-Detection</div>
            <div className={styles.settingDesc}>
              Automatically detect image URLs or file paths copied to the clipboard.
            </div>
          </div>
          <label className={styles.toggleSwitch}>
            <input
              type="checkbox"
              checked={autoExtractClipboard}
              onChange={(e) => setAutoExtractClipboard(e.target.checked)}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Resolve Remote LoRAs</div>
            <div className={styles.settingDesc}>
              Query Civitai and remote databases for friendly names, thumbnails, and model pages.
            </div>
          </div>
          <label className={styles.toggleSwitch}>
            <input
              type="checkbox"
              checked={resolveLoras}
              onChange={(e) => setResolveLoras(e.target.checked)}
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
            <select
              value={civitaiDomain}
              onChange={(e) => setCivitaiDomain(e.target.value as CivitaiDomainPreference)}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                color: '#f1f5f9',
                padding: '8px 12px',
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer',
                width: '100%',
                maxWidth: '300px',
              }}
            >
              <option value="civitai.red" style={{ background: '#1e293b', color: '#f1f5f9' }}>
                civitai.red (full catalog)
              </option>
              <option value="auto" style={{ background: '#1e293b', color: '#f1f5f9' }}>
                Automatic (by rating)
              </option>
              <option value="civitai.com" style={{ background: '#1e293b', color: '#f1f5f9' }}>
                civitai.com (SFW only)
              </option>
            </select>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>STORAGE & EXPORTS</div>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Default Archive Directory</div>
            <div className={styles.settingDesc}>
              Target folder for visual archives and JSON exports.
            </div>
          </div>
          <div className={styles.settingControl}>
            <GlassInput
              value={downloadFolder}
              onChange={(e) => setDownloadFolder(e.target.value)}
            />
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
