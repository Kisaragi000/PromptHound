import type { ExtractedMetadata, LoraReference } from '../types.js';

interface ComfyPromptNode {
  class_type: string;
  inputs: Record<string, any>;
  _meta?: { title?: string };
}

interface ComfyWorkflowNode {
  id: number | string;
  type: string;
  widgets_values?: any[];
  inputs?: any[];
  title?: string;
}

type ComfyPromptGraph = Record<string, ComfyPromptNode>;

interface ComfyWorkflowGraph {
  nodes?: ComfyWorkflowNode[];
  extra?: Record<string, any>;
}

/**
 * Normalizes ComfyUI sampler + scheduler names into conventional notation.
 * e.g. sampler: 'euler_ancestral', scheduler: 'karras' -> 'Euler a Karras'
 */
function normalizeSampler(samplerName?: string, scheduler?: string): string | undefined {
  if (!samplerName) return undefined;
  const formattedSampler = samplerName
    .replace(/_ancestral$/i, ' a')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  if (scheduler && scheduler.toLowerCase() !== 'normal') {
    const formattedScheduler = scheduler.charAt(0).toUpperCase() + scheduler.slice(1);
    return `${formattedSampler} ${formattedScheduler}`;
  }

  return formattedSampler;
}

/**
 * Traces text from a CLIPTextEncode node or chained conditioning nodes.
 */
function traceConditioningText(graph: ComfyPromptGraph, targetRef: any): string {
  if (!targetRef) return '';

  const nodeId = Array.isArray(targetRef) ? String(targetRef[0]) : String(targetRef);
  const node = graph[nodeId];
  if (!node) return '';

  const classType = node.class_type || '';

  if (
    classType.includes('CLIPTextEncode') ||
    classType === 'ShowText' ||
    classType === 'StringLiteral' ||
    classType === 'PrimitiveNode'
  ) {
    const text =
      node.inputs?.text ||
      node.inputs?.text_g ||
      node.inputs?.text_l ||
      node.inputs?.string ||
      node.inputs?.value ||
      '';
    if (typeof text === 'string') return text.trim();
  }

  if (classType.includes('SDXLPromptStyler')) {
    const text = node.inputs?.text_positive || node.inputs?.text_negative || node.inputs?.text || '';
    if (typeof text === 'string') return text.trim();
  }

  // Chained node (e.g. ConditioningCombine, ConditioningAverage)
  if (node.inputs?.conditioning_1) {
    const text1 = traceConditioningText(graph, node.inputs.conditioning_1);
    const text2 = traceConditioningText(graph, node.inputs.conditioning_2);
    return [text1, text2].filter(Boolean).join(', ');
  }

  return '';
}

/**
 * Extracts LoRAs from custom ComfyUI nodes (rgthree, CR, Efficiency, PySSSSS, EasyUse).
 */
function extractLorasFromPromptNode(node: ComfyPromptNode, loras: LoraReference[]): void {
  const classType = node.class_type || '';
  const inputs = node.inputs || {};

  // Standard LoraLoader / LoraLoaderModelOnly / LoraLoader|pysssss
  if (
    classType === 'LoraLoader' ||
    classType === 'LoraLoaderModelOnly' ||
    classType === 'LoraLoader|pysssss' ||
    classType === 'LoraLoaderWithWeights'
  ) {
    const rawName = inputs.lora_name;
    if (rawName && typeof rawName === 'string') {
      const strength =
        typeof inputs.strength_model === 'number'
          ? inputs.strength_model
          : typeof inputs.strength === 'number'
            ? inputs.strength
            : 1.0;
      loras.push({
        rawName: rawName.replace(/\.(safetensors|pt|ckpt)$/i, ''),
        strength,
      });
    }
  }

  // CR Apply LoRA Stack / CR LoRA Stack
  if (classType.includes('CR LoRA Stack') || classType.includes('CR Apply LoRA Stack')) {
    for (let i = 1; i <= 10; i++) {
      const name = inputs[`lora_name_${i}`] || inputs[`lora_name${i}`];
      const wt = inputs[`lora_wt_${i}`] ?? inputs[`lora_weight_${i}`] ?? 1.0;
      const switchVal = inputs[`switch_${i}`] ?? inputs[`switch${i}`];

      if (name && typeof name === 'string' && name !== 'None' && switchVal !== 'Off') {
        loras.push({
          rawName: name.replace(/\.(safetensors|pt|ckpt)$/i, ''),
          strength: typeof wt === 'number' ? wt : 1.0,
        });
      }
    }
  }

  // rgthree Power Lora Loader
  if (classType.includes('Power Lora Loader')) {
    for (const [key, val] of Object.entries(inputs)) {
      if (val && typeof val === 'object' && val.lora && val.on !== false) {
        loras.push({
          rawName: String(val.lora).replace(/\.(safetensors|pt|ckpt)$/i, ''),
          strength: typeof val.strength === 'number' ? val.strength : 1.0,
        });
      } else if (key.startsWith('lora_') && typeof val === 'string' && val !== 'None') {
        loras.push({
          rawName: val.replace(/\.(safetensors|pt|ckpt)$/i, ''),
          strength: 1.0,
        });
      }
    }
  }

  // Efficiency Nodes: LoRA Stacker / Efficient Loader
  if (classType.includes('LoRA Stacker') || classType.includes('Efficient Loader')) {
    for (let i = 1; i <= 10; i++) {
      const name = inputs[`lora_name_${i}`] || inputs[`lora_name${i}`];
      const modelWt = inputs[`lora_model_strength_${i}`] ?? inputs[`lora_wt_${i}`];
      if (name && typeof name === 'string' && name !== 'None') {
        loras.push({
          rawName: name.replace(/\.(safetensors|pt|ckpt)$/i, ''),
          strength: typeof modelWt === 'number' ? modelWt : 1.0,
        });
      }
    }
  }

  // Easy-Use easy loraStack
  if (classType.includes('easy loraStack') || classType.includes('easy a1111Loader')) {
    for (let i = 1; i <= 10; i++) {
      const name = inputs[`lora_name_${i}`];
      const wt = inputs[`lora_weight_${i}`];
      if (name && typeof name === 'string' && name !== 'None') {
        loras.push({
          rawName: name.replace(/\.(safetensors|pt|ckpt)$/i, ''),
          strength: typeof wt === 'number' ? wt : 1.0,
        });
      }
    }
  }
}

