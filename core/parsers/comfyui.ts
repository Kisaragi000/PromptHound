import type { ExtractedMetadata, LoraReference } from '../types.js';
import { extractInlineLoras } from './a1111.js';
import { fillMissingFields, loraKey } from '../metadata-merge.js';

/**
 * ComfyUI metadata parser.
 *
 * ComfyUI images carry two graphs:
 *  - `prompt`: the executed API graph ({ id: { class_type, inputs } }), where an input
 *    is either a literal or a link `[sourceNodeId, outputSlot]`.
 *  - `workflow`: the editor graph (nodes with positional `widgets_values` plus a link table).
 *
 * The API graph is authoritative. The workflow graph is converted into the same
 * shape and only used to fill fields the API graph could not provide.
 */

type Link = [string, number];

interface ApiNode {
  class_type: string;
  inputs: Record<string, any>;
  _meta?: { title?: string };
}

type ApiGraph = Record<string, ApiNode>;

interface WorkflowNode {
  id: number | string;
  type: string;
  mode?: number;
  title?: string;
  widgets_values?: any[] | Record<string, any>;
  inputs?: Array<{ name: string; type?: string; link?: number | null }>;
  outputs?: Array<{ name?: string; type?: string }>;
}

interface WorkflowGraph {
  nodes?: WorkflowNode[];
  links?: Array<any[] | { id: number; origin_id: number | string; origin_slot: number }>;
}

type Dimensions = { width?: number; height?: number };

const MAX_DEPTH = 40;

// Inputs that hold the value of primitive / text / seed style nodes, in priority order
const VALUE_KEYS = [
  'populated_text', 'value', 'string', 'text', 'prompt', 'Text', 'seed', 'noise_seed',
  'int', 'float', 'number', 'wildcard_text', 'widget_0',
];

// Inputs that hold prompt text on text-encoder nodes, in priority order
const TEXT_KEYS = [
  'populated_text', 'text', 'prompt', 't5xxl', 'text_g', 'clip_l', 'text_l', 'clip_g', 'wildcard_text', 'widget_0',
];

const OUTPUT_NODE_PATTERN = /SaveImage|PreviewImage|Image Save|Save Image|ImageSave|SaveAnimated|SaveWEBM|VHS_VideoCombine/i;

function isLink(value: unknown): value is Link {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    (typeof value[0] === 'string' || typeof value[0] === 'number') &&
    typeof value[1] === 'number'
  );
}

