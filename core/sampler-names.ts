/**
 * Display labels for sampler / scheduler identifiers. ComfyUI and Civitai's on-site
 * generator write internal ids ("dpmpp_2m", "euler_ancestral"); A1111 writes labels
 * ("DPM++ 2M Karras"). Everything is shown with A1111 labels.
 */

/** "dpmpp_2m" + "karras" -> "DPM++ 2M Karras" */
export const SAMPLER_NAMES: Record<string, string> = {
  euler: 'Euler',
  euler_ancestral: 'Euler a',
  euler_cfg_pp: 'Euler CFG++',
  euler_ancestral_cfg_pp: 'Euler a CFG++',
  heun: 'Heun',
  heunpp2: 'Heun++ 2',
  dpm_2: 'DPM2',
  dpm_2_ancestral: 'DPM2 a',
  lms: 'LMS',
  dpm_fast: 'DPM fast',
  dpm_adaptive: 'DPM adaptive',
  dpmpp_2s_ancestral: 'DPM++ 2S a',
  dpmpp_sde: 'DPM++ SDE',
  dpmpp_sde_gpu: 'DPM++ SDE',
  dpmpp_2m: 'DPM++ 2M',
  dpmpp_2m_sde: 'DPM++ 2M SDE',
  dpmpp_2m_sde_gpu: 'DPM++ 2M SDE',
  dpmpp_3m_sde: 'DPM++ 3M SDE',
  dpmpp_3m_sde_gpu: 'DPM++ 3M SDE',
  ddpm: 'DDPM',
  lcm: 'LCM',
  ddim: 'DDIM',
  uni_pc: 'UniPC',
  uni_pc_bh2: 'UniPC BH2',
  ipndm: 'iPNDM',
  deis: 'DEIS',
};

export const SCHEDULER_NAMES: Record<string, string> = {
  karras: 'Karras',
  exponential: 'Exponential',
  sgm_uniform: 'SGM Uniform',
  ddim_uniform: 'DDIM Uniform',
  beta: 'Beta',
  linear_quadratic: 'Linear Quadratic',
  kl_optimal: 'KL Optimal',
  AYS: 'Align Your Steps',
};

export function normalizeSampler(samplerName?: string, scheduler?: string): string | undefined {
  if (!samplerName) return undefined;
  const sampler =
    SAMPLER_NAMES[samplerName.toLowerCase()] ||
    samplerName.replace(/_ancestral$/i, ' a').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // "normal" and "simple" are the defaults and are omitted, as A1111 does
  if (!scheduler || /^(normal|simple)$/i.test(scheduler)) return sampler;
  const schedulerLabel = SCHEDULER_NAMES[scheduler] || scheduler.charAt(0).toUpperCase() + scheduler.slice(1);
  return `${sampler} ${schedulerLabel}`;
}

/**
 * Converts an internal sampler id ("dpmpp_2m", "euler") to its label; leaves values
 * that are already labels ("DPM++ 2M Karras", "Euler a", "Heun") unchanged.
 */
export function samplerLabel(sampler?: string, scheduler?: string): string | undefined {
  if (!sampler) return undefined;
  if (!/^[a-z0-9_]+$/.test(sampler)) return sampler;
  return normalizeSampler(sampler, scheduler);
}

/**
 * Adds a scheduler to a sampler label ("DPM++ 2M" + "karras" -> "DPM++ 2M Karras"), as
 * A1111 1.9+ ("Schedule type: Karras") and Civitai's normalizer store them apart.
 * Default schedulers are left out, and a label that already names it is kept as it is.
 */
export function withScheduler(samplerLabelText?: string, scheduler?: string): string | undefined {
  if (!samplerLabelText || !scheduler || /^(normal|simple|automatic)$/i.test(scheduler.trim())) return samplerLabelText;
  const key = Object.keys(SCHEDULER_NAMES).find((k) => k.toLowerCase() === scheduler.trim().toLowerCase());
  const label = key ? SCHEDULER_NAMES[key] : scheduler.trim().charAt(0).toUpperCase() + scheduler.trim().slice(1);
  return samplerLabelText.toLowerCase().includes(label.toLowerCase()) ? samplerLabelText : `${samplerLabelText} ${label}`;
}
