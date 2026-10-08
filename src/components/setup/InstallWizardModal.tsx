import React, { useState, useEffect } from 'react';
import {
  PromptHoundLogo,
  CheckIcon,
  SparklesIcon,
  FolderIcon,
  GlobeIcon,
  CpuIcon,
  LightningIcon,
} from '../icons/Icons.js';
import { PrimaryButton } from '../primitives/PrimaryButton.js';
import { SecondaryButton } from '../primitives/SecondaryButton.js';
import { GlassInput } from '../primitives/GlassInput.js';
import {
  setPreferredCivitaiDomain,
  getPreferredCivitaiDomain,
  setRuntimeCivitaiApiKey,
  type CivitaiDomainPreference,
} from '../../../core/lora-resolution.js';
import { useT } from '../../i18n/index.js';
import styles from './InstallWizardModal.module.css';

interface InstallWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export type WorkflowProfile = 'a1111' | 'comfyui' | 'fooocus' | 'general';

export const InstallWizardModal: React.FC<InstallWizardModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const t = useT();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Workflow Profile
  const [workflowProfile, setWorkflowProfile] = useState<WorkflowProfile>(() => {
    return (localStorage.getItem('prompthound_workflow_profile') as WorkflowProfile) || 'a1111';
  });

  // Step 2: Local Models Directory
  const [loraDirectory, setLoraDirectory] = useState<string>(() => {
    return (
      localStorage.getItem('prompthound_lora_directory') ||
      'C:\\StableDiffusion\\models\\Lora'
    );
  });
  const [outputDirectory, setOutputDirectory] = useState<string>(() => {
    return (
      localStorage.getItem('prompthound_download_folder') ||
      'C:\\StableDiffusion\\outputs'
    );
  });

  // Step 3: Civitai Platform & API Key
  const [civitaiDomain, setCivitaiDomain] = useState<CivitaiDomainPreference>(() => {
    return getPreferredCivitaiDomain();
  });
  const [civitaiApiKey, setCivitaiApiKey] = useState<string>(() => {
    return localStorage.getItem('prompthound_civitai_key') || '';
  });
  const [apiTesting, setApiTesting] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Step 4: Desktop & Explorer Integration
  const [enableContextMenu, setEnableContextMenu] = useState(true);

  if (!isOpen) return null;

  const testCivitaiConnection = async () => {
    setApiTesting(true);
    setApiTestResult(null);
    try {
      const headers: Record<string, string> = {};
      if (civitaiApiKey.trim()) {
        headers['Authorization'] = `Bearer ${civitaiApiKey.trim()}`;
      }
      const res = await fetch('https://civitai.com/api/v1/models?limit=1', { headers });
      if (res.ok) {
        setApiTestResult({
          success: true,
          message: civitaiApiKey.trim()
            ? t('wizard.keyVerified')
            : t('wizard.publicOk'),
        });
      } else {
        setApiTestResult({
          success: false,
          message: t('wizard.httpError', { status: res.status }),
        });
      }
    } catch {
      setApiTestResult({
        success: false,
        message: t('wizard.networkError'),
      });
    } finally {
      setApiTesting(false);
    }
  };

  const handleFinishSetup = () => {
    localStorage.setItem('prompthound_setup_completed', 'true');
    localStorage.setItem('prompthound_workflow_profile', workflowProfile);
    localStorage.setItem('prompthound_lora_directory', loraDirectory);
    localStorage.setItem('prompthound_download_folder', outputDirectory);
    if (window.promptHound?.settings) {
      void window.promptHound.settings.saveCivitaiKey(civitaiApiKey.trim());
    } else {
      localStorage.setItem('prompthound_civitai_key', civitaiApiKey.trim());
    }
    void window.promptHound?.shellIntegration
      ?.get()
      .then((state) => (state.supported ? window.promptHound?.shellIntegration?.set(enableContextMenu) : undefined))
      .catch(() => undefined);

    setPreferredCivitaiDomain(civitaiDomain);
    setRuntimeCivitaiApiKey(civitaiApiKey.trim() || null);

    onComplete();
    onClose();
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Progress Header */}
        <div className={styles.header}>
          <div className={styles.logoRow}>
            <PromptHoundLogo size={32} />
            <div>
              <h2 className={styles.title}>{t('wizard.title')}</h2>
              <p className={styles.subtitle}>{t('wizard.subtitle')}</p>
            </div>
          </div>

          <div className={styles.stepper}>
            {[
              { num: 1, label: t('wizard.stepWorkflow') },
              { num: 2, label: t('wizard.stepFolders') },
              { num: 3, label: t('wizard.stepCivitai') },
              { num: 4, label: t('wizard.stepIntegration') },
            ].map((s) => (
              <div
                key={s.num}
                className={`${styles.stepItem} ${step === s.num ? styles.stepActive : step > s.num ? styles.stepCompleted : ''}`}
                onClick={() => setStep(s.num as any)}
              >
                <div className={styles.stepCircle}>
                  {step > s.num ? <CheckIcon size={12} color="#fff" /> : s.num}
                </div>
                <span className={styles.stepLabel}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className={styles.body}>
          {/* STEP 1: Workflow Profile */}
          {step === 1 && (
            <div className={styles.stepContent}>
              <div className={styles.sectionHeading}>
                <CpuIcon size={20} />
                <h3>{t('wizard.workflowTitle')}</h3>
              </div>
              <p className={styles.sectionDesc}>
                <strong>{t('wizard.goodNews')}</strong> {t('wizard.workflowDesc')}
              </p>

              <div className={styles.cardGrid}>
                <div
                  className={`${styles.selectCard} ${workflowProfile === 'general' ? styles.cardSelected : ''}`}
                  onClick={() => setWorkflowProfile('general')}
                >
                  <div className={styles.cardBadge} style={{ background: '#F59A24', color: '#0B0E15' }}>{t('wizard.recommended')}</div>
                  <h4>{t('wizard.universal')}</h4>
                  <p>{t('wizard.universalDesc')}</p>
                </div>

                <div
                  className={`${styles.selectCard} ${workflowProfile === 'a1111' ? styles.cardSelected : ''}`}
                  onClick={() => setWorkflowProfile('a1111')}
                >
                  <div className={styles.cardBadge}>WebUI</div>
                  <h4>Automatic1111 / SD-Forge</h4>
                  <p>{t('wizard.a1111Desc')}</p>
                </div>

                <div
                  className={`${styles.selectCard} ${workflowProfile === 'comfyui' ? styles.cardSelected : ''}`}
                  onClick={() => setWorkflowProfile('comfyui')}
                >
                  <div className={styles.cardBadge}>{t('wizard.nodeGraph')}</div>
                  <h4>ComfyUI</h4>
                  <p>{t('wizard.comfyDesc')}</p>
                </div>

                <div
                  className={`${styles.selectCard} ${workflowProfile === 'fooocus' ? styles.cardSelected : ''}`}
                  onClick={() => setWorkflowProfile('fooocus')}
                >
                  <h4>Fooocus & NovelAI</h4>
                  <p>{t('wizard.fooocusDesc')}</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Local Folders */}
          {step === 2 && (
            <div className={styles.stepContent}>
              <div className={styles.sectionHeading}>
                <FolderIcon size={20} />
                <h3>{t('wizard.foldersTitle')}</h3>
              </div>
              <p className={styles.sectionDesc}>
                {t('wizard.foldersDesc')}
              </p>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{t('wizard.loraDir')}</label>
                <GlassInput
                  value={loraDirectory}
                  onChange={(e) => setLoraDirectory(e.target.value)}
                  placeholder="e.g. C:\AI\ComfyUI\models\loras"
                  icon={<FolderIcon size={16} />}
                />
                <span className={styles.formHelp}>
                  {t('wizard.loraDirHelp')}
                </span>
              </div>

              <div className={styles.formGroup} style={{ marginTop: '16px' }}>
                <label className={styles.formLabel}>{t('wizard.outputDir')}</label>
                <GlassInput
                  value={outputDirectory}
                  onChange={(e) => setOutputDirectory(e.target.value)}
                  placeholder="e.g. C:\AI\outputs"
                  icon={<FolderIcon size={16} />}
                />
                <span className={styles.formHelp}>
                  {t('wizard.outputDirHelp')}
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: Civitai Platform & API Key */}
          {step === 3 && (
            <div className={styles.stepContent}>
              <div className={styles.sectionHeading}>
                <GlobeIcon size={20} />
                <h3>{t('wizard.civitaiTitle')}</h3>
              </div>
              <p className={styles.sectionDesc}>
                {t('wizard.civitaiDesc')}
              </p>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{t('wizard.platform')}</label>
                <select
                  value={civitaiDomain}
                  onChange={(e) => setCivitaiDomain(e.target.value as CivitaiDomainPreference)}
                  className={styles.selectInput}
                >
                  <option value="civitai.red">
                    {t('wizard.platformRed')}
                  </option>
                  <option value="auto">
                    {t('wizard.platformAuto')}
                  </option>
                  <option value="civitai.com">
                    {t('wizard.platformCom')}
                  </option>
                </select>
                <span className={styles.formHelp}>
                  <strong>Civitai.red</strong> {t('wizard.platformHelp')}
                </span>
              </div>

              <div className={styles.formGroup} style={{ marginTop: '16px' }}>
                <label className={styles.formLabel}>{t('wizard.apiKey')}</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <GlassInput
                      type="password"
                      value={civitaiApiKey}
                      onChange={(e) => setCivitaiApiKey(e.target.value)}
                      placeholder={t('wizard.apiKeyPlaceholder')}
                    />
                  </div>
                  <SecondaryButton onClick={testCivitaiConnection} disabled={apiTesting}>
                    {apiTesting ? t('wizard.testing') : t('wizard.test')}
                  </SecondaryButton>
                </div>
                {apiTestResult && (
                  <div
                    style={{
                      marginTop: '8px',
                      fontSize: '12px',
                      color: apiTestResult.success ? '#4ade80' : '#f87171',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>{apiTestResult.success ? '✓' : '✗'}</span>
                    <span>{apiTestResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Windows Explorer integration */}
          {step === 4 && (
            <div className={styles.stepContent}>
              <div className={styles.sectionHeading}>
                <LightningIcon size={20} />
                <h3>{t('wizard.integrationTitle')}</h3>
              </div>
              <p className={styles.sectionDesc}>
                {t('wizard.integrationDesc')}
              </p>

              <div className={styles.toggleList}>
                <label className={styles.toggleRow}>
                  <div className={styles.toggleInfo}>
                    <span className={styles.toggleTitle}>{t('wizard.explorerMenu')}</span>
                    <span className={styles.toggleDesc}>
                      {t('wizard.explorerMenuDesc')}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableContextMenu}
                    onChange={(e) => setEnableContextMenu(e.target.checked)}
                    className={styles.checkbox}
                  />
                </label>

              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className={styles.footer}>
          {step > 1 ? (
            <SecondaryButton onClick={() => setStep((step - 1) as any)}>
              {t('common.back')}
            </SecondaryButton>
          ) : (
            <SecondaryButton onClick={onClose}>
              {t('wizard.skip')}
            </SecondaryButton>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            {step < 4 ? (
              <PrimaryButton onClick={() => setStep((step + 1) as any)}>
                {t('common.continue')}
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={handleFinishSetup} icon={<SparklesIcon size={16} />}>
                {t('wizard.complete')}
              </PrimaryButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