/**
 * Extracts metadata from the visual UI `workflow` graph (which stores values in `widgets_values`).
 */
function parseComfyWorkflowGraph(
  wf: ComfyWorkflowGraph,
  imageDimensions?: { width?: number; height?: number }
): ExtractedMetadata | null {
  if (!wf || !Array.isArray(wf.nodes) || wf.nodes.length === 0) {
    return null;
  }

  const nodes = wf.nodes;
  let positivePrompt = '';
  let negativePrompt = '';
  let sampler: string | undefined;
  let steps: number | undefined;
  let cfgScale: number | undefined;
  let seed: string | undefined;
  let model: string | undefined;
  let width = imageDimensions?.width;
  let height = imageDimensions?.height;
  const loras: LoraReference[] = [];

  for (const node of nodes) {
    const type = node.type || '';
    const widgets = Array.isArray(node.widgets_values) ? node.widgets_values : [];

    // KSampler
    if (type === 'KSampler' || type === 'KSamplerAdvanced' || type.includes('Sampler')) {
      if (widgets.length >= 5) {
        if (typeof widgets[0] === 'number') seed = String(widgets[0]);
        if (typeof widgets[2] === 'number') steps = widgets[2];
        if (typeof widgets[3] === 'number') cfgScale = widgets[3];
        const samplerName = typeof widgets[4] === 'string' ? widgets[4] : undefined;
        const scheduler = typeof widgets[5] === 'string' ? widgets[5] : undefined;
        sampler = normalizeSampler(samplerName, scheduler);
      }
    }

    // CLIP Text Encode
    if (type === 'CLIPTextEncode' || type === 'CLIPTextEncodeSDXL') {
      const text = typeof widgets[0] === 'string' ? widgets[0].trim() : '';
      if (text) {
        const title = (node.title || '').toLowerCase();
        if (title.includes('neg') || (!positivePrompt && negativePrompt)) {
          negativePrompt = text;
        } else if (!positivePrompt) {
          positivePrompt = text;
        } else if (!negativePrompt) {
          negativePrompt = text;
        }
      }
    }

    // Checkpoint Loader
    if (type === 'CheckpointLoaderSimple' || type === 'CheckpointLoader') {
      if (typeof widgets[0] === 'string') {
        model = widgets[0];
      }
    }

    // Standard LoRA Loader
    if (type === 'LoraLoader' || type === 'LoraLoaderModelOnly' || type.includes('LoraLoader')) {
      const rawName = typeof widgets[0] === 'string' ? widgets[0] : undefined;
      const strength = typeof widgets[1] === 'number' ? widgets[1] : 1.0;
      if (rawName && rawName !== 'None') {
        loras.push({
          rawName: rawName.replace(/\.(safetensors|pt|ckpt)$/i, ''),
          strength,
        });
      }
    }

    // rgthree Power Lora Loader in workflow
    if (type.includes('Power Lora Loader') && Array.isArray(widgets)) {
      for (let idx = 0; idx < widgets.length; idx++) {
        const item = widgets[idx];
        if (typeof item === 'string' && /\.(safetensors|pt|ckpt)$/i.test(item)) {
          const strength = typeof widgets[idx + 1] === 'number' ? widgets[idx + 1] : 1.0;
          loras.push({
            rawName: item.replace(/\.(safetensors|pt|ckpt)$/i, ''),
            strength,
          });
        }
      }
    }

    // Empty Latent Image
    if (type === 'EmptyLatentImage' || type === 'EmptySD3LatentImage') {
      if (typeof widgets[0] === 'number') width = widgets[0];
      if (typeof widgets[1] === 'number') height = widgets[1];
    }
  }

  if (!positivePrompt && loras.length === 0 && !sampler && !model) {
    return null;
  }

  return {
    prompt: positivePrompt,
    negativePrompt: negativePrompt || undefined,
    sampler,
    steps,
    cfgScale,
    seed,
    model,
    width,
    height,
    loras,
    detectedFormat: 'comfyui',
  };
}