function nodeAt(graph: ApiGraph, ref: unknown): ApiNode | undefined {
  return isLink(ref) ? graph[String(ref[0])] : undefined;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function toText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** "SDXL\\juggernautXL_v9.safetensors" -> "juggernautXL_v9" */
function cleanFileName(name: string): string {
  const base = name.trim().split(/[\\/]/).pop() || name.trim();
  return base.replace(/\.(safetensors|ckpt|pt|pth|bin|gguf|sft)$/i, '');
}

function isConcatNode(node: ApiNode): boolean {
  return /concat|join|combine|append/i.test(node.class_type) && !/conditioning/i.test(node.class_type);
}

/**
 * Follows a link to the literal value it ultimately carries (primitive nodes,
 * seed nodes, string nodes, wildcard processors, text concatenation).
 */
function resolveValue(graph: ApiGraph, value: unknown, depth = 0): any {
  if (!isLink(value)) return value;
  const node = nodeAt(graph, value);
  if (!node || depth > MAX_DEPTH) return undefined;
  const inputs = node.inputs || {};

  if (isConcatNode(node)) {
    const text = joinTextInputs(graph, node, depth);
    if (text) return text;
  }

  for (const key of VALUE_KEYS) {
    if (key in inputs) {
      const resolved = resolveValue(graph, inputs[key], depth + 1);
      if (resolved !== undefined && resolved !== '') return resolved;
    }
  }
  return undefined;
}

function joinTextInputs(graph: ApiGraph, node: ApiNode, depth: number): string {
  const inputs = node.inputs || {};
  const delimiterRaw = inputs.delimiter ?? inputs.separator;
  const delimiter = typeof delimiterRaw === 'string' ? delimiterRaw.replace(/\\n/g, '\n') : ', ';

  const parts: string[] = [];
  for (const [key, val] of Object.entries(inputs)) {
    if (!/^(text|string|str|prompt)(_?[a-z0-9]{0,3})$/i.test(key)) continue;
    const resolved = toText(resolveValue(graph, val, depth + 1));
    if (resolved) parts.push(resolved);
  }
  return parts.join(delimiter);
}

/** Reads the prompt text of a text-encoder-like node. */
function readEncoderText(graph: ApiGraph, node: ApiNode, depth: number): string {
  const inputs = node.inputs || {};

  // SDXL encoders carry two prompts; they are usually identical
  const textG = toText(resolveValue(graph, inputs.text_g, depth + 1));
  const textL = toText(resolveValue(graph, inputs.text_l, depth + 1));
  if (textG && textL && textG !== textL) return `${textG}, ${textL}`;

  for (const key of TEXT_KEYS) {
    if (!(key in inputs)) continue;
    const resolved = toText(resolveValue(graph, inputs[key], depth + 1));
    if (resolved) return resolved;
  }
  return '';
}

/**
 * Traces a CONDITIONING link back to the prompt text that produced it, passing through
 * ControlNet / guidance / area / combine nodes along the way.
 */
function traceConditioning(graph: ApiGraph, ref: unknown, depth = 0): string {
  const node = nodeAt(graph, ref);
  if (!node || depth > MAX_DEPTH) return '';
  const slot = (ref as Link)[1];
  const cls = node.class_type || '';
  const inputs = node.inputs || {};

  if (cls === 'ConditioningZeroOut') return '';

  // Loader nodes with built-in prompts (Efficient Loader: outputs CONDITIONING+ at 1, CONDITIONING- at 2)
  if (/loader/i.test(cls) && ('positive' in inputs || 'negative' in inputs) && !isLink(inputs.positive)) {
    const key = slot === 2 ? 'negative' : 'positive';
    return toText(resolveValue(graph, inputs[key], depth + 1)) || '';
  }

  // Nodes that combine several conditionings
  const combineKeys = Object.keys(inputs).filter((k) => /^conditioning_(\d+|to|from)$/i.test(k));
  if (combineKeys.length > 0) {
    const texts = combineKeys.map((k) => traceConditioning(graph, inputs[k], depth + 1)).filter(Boolean);
    return Array.from(new Set(texts)).join(', ');
  }

  // Nodes that pass both polarities through (ControlNetApplyAdvanced, InstructPix2Pix, ...)
  if (isLink(inputs.positive) && isLink(inputs.negative)) {
    return traceConditioning(graph, slot === 1 ? inputs.negative : inputs.positive, depth + 1);
  }

  // Single conditioning pass-through (FluxGuidance, ControlNetApply, ConditioningSetArea, ...)
  if (isLink(inputs.conditioning)) {
    return traceConditioning(graph, inputs.conditioning, depth + 1);
  }

  // Text encoders (CLIPTextEncode, CLIPTextEncodeSDXL, CLIPTextEncodeFlux, BNK / smZ variants, ImpactWildcardEncode, ...)
  const encoderText = readEncoderText(graph, node, depth);
  if (encoderText) return encoderText;

  // Anything else: follow the first conditioning-like link
  for (const [key, val] of Object.entries(inputs)) {
    if (isLink(val) && /cond|positive|negative/i.test(key)) {
      const text = traceConditioning(graph, val, depth + 1);
      if (text) return text;
    }
  }
  return '';
}

/**
 * Breadth-first search upstream from `start` through link inputs whose name matches
 * `keyFilter`, returning the first node that satisfies `predicate`.
 */
function findUpstream(
  graph: ApiGraph,
  start: unknown,
  predicate: (node: ApiNode) => boolean,
  keyFilter: RegExp = /.*/
): ApiNode | undefined {
  if (!isLink(start)) return undefined;
  const queue: string[] = [String(start[0])];
  const seen = new Set<string>();

  while (queue.length > 0 && seen.size < 500) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = graph[id];
    if (!node) continue;
    if (predicate(node)) return node;
    for (const [key, val] of Object.entries(node.inputs || {})) {
      if (isLink(val) && keyFilter.test(key)) queue.push(String(val[0]));
    }
  }
  return undefined;
}

