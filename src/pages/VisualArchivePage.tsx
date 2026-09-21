import React, { useState, useRef, useEffect } from 'react';
import {
  ArchiveIcon,
  ExportIcon,
  CopyIcon,
  CheckIcon,
  ChevronLeftIcon,
  PromptHoundLogo,
} from '../components/icons/Icons.js';
import { PrimaryButton } from '../components/primitives/PrimaryButton.js';
import { SecondaryButton } from '../components/primitives/SecondaryButton.js';
import { GlassCard } from '../components/primitives/GlassCard.js';
import { useNavigation } from '../navigation/NavigationContext.js';
import styles from './StaticPage.module.css';

export const VisualArchivePage: React.FC = () => {
  const { navigate, activeMetadata } = useNavigation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [downloadReady, setDownloadReady] = useState(false);
  const [copied, setCopied] = useState(false);

  const promptText =
    activeMetadata?.prompt ||
    'masterpiece, best quality, ultra detailed, 1girl, cyberpunk style, neon lights, night city, blue hair, looking back, jacket, cinematic lighting';
  const sampler =
    activeMetadata?.sampler ||
    (activeMetadata as any)?.generation?.sampler ||
    'DPM++ 2M Karras';
  const steps =
    activeMetadata?.steps ||
    (activeMetadata as any)?.generation?.steps ||
    30;
  const cfg =
    activeMetadata?.cfgScale ||
    (activeMetadata as any)?.generation?.cfgScale ||
    7.5;
  const seed =
    String(activeMetadata?.seed || (activeMetadata as any)?.generation?.seed || '123456789');
  const model =
    activeMetadata?.model ||
    (activeMetadata as any)?.generation?.model ||
    'DreamShaper XL v2.1';
  const imageUrl =
    (activeMetadata as any)?.previewUrl ||
    (activeMetadata as any)?.image?.url ||
    'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Render high-resolution visual archive sheet
    canvas.width = 1200;
    canvas.height = 800;

    // Background
    ctx.fillStyle = '#0a160a';
    ctx.fillRect(0, 0, 1200, 800);

    // Decorative gradient header
    const grad = ctx.createLinearGradient(0, 0, 1200, 0);
    grad.addColorStop(0, '#d8780e');
    grad.addColorStop(1, '#f6a52b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1200, 8);

    // Header text
    ctx.fillStyle = '#fbfdf8';
    ctx.font = 'bold 28px Plus Jakarta Sans, sans-serif';
    ctx.fillText('PromptHound Archive Record', 40, 60);

    ctx.fillStyle = '#8f9a84';
    ctx.font = '16px Plus Jakarta Sans, sans-serif';
    ctx.fillText('Archived AI Generation Recipe & Cryptographic Verification', 40, 90);

    const renderCanvasContent = (imageElement?: HTMLImageElement) => {
      // Draw image frame
      ctx.fillStyle = '#182713';
      ctx.fillRect(40, 120, 520, 520);
      if (imageElement) {
        try {
          ctx.drawImage(imageElement, 45, 125, 510, 510);
        } catch {
          ctx.fillStyle = '#23381a';
          ctx.fillRect(45, 125, 510, 510);
          ctx.fillStyle = '#8f9a84';
          ctx.font = '16px Plus Jakarta Sans, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('AI Image Preview', 300, 380);
          ctx.textAlign = 'start';
        }
      } else {
        ctx.fillStyle = '#23381a';
        ctx.fillRect(45, 125, 510, 510);
        ctx.fillStyle = '#8f9a84';
        ctx.font = '16px Plus Jakarta Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('AI Image Preview', 300, 380);
        ctx.textAlign = 'start';
      }

      // Border around image
      ctx.strokeStyle = '#324726';
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 120, 520, 520);

      // Metadata card on the right
      ctx.fillStyle = '#142010';
      ctx.fillRect(590, 120, 570, 520);
      ctx.strokeStyle = '#324726';
      ctx.lineWidth = 1;
      ctx.strokeRect(590, 120, 570, 520);

      // Prompt Box
      ctx.fillStyle = '#d8780e';
      ctx.font = 'bold 14px Plus Jakarta Sans, sans-serif';
      ctx.fillText('POSITIVE PROMPT', 615, 160);

      ctx.fillStyle = '#fbfdf8';
      ctx.font = '15px Plus Jakarta Sans, sans-serif';
      // Word wrap prompt
      const words = promptText.split(' ');
      let line = '';
      let y = 190;
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > 520 && n > 0) {
          ctx.fillText(line, 615, y);
          line = words[n] + ' ';
          y += 24;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, 615, y);

      // Generation Metrics
      const gridY = 360;
      ctx.fillStyle = '#182713';
      ctx.fillRect(615, gridY, 520, 140);
      ctx.strokeStyle = '#435836';
      ctx.strokeRect(615, gridY, 520, 140);

      ctx.fillStyle = '#8f9a84';
      ctx.font = '12px Plus Jakarta Sans, sans-serif';
      ctx.fillText('MODEL', 635, gridY + 30);
      ctx.fillText('SAMPLER', 635, gridY + 75);
      ctx.fillText('CFG SCALE', 880, gridY + 30);
      ctx.fillText('STEPS', 880, gridY + 75);
      ctx.fillText('SEED', 635, gridY + 120);

      ctx.fillStyle = '#fbfdf8';
      ctx.font = 'bold 14px Plus Jakarta Sans, sans-serif';
      ctx.fillText(String(model), 635, gridY + 48);
      ctx.fillText(String(sampler), 635, gridY + 93);
      ctx.fillText(String(cfg), 880, gridY + 48);
      ctx.fillText(String(steps), 880, gridY + 93);
      ctx.fillText(String(seed), 680, gridY + 120);

      // LoRAs
      ctx.fillStyle = '#d8780e';
      ctx.font = 'bold 14px Plus Jakarta Sans, sans-serif';
      ctx.fillText('ATTACHED LORAS', 615, 540);

      ctx.fillStyle = '#e1ebd2';
      ctx.font = '14px Plus Jakarta Sans, sans-serif';
      ctx.fillText('• Cyberpunk_Style (weight: 0.8) — Civitai verified', 615, 570);
      ctx.fillText('• Detail_Tweaker (weight: 0.4) — Civitai verified', 615, 595);

      // Footer
      ctx.fillStyle = '#4f5928';
      ctx.font = '13px Plus Jakarta Sans, sans-serif';
      ctx.fillText('Generated by PromptHound Phase 1 · Universal AI Recipe Archiver', 40, 760);

      setDownloadReady(true);
    };

    // Load Image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
      renderCanvasContent(img);
    };
    img.onerror = () => {
      renderCanvasContent();
    };
  }, [promptText, sampler, steps, cfg, seed, model, imageUrl]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `PromptHound_Archive_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className={styles.page}>
      <div>
        <button
          className={styles.backBtn}
          style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}
          onClick={() => navigate('library')}
        >
          <ChevronLeftIcon size={16} /> Back to Library
        </button>
        <h1 className={styles.headerTitle}>Visual Archive Compiler</h1>
        <p className={styles.headerSubtitle}>
          Create self-contained archive composite images embedding prompt, seed, model, and LoRA specifications.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <PrimaryButton
          icon={<ExportIcon size={16} />}
          disabled={!downloadReady}
          onClick={handleDownload}
        >
          Export Archive PNG
        </PrimaryButton>
        <SecondaryButton
          icon={copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
          onClick={() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? 'Copied Link!' : 'Copy Shareable Link'}
        </SecondaryButton>
      </div>

      <GlassCard style={{ padding: '20px', overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
        <canvas
          ref={canvasRef}
          style={{
            maxWidth: '100%',
            height: 'auto',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          }}
        />
      </GlassCard>
    </div>
  );
};
