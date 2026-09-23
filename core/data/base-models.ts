export const BASE_MODELS = [
  'SDXL 1.0',
  'Pony Diffusion V6 XL',
  'Flux.1 [dev]',
  'Flux.1 [schnell]',
  'Stable Diffusion 1.5',
  'Illustrious XL',
  'SD 3.5 Large',
  'Animagine XL 3.1',
  'NoobAI XL',
] as const;

export type BaseModelType = typeof BASE_MODELS[number] | string;
