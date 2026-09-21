import { SupportedPlatform } from './types.js';

export function detectUrlType(url: string): { isDirectImage: boolean; platform: SupportedPlatform } {
  const trimmed = url.trim().toLowerCase();

  const isDirectImage = /\.(png|jpe?g|webp|gif)($|\?)/i.test(trimmed);

  if (trimmed.includes('civitai.com')) {
    return { isDirectImage, platform: 'Civitai' };
  }
  if (trimmed.includes('seaart.ai')) {
    return { isDirectImage, platform: 'SeaArt' };
  }
  return { isDirectImage, platform: 'Unknown' };
}

export function detectFormatFromText(rawText: string): string {
  if (rawText.includes('"prompt"') && rawText.includes('"nodes"') || rawText.includes('class_type')) {
    return 'ComfyUI Workflow (JSON)';
  }
  if (rawText.includes('Steps:') && rawText.includes('Sampler:') && rawText.includes('CFG scale:')) {
    return 'Automatic1111 / WebUI (PNG tEXt)';
  }
  if (rawText.includes('"meta"') || rawText.includes('"generationProcess"')) {
    return 'Civitai / SeaArt API (JSON)';
  }
  return 'Standard AI Metadata';
}