/**
 * Parses ComfyUI execution graph (`prompt` chunk) and fallback UI graph (`workflow` chunk).
 */
export function parseComfyUI(
  rawJson: string | object,
  imageDimensions?: { width?: number; height?: number }
): ExtractedMetadata {
  let parsedObj: any = {};

  try {
    parsedObj = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
  } catch {
    return {
      prompt: '',
      loras: [],
      detectedFormat: 'comfyui',
    };
  }

  // Check if this is a visual workflow graph
  if (parsedObj.nodes && Array.isArray(parsedObj.nodes)) {
    const wfResult = parseComfyWorkflowGraph(parsedObj as ComfyWorkflowGraph, imageDimensions);
    if (wfResult) return wfResult;
  }

  const promptGraph: ComfyPromptGraph = parsedObj.prompt || parsedObj;
  const nodes = Object.values(promptGraph).filter(
    (n): n is ComfyPromptNode => Boolean(n && typeof n === 'object' && n.class_type)
  );

  // 1. Locate primary KSampler / KSamplerAdvanced node
  const ksampler = nodes.find(
    (n) =>
      n.class_type === 'KSampler' ||
      n.class_type === 'KSamplerAdvanced' ||
      n.class_type?.includes('Sampler')
  );

  let seed: string | undefined;
  let steps: number | undefined;
  let cfgScale: number | undefined;
  let sampler: string | undefined;
  let positivePrompt = '';
  let negativePrompt = '';

  if (ksampler && ksampler.inputs) {
    const rawSeed = ksampler.inputs.seed ?? ksampler.inputs.noise_seed;
    seed = rawSeed !== undefined ? String(rawSeed) : undefined;
    steps = typeof ksampler.inputs.steps === 'number' ? ksampler.inputs.steps : undefined;
    cfgScale = typeof ksampler.inputs.cfg === 'number' ? ksampler.inputs.cfg : undefined;

    sampler = normalizeSampler(ksampler.inputs.sampler_name, ksampler.inputs.scheduler);

    if (ksampler.inputs.positive) {
      positivePrompt = traceConditioningText(promptGraph, ksampler.inputs.positive);
    }
    if (ksampler.inputs.negative) {
      negativePrompt = traceConditioningText(promptGraph, ksampler.inputs.negative);
    }
  }

  // Fallback text search if KSampler links couldn't be resolved
  if (!positivePrompt) {
    const clipNodes = nodes.filter(
      (n) =>
        n.class_type.includes('CLIPTextEncode') ||
        n.class_type === 'ShowText' ||
        n.class_type === 'StringLiteral'
    );
    if (clipNodes.length > 0 && typeof clipNodes[0].inputs?.text === 'string') {
      positivePrompt = clipNodes[0].inputs.text;
    }
    if (clipNodes.length > 1 && typeof clipNodes[1].inputs?.text === 'string') {
      negativePrompt = clipNodes[1].inputs.text;
    }
  }

  // 2. Locate CheckpointLoader
  let model: string | undefined;
  const ckptNode = nodes.find(
    (n) =>
      n.class_type === 'CheckpointLoaderSimple' ||
      n.class_type === 'CheckpointLoader' ||
      n.class_type === 'UNETLoader'
  );
  if (ckptNode && ckptNode.inputs) {
    model = ckptNode.inputs.ckpt_name || ckptNode.inputs.unet_name;
  }

  // 3. Locate LoRAs across all custom and standard nodes
  const loras: LoraReference[] = [];
  for (const node of nodes) {
    extractLorasFromPromptNode(node, loras);
  }

  // 4. Locate Dimensions
  let width = imageDimensions?.width;
  let height = imageDimensions?.height;

  const latentNode = nodes.find(
    (n) => n.class_type === 'EmptyLatentImage' || n.class_type === 'EmptySD3LatentImage'
  );
  if (latentNode && latentNode.inputs) {
    if (typeof latentNode.inputs.width === 'number') width = latentNode.inputs.width;
    if (typeof latentNode.inputs.height === 'number') height = latentNode.inputs.height;
  }

  // Fallback to workflow graph if prompt was empty
  if (!positivePrompt && loras.length === 0 && parsedObj.extra?.workflow) {
    const wfResult = parseComfyWorkflowGraph(parsedObj.extra.workflow, imageDimensions);
    if (wfResult) return wfResult;
  }

  return {
    prompt: positivePrompt,
    negativePrompt: negativePrompt || undefined,
    sampler,
    steps,
    cfgScale,
    seed,
    model,
    width,
    height,
    loras,
    detectedFormat: 'comfyui',
  };
}