function isSamplerNode(node: ApiNode): boolean {
  const cls = node.class_type || '';
  const inputs = node.inputs || {};
  return /sampler/i.test(cls) && !/select|scheduler|sigma/i.test(cls) && ('positive' in inputs || 'guider' in inputs);
}

/**
 * Picks the sampler whose output reaches a saved image. With a hires-fix style chain,
 * the base pass (sampling an empty latent) is reported, matching A1111 conventions.
 */
function chooseSampler(graph: ApiGraph): ApiNode | undefined {
  const allSamplers = Object.values(graph).filter(isSamplerNode);
  if (allSamplers.length <= 1) return allSamplers[0];

  const outputs = Object.entries(graph).filter(([, n]) => OUTPUT_NODE_PATTERN.test(n.class_type || ''));
  const upstream: ApiNode[] = [];
  const queue = outputs.map(([id]) => id);
  const seen = new Set<string>();
  while (queue.length > 0 && seen.size < 1000) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = graph[id];
    if (!node) continue;
    if (isSamplerNode(node)) upstream.push(node);
    for (const val of Object.values(node.inputs || {})) {
      if (isLink(val)) queue.push(String(val[0]));
    }
  }

  const candidates = upstream.length > 0 ? upstream : allSamplers;
  const basePass = candidates.find((s) => /empty.*latent|latent.*empty/i.test(nodeAt(graph, s.inputs?.latent_image)?.class_type || ''));
  return basePass || candidates[candidates.length - 1];
}

