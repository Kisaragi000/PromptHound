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
  const [enableClipboardWatch, setEnableClipboardWatch] = useState(true);
  const [enableHotkeys, setEnableHotkeys] = useState(true);

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
            ? 'API key verified! High-rate limits & mature content enabled.'
            : 'Public API connected successfully (Anonymous tier).',
        });
      } else {
        setApiTestResult({
          success: false,
          message: `Civitai returned HTTP ${res.status}: Check your API token.`,
        });
      }
    } catch {
      setApiTestResult({
        success: false,
        message: 'Could not connect to Civitai API. Check your network connection.',
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
    localStorage.setItem('prompthound_civitai_key', civitaiApiKey.trim());
    localStorage.setItem('prompthound_context_menu', String(enableContextMenu));
    localStorage.setItem('prompthound_clipboard_watch', String(enableClipboardWatch));
    localStorage.setItem('prompthound_hotkeys_enabled', String(enableHotkeys));

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
              <h2 className={styles.title}>Welcome to PromptHound Setup</h2>
              <p className={styles.subtitle}>Configure your generation workflow in 4 quick steps</p>
            </div>
          </div>

          <div className={styles.stepper}>
            {[
              { num: 1, label: 'Workflow' },
              { num: 2, label: 'Folders' },
              { num: 3, label: 'Civitai' },
              { num: 4, label: 'Integration' },
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
                <h3>Select Your Primary Generation Workflow</h3>
              </div>
              <p className={styles.sectionDesc}>
                <strong>Good news:</strong> PromptHound runs all extraction engines concurrently on every image. Selecting a workflow simply customizes your default one-click copy syntax.
              </p>

              <div className={styles.cardGrid}>
                <div
                  className={`${styles.selectCard} ${workflowProfile === 'general' ? styles.cardSelected : ''}`}
                  onClick={() => setWorkflowProfile('general')}
                >
                  <div className={styles.cardBadge} style={{ background: '#F59A24', color: '#0B0E15' }}>Recommended</div>
                  <h4>Universal Auto-Detect</h4>
                  <p>Runs all engines together. Perfect for mixed libraries (Civitai, ComfyUI, A1111, Midjourney).</p>
                </div>

                <div
                  className={`${styles.selectCard} ${workflowProfile === 'a1111' ? styles.cardSelected : ''}`}
                  onClick={() => setWorkflowProfile('a1111')}
                >
                  <div className={styles.cardBadge}>WebUI</div>
                  <h4>Automatic1111 / SD-Forge</h4>
                  <p>Standard web UI syntax, embeddings, and &lt;lora:name:weight&gt; prompt tags.</p>
                </div>

                <div
                  className={`${styles.selectCard} ${workflowProfile === 'comfyui' ? styles.cardSelected : ''}`}
                  onClick={() => setWorkflowProfile('comfyui')}
                >
                  <div className={styles.cardBadge}>Node Graph</div>
                  <h4>ComfyUI</h4>
                  <p>Extracts full JSON node workflows, KSampler seeds, and CLIP text conditioning.</p>
                </div>

                <div
                  className={`${styles.selectCard} ${workflowProfile === 'fooocus' ? styles.cardSelected : ''}`}
                  onClick={() => setWorkflowProfile('fooocus')}
                >
                  <h4>Fooocus & NovelAI</h4>
                  <p>Parses hidden metadata, Danbooru tag weighting, and Fooocus preset styles.</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Local Folders */}
          {step === 2 && (
            <div className={styles.stepContent}>
              <div className={styles.sectionHeading}>
                <FolderIcon size={20} />
                <h3>Configure Local Model Directories</h3>
              </div>
              <p className={styles.sectionDesc}>
                Set your local LoRA and output folders to allow header reading and offline hash matching.
              </p>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Local LoRA Directory</label>
                <GlassInput
                  value={loraDirectory}
                  onChange={(e) => setLoraDirectory(e.target.value)}
                  placeholder="e.g. C:\AI\ComfyUI\models\loras"
                  icon={<FolderIcon size={16} />}
                />
                <span className={styles.formHelp}>
                  Used to cross-reference extracted filename hashes with locally downloaded .safetensors files.
                </span>
              </div>

              <div className={styles.formGroup} style={{ marginTop: '16px' }}>
                <label className={styles.formLabel}>Default Generation Output Folder</label>
                <GlassInput
                  value={outputDirectory}
                  onChange={(e) => setOutputDirectory(e.target.value)}
                  placeholder="e.g. C:\AI\outputs"
                  icon={<FolderIcon size={16} />}
                />
                <span className={styles.formHelp}>
                  Default destination for exported prompt cards and metadata receipts.
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: Civitai Platform & API Key */}
          {step === 3 && (
            <div className={styles.stepContent}>
              <div className={styles.sectionHeading}>
                <GlobeIcon size={20} />
                <h3>Civitai Platform & API Configuration</h3>
              </div>
              <p className={styles.sectionDesc}>
                Configure resolution domain and add an optional API token to unlock mature model lookups and higher rate limits.
              </p>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Preferred Civitai Platform</label>
                <select
                  value={civitaiDomain}
                  onChange={(e) => setCivitaiDomain(e.target.value as CivitaiDomainPreference)}
                  className={styles.selectInput}
                >
                  <option value="civitai.red">
                    Civitai.red (Recommended - Full SFW & NSFW Catalog)
                  </option>
                  <option value="auto">
                    Auto-Route (civitai.red for NSFW, civitai.com for SFW)
                  </option>
                  <option value="civitai.com">
                    Civitai.com (Strict PG/SFW Domain)
                  </option>
                </select>
                <span className={styles.formHelp}>
                  <strong>Civitai.red</strong> hosts both SFW and NSFW models with no domain filtering, ensuring model links open reliably.
                </span>
              </div>

              <div className={styles.formGroup} style={{ marginTop: '16px' }}>
                <label className={styles.formLabel}>Civitai API Key (Optional)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <GlassInput
                      type="password"
                      value={civitaiApiKey}
                      onChange={(e) => setCivitaiApiKey(e.target.value)}
                      placeholder="Paste your Civitai API key here..."
                    />
                  </div>
                  <SecondaryButton onClick={testCivitaiConnection} disabled={apiTesting}>
                    {apiTesting ? 'Testing…' : 'Test API'}
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

          {/* STEP 4: Desktop Shell & Hotkeys */}
          {step === 4 && (
            <div className={styles.stepContent}>
              <div className={styles.sectionHeading}>
                <LightningIcon size={20} />
                <h3>Desktop Integrations & Hotkeys</h3>
              </div>
              <p className={styles.sectionDesc}>
                Enable native convenience shortcuts for rapid generation inspection while you create.
              </p>

              <div className={styles.toggleList}>
                <label className={styles.toggleRow}>
                  <div className={styles.toggleInfo}>
                    <span className={styles.toggleTitle}>Windows Explorer Right-Click Menu</span>
                    <span className={styles.toggleDesc}>
                      Add &quot;Extract with PromptHound&quot; to right-click menus for .png, .webp, and .jpg files.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableContextMenu}
                    onChange={(e) => setEnableContextMenu(e.target.checked)}
                    className={styles.checkbox}
                  />
                </label>

                <label className={styles.toggleRow}>
                  <div className={styles.toggleInfo}>
                    <span className={styles.toggleTitle}>Auto-Detect Dragged Images</span>
                    <span className={styles.toggleDesc}>
                      Instantly parses files dropped anywhere onto the PromptHound window (up to 10 at once).
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableClipboardWatch}
                    onChange={(e) => setEnableClipboardWatch(e.target.checked)}
                    className={styles.checkbox}
                  />
                </label>

                <label className={styles.toggleRow}>
                  <div className={styles.toggleInfo}>
                    <span className={styles.toggleTitle}>Global Quick-Inspect Hotkey (Win + Shift + H)</span>
                    <span className={styles.toggleDesc}>
                      Press hotkey anywhere in Windows to inspect the image currently on your clipboard.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableHotkeys}
                    onChange={(e) => setEnableHotkeys(e.target.checked)}
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
              Back
            </SecondaryButton>
          ) : (
            <SecondaryButton onClick={onClose}>
              Skip for Now
            </SecondaryButton>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            {step < 4 ? (
              <PrimaryButton onClick={() => setStep((step + 1) as any)}>
                Continue
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={handleFinishSetup} icon={<SparklesIcon size={16} />}>
                Complete Setup
              </PrimaryButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