/** "dpmpp_2m" + "karras" -> "DPM++ 2M Karras" */
const SAMPLER_NAMES: Record<string, string> = {
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

const SCHEDULER_NAMES: Record<string, string> = {
  karras: 'Karras',
  exponential: 'Exponential',
  sgm_uniform: 'SGM Uniform',
  ddim_uniform: 'DDIM Uniform',
  beta: 'Beta',
  linear_quadratic: 'Linear Quadratic',
  kl_optimal: 'KL Optimal',
  AYS: 'Align Your Steps',
};

function normalizeSampler(samplerName?: string, scheduler?: string): string | undefined {
  if (!samplerName) return undefined;
  const sampler =
    SAMPLER_NAMES[samplerName.toLowerCase()] ||
    samplerName.replace(/_ancestral$/i, ' a').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // "normal" and "simple" are the defaults and are omitted, as A1111 does
  if (!scheduler || /^(normal|simple)$/i.test(scheduler)) return sampler;
  const schedulerLabel = SCHEDULER_NAMES[scheduler] || scheduler.charAt(0).toUpperCase() + scheduler.slice(1);
  return `${sampler} ${schedulerLabel}`;
}

interface SamplerParams {
  seed?: string;
  steps?: number;
  cfgScale?: number;
  samplerName?: string;
  scheduler?: string;
  positiveRef?: unknown;
  negativeRef?: unknown;
  modelRef?: unknown;
  latentRef?: unknown;
}

/** Reads KSampler / KSamplerAdvanced / SamplerCustom / SamplerCustomAdvanced parameters. */
function readSamplerParams(graph: ApiGraph, sampler: ApiNode): SamplerParams {
  const inputs = sampler.inputs || {};
  const seedValue = resolveValue(graph, inputs.seed ?? inputs.noise_seed);
  const params: SamplerParams = {
    seed: seedValue !== undefined && seedValue !== '' ? String(seedValue) : undefined,
    steps: toNumber(resolveValue(graph, inputs.steps)),
    cfgScale: toNumber(resolveValue(graph, inputs.cfg)),
    samplerName: toText(resolveValue(graph, inputs.sampler_name)),
    scheduler: toText(resolveValue(graph, inputs.scheduler)),
    positiveRef: inputs.positive,
    negativeRef: inputs.negative,
    modelRef: inputs.model,
    latentRef: inputs.latent_image,
  };

  // SamplerCustomAdvanced: noise / guider / sampler / sigmas come from separate nodes
  const noise = nodeAt(graph, inputs.noise);
  if (noise && params.seed === undefined) {
    const value = resolveValue(graph, noise.inputs?.noise_seed ?? noise.inputs?.seed);
    if (value !== undefined && value !== '') params.seed = String(value);
  }

  const samplerNode = nodeAt(graph, inputs.sampler);
  if (samplerNode && !params.samplerName) {
    params.samplerName =
      toText(resolveValue(graph, samplerNode.inputs?.sampler_name)) ||
      toText(samplerNode.class_type.replace(/^Sampler/, ''));
  }

  const sigmas = nodeAt(graph, inputs.sigmas);
  if (sigmas) {
    params.steps ??= toNumber(resolveValue(graph, sigmas.inputs?.steps));
    params.scheduler ??=
      toText(resolveValue(graph, sigmas.inputs?.scheduler)) ||
      (/karras/i.test(sigmas.class_type) ? 'karras' : /exponential/i.test(sigmas.class_type) ? 'exponential' : /alignyoursteps/i.test(sigmas.class_type) ? 'AYS' : undefined);
  }

  const guider = nodeAt(graph, inputs.guider);
  if (guider) {
    const g = guider.inputs || {};
    params.cfgScale ??= toNumber(resolveValue(graph, g.cfg));
    params.positiveRef ??= g.positive ?? g.conditioning ?? g.cond1;
    params.negativeRef ??= g.negative;
    params.modelRef ??= g.model;
  }

  return params;
}

function readCheckpointName(node: ApiNode): string | undefined {
  const inputs = node.inputs || {};
  const name = inputs.ckpt_name ?? inputs.unet_name ?? inputs.base_ckpt_name ?? inputs.model_name;
  return typeof name === 'string' && name !== 'None' ? cleanFileName(name) : undefined;
}

function readDimensions(graph: ApiGraph, node: ApiNode): Dimensions | undefined {
  const inputs = node.inputs || {};
  // Efficient Loader keeps its latent size as empty_latent_width / empty_latent_height
  const width = toNumber(resolveValue(graph, inputs.width ?? inputs.empty_latent_width));
  const height = toNumber(resolveValue(graph, inputs.height ?? inputs.empty_latent_height));
  if (width && height) return { width, height };

  // e.g. SDXL Empty Latent Image (rgthree): dimensions "832 x 1216  (portrait)"
  const dims = typeof inputs.dimensions === 'string' ? inputs.dimensions.match(/(\d+)\s*x\s*(\d+)/i) : null;
  if (dims) return { width: Number(dims[1]), height: Number(dims[2]) };
  return undefined;
}

function pushLora(loras: LoraReference[], rawName: unknown, strength: unknown): void {
  if (typeof rawName !== 'string' || !rawName.trim() || rawName === 'None') return;
  const name = cleanFileName(rawName);
  if (loras.some((l) => loraKey(l.rawName) === loraKey(name))) return;
  const weight = toNumber(strength);
  loras.push({ rawName: name, strength: weight ?? 1.0 });
}

/**
 * Extracts LoRAs from standard and custom loader nodes: LoraLoader(ModelOnly), pysssss,
 * CR LoRA Stack, Efficiency LoRA Stacker / Efficient Loader, Easy-Use stacks, rgthree
 * Power Lora Loader, and prompt-tag loaders.
 */
function extractLorasFromNode(graph: ApiGraph, node: ApiNode, loras: LoraReference[]): void {
  const inputs = node.inputs || {};
  const value = (v: unknown) => resolveValue(graph, v);

  // Single loaders (LoraLoader, LoraLoaderModelOnly, Efficient Loader's built-in slot, ...)
  if ('lora_name' in inputs) {
    const strengthModel = value(inputs.strength_model ?? inputs.lora_model_strength ?? inputs.strength ?? inputs.lora_strength);
    const strengthClip = value(inputs.strength_clip ?? inputs.lora_clip_strength);
    // A loader with both weights at zero applies nothing
    if (!(toNumber(strengthModel) === 0 && (strengthClip === undefined || toNumber(strengthClip) === 0))) {
      pushLora(loras, value(inputs.lora_name), strengthModel);
    }
  }

  // Numbered stacks: lora_name_1 / lora_name1 with matching weight and switch inputs
  for (const key of Object.keys(inputs)) {
    const match = key.match(/^lora_name_?(\d+)$/i);
    if (!match) continue;
    const n = match[1];
    const switchValue = value(inputs[`switch_${n}`] ?? inputs[`switch${n}`] ?? inputs[`lora_${n}_on`]);
    if (switchValue === 'Off' || switchValue === false) continue;
    const weight = value(
      inputs[`lora_wt_${n}`] ??
        inputs[`lora_weight_${n}`] ??
        inputs[`lora_model_strength_${n}`] ??
        inputs[`model_str_${n}`] ??
        inputs[`lora_${n}_strength`] ??
        inputs[`lora_${n}_model_strength`]
    );
    pushLora(loras, value(inputs[key]), weight);
  }

  // rgthree Power Lora Loader: lora_1: { on, lora, strength }
  for (const val of Object.values(inputs)) {
    if (val && typeof val === 'object' && !Array.isArray(val) && typeof (val as any).lora === 'string') {
      if ((val as any).on === false) continue;
      pushLora(loras, (val as any).lora, (val as any).strength);
    }
  }

  // Prompt-tag loaders (LoraTagLoader and similar) apply <lora:...> tags from their text
  if (/lora/i.test(node.class_type) && /tag|prompt|text/i.test(node.class_type)) {
    const text = toText(value(inputs.text ?? inputs.prompt));
    if (text) {
      for (const tagLora of extractInlineLoras(text).loras) pushLora(loras, tagLora.rawName, tagLora.strength);
    }
  }
}

/**
 * Parses a ComfyUI API (`prompt`) graph.
 */
function parseApiGraph(graph: ApiGraph, imageDimensions?: Dimensions): ExtractedMetadata | null {
  const nodes = Object.values(graph).filter((n): n is ApiNode => Boolean(n && typeof n === 'object' && n.class_type));
  if (nodes.length === 0) return null;

  const sampler = chooseSampler(graph);
  const params: SamplerParams = sampler ? readSamplerParams(graph, sampler) : {};

  let positivePrompt = params.positiveRef ? traceConditioning(graph, params.positiveRef) : '';
  let negativePrompt = params.negativeRef ? traceConditioning(graph, params.negativeRef) : '';

  // No sampler reachable: fall back to text encoders in graph order
  if (!sampler) {
    const encoders = nodes.filter((n) => /TextEncode|CLIPText/i.test(n.class_type));
    positivePrompt = encoders[0] ? readEncoderText(graph, encoders[0], 0) : '';
    negativePrompt = encoders[1] ? readEncoderText(graph, encoders[1], 0) : '';
  }

  // Flux-style guidance lives on the conditioning chain instead of the sampler
  const guidanceNode = findUpstream(graph, params.positiveRef, (n) => n.class_type === 'FluxGuidance');
  const guidance = guidanceNode ? toNumber(resolveValue(graph, guidanceNode.inputs?.guidance)) : undefined;
  let cfgScale = params.cfgScale;
  if (guidance !== undefined && (cfgScale === undefined || cfgScale === 1)) cfgScale = guidance;

  // Checkpoint: follow the sampler's model input, else any loader in the graph
  const ckptNode =
    findUpstream(graph, params.modelRef, (n) => readCheckpointName(n) !== undefined, /model|unet|ckpt|pipe/i) ||
    nodes.find((n) => readCheckpointName(n) !== undefined);
  const model = ckptNode ? readCheckpointName(ckptNode) : undefined;

  // Dimensions: follow the latent input to the empty-latent node
  const latentNode = findUpstream(
    graph,
    params.latentRef,
    (n) => readDimensions(graph, n) !== undefined && (/latent/i.test(n.class_type) || 'empty_latent_width' in (n.inputs || {})),
    /latent|samples/i
  );
  const dimsNode = latentNode || nodes.find((n) => /empty.*latent/i.test(n.class_type) && readDimensions(graph, n));
  const dims = (dimsNode && readDimensions(graph, dimsNode)) || imageDimensions || {};

  const loras: LoraReference[] = [];
  for (const node of nodes) extractLorasFromNode(graph, node, loras);

  // <lora:...> tags written straight into the prompt text
  if (/<(lora|lyco):/i.test(positivePrompt)) {
    const { cleanPrompt, loras: inline } = extractInlineLoras(positivePrompt);
    positivePrompt = cleanPrompt;
    for (const l of inline) pushLora(loras, l.rawName, l.strength);
  }

  if (!positivePrompt && loras.length === 0 && !sampler && !model) return null;

  const extraFields: Record<string, any> = {};
  if (guidance !== undefined) extraFields.guidance = guidance;
  if (params.scheduler) extraFields.scheduler = params.scheduler;

  return {
    prompt: positivePrompt,
    negativePrompt: negativePrompt || undefined,
    sampler: normalizeSampler(params.samplerName, params.scheduler),
    steps: params.steps,
    cfgScale,
    seed: params.seed,
    model,
    width: dims.width,
    height: dims.height,
    loras,
    detectedFormat: 'comfyui',
    extraFields,
  };
}

// Positional widget names for common node types in the editor `workflow` graph
const WIDGET_SCHEMAS: Record<string, string[]> = {
  KSampler: ['seed', 'control_after_generate', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise'],
  KSamplerAdvanced: ['add_noise', 'noise_seed', 'control_after_generate', 'steps', 'cfg', 'sampler_name', 'scheduler', 'start_at_step', 'end_at_step', 'return_with_leftover_noise'],
  SamplerCustom: ['add_noise', 'noise_seed', 'control_after_generate', 'cfg'],
  CLIPTextEncode: ['text'],
  CLIPTextEncodeSDXL: ['width', 'height', 'crop_w', 'crop_h', 'target_width', 'target_height', 'text_g', 'text_l'],
  CLIPTextEncodeSDXLRefiner: ['ascore', 'width', 'height', 'text'],
  CLIPTextEncodeFlux: ['clip_l', 't5xxl', 'guidance'],
  CheckpointLoaderSimple: ['ckpt_name'],
  UNETLoader: ['unet_name', 'weight_dtype'],
  LoraLoader: ['lora_name', 'strength_model', 'strength_clip'],
  LoraLoaderModelOnly: ['lora_name', 'strength_model'],
  EmptyLatentImage: ['width', 'height', 'batch_size'],
  EmptySD3LatentImage: ['width', 'height', 'batch_size'],
  RandomNoise: ['noise_seed', 'control_after_generate'],
  KSamplerSelect: ['sampler_name'],
  BasicScheduler: ['scheduler', 'steps', 'denoise'],
  CFGGuider: ['cfg'],
  FluxGuidance: ['guidance'],
  PrimitiveNode: ['value', 'control_after_generate'],
  PrimitiveString: ['value'],
  PrimitiveStringMultiline: ['value'],
  PrimitiveInt: ['value'],
  PrimitiveFloat: ['value'],
};

/**
 * Converts the editor `workflow` graph into API-graph shape so the same tracing
 * logic applies. Muted nodes are dropped; bypassed nodes and reroutes pass their
 * matching input straight through.
 */
export function workflowToApiGraph(wf: WorkflowGraph): ApiGraph {
  const graph: ApiGraph = {};
  if (!wf || !Array.isArray(wf.nodes)) return graph;

  const nodesById = new Map<string, WorkflowNode>();
  for (const node of wf.nodes) nodesById.set(String(node.id), node);

  const links = new Map<number, Link>();
  for (const link of wf.links || []) {
    if (Array.isArray(link)) links.set(Number(link[0]), [String(link[1]), Number(link[2])]);
    else if (link && typeof link === 'object') links.set(Number(link.id), [String(link.origin_id), Number(link.origin_slot)]);
  }

  const resolveOrigin = (linkId: number | null | undefined): Link | undefined => {
    let origin = linkId !== null && linkId !== undefined ? links.get(linkId) : undefined;
    for (let hops = 0; origin && hops < 20; hops++) {
      const source = nodesById.get(origin[0]);
      if (!source) return undefined;
      if (source.mode === 2) return undefined;
      const passThrough = source.mode === 4 || source.type === 'Reroute';
      if (!passThrough) return origin;
      const outType = source.outputs?.[origin[1]]?.type;
      const input =
        source.inputs?.find((i) => i.link !== null && i.link !== undefined && (source.type === 'Reroute' || i.type === outType)) ||
        undefined;
      origin = input ? links.get(input.link as number) : undefined;
    }
    return undefined;
  };

  for (const node of wf.nodes) {
    if (node.mode === 2 || node.mode === 4 || node.type === 'Reroute') continue;

    const inputs: Record<string, any> = {};
    const widgets = node.widgets_values;

    if (Array.isArray(widgets)) {
      const schema = WIDGET_SCHEMAS[node.type];
      let loraSlot = 0;
      widgets.forEach((value, index) => {
        if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.lora === 'string') {
          inputs[`lora_${++loraSlot}`] = value;
        } else if (schema && schema[index]) {
          inputs[schema[index]] = value;
        } else {
          inputs[`widget_${index}`] = value;
        }
      });
    } else if (widgets && typeof widgets === 'object') {
      Object.assign(inputs, widgets);
    }

    // Linked inputs (including widgets converted to inputs) override widget values
    for (const input of node.inputs || []) {
      const origin = resolveOrigin(input.link);
      if (origin) inputs[input.name] = origin;
    }

    graph[String(node.id)] = { class_type: node.type, inputs, _meta: { title: node.title } };
  }

  return graph;
}

function looksLikeApiGraph(value: unknown): value is ApiGraph {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value as object).some((n: any) => n && typeof n === 'object' && typeof n.class_type === 'string')
  );
}

function looksLikeWorkflow(value: unknown): value is WorkflowGraph {
  return Boolean(value) && typeof value === 'object' && Array.isArray((value as any).nodes);
}

/**
 * Parses ComfyUI metadata. Accepts an API graph, a workflow graph, or an object
 * holding `prompt` and/or `workflow` (as read from PNG text chunks).
 */
export function parseComfyUI(rawJson: string | object, imageDimensions?: Dimensions): ExtractedMetadata {
  let parsedObj: any = {};
  try {
    parsedObj = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
  } catch {
    return { prompt: '', loras: [], detectedFormat: 'comfyui' };
  }

  const parseMaybeJson = (v: unknown) => {
    if (typeof v !== 'string') return v;
    try {
      return JSON.parse(v);
    } catch {
      return undefined;
    }
  };

  const promptField = parseMaybeJson(parsedObj?.prompt);
  const apiGraph = looksLikeApiGraph(promptField) ? promptField : looksLikeApiGraph(parsedObj) ? parsedObj : undefined;

  const workflowCandidates = [
    parseMaybeJson(parsedObj?.workflow),
    parsedObj?.extra_pnginfo?.workflow,
    parsedObj?.extra?.workflow,
    parsedObj,
  ];
  const workflow = workflowCandidates.find(looksLikeWorkflow);

  let result = apiGraph ? parseApiGraph(apiGraph, imageDimensions) : null;

  if (workflow && (!result || !result.prompt)) {
    const workflowResult = parseApiGraph(workflowToApiGraph(workflow), imageDimensions);
    if (workflowResult) result = result ? fillMissingFields(result, workflowResult) : workflowResult;
  }

  return result || { prompt: '', loras: [], detectedFormat: 'comfyui' };
}
