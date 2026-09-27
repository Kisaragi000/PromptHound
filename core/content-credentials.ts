/**
 * Content Credentials (C2PA) and IPTC "digital source type" labels.
 *
 * ChatGPT / OpenAI, Google Gemini, Adobe Firefly, Microsoft and others do not store
 * the prompt in their images, but they do label them: a signed C2PA manifest (JUMBF
 * boxes in a PNG caBX chunk, JPEG APP11 segments or a WebP C2PA chunk) and/or an XMP
 * DigitalSourceType of "trainedAlgorithmicMedia". This module reads those labels so
 * PromptHound can say "AI-generated, made with X" instead of "no metadata".
 *
 * The signature is not verified (that needs the C2PA trust list); the label is shown
 * as what the file claims, which is how C2PA viewers describe unverified manifests.
 */

export interface ContentCredentials {
  /** The image is labeled as generated (or partly generated) by an AI model */
  aiGenerated: boolean;
  /** Friendly name of the service, e.g. "ChatGPT (OpenAI)", "Google Gemini" */
  product?: string;
  /** Tool that made the image as written in the label, e.g. "GPT-4o", "DALL·E" */
  softwareAgent?: string;
  /** Application that wrote the credentials, e.g. "ChatGPT", "Google C2PA Core Generator Library" */
  claimGenerator?: string;
  /** Organization named in the signing certificate, e.g. "OpenAI", "Google LLC" */
  signedBy?: string;
  /** When the image was created, if the label says (ISO 8601) */
  created?: string;
  /** IPTC digital source type, e.g. "trainedAlgorithmicMedia" */
  digitalSourceType?: string;
  /** Actions recorded in the label, e.g. ["c2pa.created", "c2pa.converted"] */
  actions: string[];
  /** Where the label was found */
  source: 'c2pa' | 'xmp';
}

// ---------------------------------------------------------------------------
// Minimal CBOR decoder (RFC 8949): enough for C2PA claims, assertions and COSE
// ---------------------------------------------------------------------------

class CborReader {
  private pos = 0;
  constructor(private readonly data: Uint8Array) {}

  private byte(): number {
    if (this.pos >= this.data.length) throw new Error('CBOR: unexpected end');
    return this.data[this.pos++];
  }

  private length(info: number): number {
    if (info < 24) return info;
    if (info === 24) return this.byte();
    if (info === 25) return (this.byte() << 8) | this.byte();
    if (info === 26) return ((this.byte() << 24) >>> 0) + (this.byte() << 16) + (this.byte() << 8) + this.byte();
    if (info === 27) {
      let value = 0;
      for (let i = 0; i < 8; i++) value = value * 256 + this.byte();
      return value;
    }
    if (info === 31) return -1; // indefinite
    throw new Error('CBOR: bad length');
  }

  private bytes(n: number): Uint8Array {
    if (this.pos + n > this.data.length) throw new Error('CBOR: unexpected end');
    const out = this.data.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }

  read(depth = 0): unknown {
    if (depth > 64) throw new Error('CBOR: too deep');
    const initial = this.byte();
    const major = initial >> 5;
    const info = initial & 0x1f;

    switch (major) {
      case 0:
        return this.length(info);
      case 1:
        return -1 - this.length(info);
      case 2:
      case 3: {
        const len = this.length(info);
        let raw: Uint8Array;
        if (len === -1) {
          const parts: Uint8Array[] = [];
          while (this.data[this.pos] !== 0xff) parts.push(this.read(depth + 1) as Uint8Array);
          this.pos++;
          raw = concat(parts.map((p) => (typeof p === 'string' ? new TextEncoder().encode(p) : p)));
        } else {
          raw = this.bytes(len);
        }
        return major === 2 ? raw : new TextDecoder().decode(raw);
      }
      case 4: {
        const len = this.length(info);
        const items: unknown[] = [];
        if (len === -1) {
          while (this.data[this.pos] !== 0xff) items.push(this.read(depth + 1));
          this.pos++;
        } else {
          for (let i = 0; i < len; i++) items.push(this.read(depth + 1));
        }
        return items;
      }
      case 5: {
        const len = this.length(info);
        const map = new Map<unknown, unknown>();
        const readPair = () => {
          const key = this.read(depth + 1);
          map.set(key, this.read(depth + 1));
        };
        if (len === -1) {
          while (this.data[this.pos] !== 0xff) readPair();
          this.pos++;
        } else {
          for (let i = 0; i < len; i++) readPair();
        }
        return map;
      }
      case 6:
        this.length(info); // tag number: the tagged value is returned as is
        return this.read(depth + 1);
      default: {
        if (info === 20) return false;
        if (info === 21) return true;
        if (info === 22 || info === 23) return null;
        if (info === 25) {
          this.bytes(2);
          return 0;
        }
        if (info === 26) return new DataView(this.bytes(4).slice().buffer).getFloat32(0);
        if (info === 27) return new DataView(this.bytes(8).slice().buffer).getFloat64(0);
        return null;
      }
    }
  }
}

function decodeCbor(data: Uint8Array): unknown {
  try {
    return new CborReader(data).read();
  } catch {
    return undefined;
  }
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** Map or plain-object field access for decoded CBOR */
function field(obj: unknown, key: string | number): unknown {
  if (obj instanceof Map) return obj.get(key);
  if (obj && typeof obj === 'object') return (obj as Record<string, unknown>)[key as string];
  return undefined;
}

const asString = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

// ---------------------------------------------------------------------------
// Locating the C2PA manifest store in PNG / JPEG / WebP
// ---------------------------------------------------------------------------

const ascii = (data: Uint8Array, start: number, len: number) =>
  String.fromCharCode(...data.subarray(start, start + len));

const u32 = (d: Uint8Array, o: number) => ((d[o] << 24) >>> 0) + (d[o + 1] << 16) + (d[o + 2] << 8) + d[o + 3];

function findJumbfInPng(data: Uint8Array): Uint8Array | undefined {
  let offset = 8;
  while (offset + 12 <= data.length) {
    const length = u32(data, offset);
    const type = ascii(data, offset + 4, 4);
    if (type === 'caBX') return data.subarray(offset + 8, offset + 8 + length);
    if (type === 'IEND') break;
    offset += 12 + length;
  }
  return undefined;
}

function findJumbfInJpeg(data: Uint8Array): Uint8Array | undefined {
  // APP11 segments: "JP" common id, box instance (2), sequence (4), then the JUMBF
  // box; continuation segments repeat the 8-byte box header, which is skipped.
  const instances = new Map<number, Array<{ seq: number; payload: Uint8Array }>>();
  let offset = 2;
  while (offset + 4 <= data.length && data[offset] === 0xff) {
    const marker = data[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = (data[offset + 2] << 8) | data[offset + 3];
    if (marker === 0xeb && length > 16 && data[offset + 4] === 0x4a && data[offset + 5] === 0x50) {
      const instance = (data[offset + 6] << 8) | data[offset + 7];
      const seq = u32(data, offset + 8);
      const payload = data.subarray(offset + 12, offset + 2 + length);
      const list = instances.get(instance) ?? [];
      list.push({ seq, payload });
      instances.set(instance, list);
    }
    offset += 2 + length;
  }
  for (const segments of instances.values()) {
    segments.sort((a, b) => a.seq - b.seq);
    const box = concat(segments.map((s, i) => (i === 0 ? s.payload : s.payload.subarray(8))));
    if (box.length >= 8 && ascii(box, 4, 4) === 'jumb') return box;
  }
  return undefined;
}

function findJumbfInWebp(data: Uint8Array): Uint8Array | undefined {
  if (ascii(data, 0, 4) !== 'RIFF' || ascii(data, 8, 4) !== 'WEBP') return undefined;
  let offset = 12;
  while (offset + 8 <= data.length) {
    const type = ascii(data, offset, 4);
    const size = data[offset + 4] | (data[offset + 5] << 8) | (data[offset + 6] << 16) | ((data[offset + 7] << 24) >>> 0);
    if (type === 'C2PA') return data.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  return undefined;
}

function findJumbf(data: Uint8Array): Uint8Array | undefined {
  if (data[0] === 0x89 && data[1] === 0x50) return findJumbfInPng(data);
  if (data[0] === 0xff && data[1] === 0xd8) return findJumbfInJpeg(data);
  if (ascii(data, 0, 4) === 'RIFF') return findJumbfInWebp(data);
  return undefined;
}

// ---------------------------------------------------------------------------
// JUMBF boxes
// ---------------------------------------------------------------------------

interface JumbfBox {
  type: string;
  label?: string;
  /** Content of a leaf box (cbor, json, ...) */
  payload?: Uint8Array;
  children: JumbfBox[];
}

function parseBoxes(data: Uint8Array, depth = 0): JumbfBox[] {
  const boxes: JumbfBox[] = [];
  let offset = 0;
  while (offset + 8 <= data.length && depth < 16) {
    let size = u32(data, offset);
    const type = ascii(data, offset + 4, 4);
    let header = 8;
    if (size === 1) {
      size = u32(data, offset + 8) * 2 ** 32 + u32(data, offset + 12);
      header = 16;
    } else if (size === 0) {
      size = data.length - offset;
    }
    if (size < header || offset + size > data.length) break;
    const content = data.subarray(offset + header, offset + size);

    if (type === 'jumb') {
      const inner = parseBoxes(content, depth + 1);
      const description = inner[0]?.type === 'jumd' ? inner.shift() : undefined;
      boxes.push({ type, label: description?.label, children: inner });
    } else if (type === 'jumd') {
      // 16-byte content type UUID, toggles byte, then a NUL-terminated label if bit 1 is set
      let label: string | undefined;
      if (content.length > 17 && content[16] & 0x02) {
        const end = content.indexOf(0, 17);
        label = new TextDecoder().decode(content.subarray(17, end === -1 ? content.length : end));
      }
      boxes.push({ type, label, children: [] });
    } else {
      boxes.push({ type, payload: content, children: [] });
    }
    offset += size;
  }
  return boxes;
}

const child = (box: JumbfBox | undefined, label: RegExp) => box?.children.find((c) => c.label && label.test(c.label));
const leafData = (box: JumbfBox | undefined, type: string) => box?.children.find((c) => c.type === type)?.payload;

// ---------------------------------------------------------------------------
// Certificates: organization / common name of the signer
// ---------------------------------------------------------------------------

/**
 * Subject organization (or common name) of an X.509 certificate. The issuer name comes
 * before the subject in the DER, so the last occurrence of each attribute is the subject's.
 */
function certificateSubject(der: Uint8Array): string | undefined {
  const find = (oidLast: number) => {
    let found: string | undefined;
    for (let i = 0; i + 7 < der.length; i++) {
      // OID 2.5.4.x: 06 03 55 04 xx, then a string (UTF8 0c, Printable 13, IA5 16, T61 14, BMP 1e)
      if (der[i] === 0x06 && der[i + 1] === 0x03 && der[i + 2] === 0x55 && der[i + 3] === 0x04 && der[i + 4] === oidLast) {
        const tag = der[i + 5];
        const len = der[i + 6];
        if ([0x0c, 0x13, 0x16, 0x14].includes(tag) && len < 128) {
          found = new TextDecoder().decode(der.subarray(i + 7, i + 7 + len));
        }
      }
    }
    return found;
  };
  return find(0x0a) ?? find(0x03);
}

function signerFromSignature(signatureBox: JumbfBox | undefined): string | undefined {
  const cose = decodeCbor(leafData(signatureBox, 'cbor') ?? new Uint8Array());
  if (!Array.isArray(cose)) return undefined;
  const headers = [decodeCbor(cose[0] instanceof Uint8Array ? cose[0] : new Uint8Array()), cose[1]];
  for (const header of headers) {
    const chain = field(header, 33) ?? field(header, 'x5chain');
    const leaf = Array.isArray(chain) ? chain[0] : chain;
    if (leaf instanceof Uint8Array) return certificateSubject(leaf);
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Interpreting the active manifest
// ---------------------------------------------------------------------------

// IPTC digital source types for media made (or partly made) by a trained model.
// Plain "algorithmicMedia" (procedural, no model) and "digitalCapture" are not AI.
const AI_SOURCE_TYPES = /(trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia)$/i;

function agentName(agent: unknown): string | undefined {
  if (typeof agent === 'string') return asString(agent);
  const name = asString(field(agent, 'name'));
  const version = asString(field(agent, 'version'));
  return name ? (version && !name.includes(version) ? `${name} ${version}` : name) : undefined;
}

/** Friendly service name from anything the label says about who made the image */
export function productName(...hints: Array<string | undefined>): string | undefined {
  const text = hints.filter(Boolean).join(' ');
  if (/chatgpt|openai|dall[·.\-\s]?e|gpt[-\s]?(4o|image|5)|sora/i.test(text)) return 'ChatGPT (OpenAI)';
  if (/gemini|imagen|nano banana|google/i.test(text)) return 'Google Gemini';
  if (/firefly|adobe/i.test(text)) return 'Adobe Firefly';
  if (/microsoft|bing|designer|copilot|azure/i.test(text)) return 'Microsoft Copilot / Designer';
  if (/meta ai|\bmeta\b|facebook|instagram/i.test(text)) return 'Meta AI';
  if (/midjourney/i.test(text)) return 'Midjourney';
  if (/stability|stable diffusion/i.test(text)) return 'Stability AI';
  if (/runway/i.test(text)) return 'Runway';
  if (/leonardo/i.test(text)) return 'Leonardo.Ai';
  if (/ideogram/i.test(text)) return 'Ideogram';
  if (/grok|xai\b|x\.ai/i.test(text)) return 'Grok (xAI)';
  return undefined;
}

function readManifestStore(jumbf: Uint8Array): ContentCredentials | undefined {
  const store = parseBoxes(jumbf).find((b) => b.type === 'jumb' && b.label === 'c2pa');
  // The active manifest is the last one in the store
  const manifest = store?.children.filter((c) => c.type === 'jumb').pop();
  if (!manifest) return undefined;

  const claimBox = child(manifest, /^c2pa\.claim(\.v\d+)?$/);
  const claim = decodeCbor(leafData(claimBox, 'cbor') ?? new Uint8Array());
  const generatorInfo = field(claim, 'claim_generator_info');
  const claimGenerator =
    agentName(Array.isArray(generatorInfo) ? generatorInfo[0] : generatorInfo) ??
    asString(field(claim, 'claim_generator'))?.split(/\s+/)[0]?.replace(/[_/]/g, ' ');

  const assertions = child(manifest, /^c2pa\.assertions$/);
  const actions: string[] = [];
  let softwareAgent: string | undefined;
  let digitalSourceType: string | undefined;
  let created: string | undefined;
  for (const box of assertions?.children.filter((c) => c.label && /^c2pa\.actions(\.v\d+)?(__\d+)?$/.test(c.label)) ?? []) {
    const list = field(decodeCbor(leafData(box, 'cbor') ?? new Uint8Array()), 'actions');
    if (!Array.isArray(list)) continue;
    for (const action of list) {
      const name = asString(field(action, 'action'));
      if (name) actions.push(name);
      const source = asString(field(action, 'digitalSourceType'));
      if (source && (!digitalSourceType || AI_SOURCE_TYPES.test(source))) digitalSourceType = source;
      if (name === 'c2pa.created' || !softwareAgent) softwareAgent = agentName(field(action, 'softwareAgent')) ?? softwareAgent;
      if (name === 'c2pa.created') created = asString(field(action, 'when')) ?? created;
    }
  }

  const signedBy = signerFromSignature(child(manifest, /^c2pa\.signature$/));
  const title = asString(field(claim, 'dc:title'));
  const aiGenerated = Boolean(digitalSourceType && AI_SOURCE_TYPES.test(digitalSourceType));

  return {
    aiGenerated,
    // A brand only for AI labels: an Adobe-signed Photoshop edit is not "Adobe Firefly"
    product: aiGenerated ? productName(softwareAgent, claimGenerator, signedBy, title) : undefined,
    softwareAgent,
    claimGenerator,
    signedBy,
    created,
    digitalSourceType: digitalSourceType?.split('/').pop(),
    actions: [...new Set(actions)],
    source: 'c2pa',
  };
}

/** XMP / IPTC label without C2PA (e.g. some Google and Meta images, or a stripped manifest) */
function readXmpLabel(data: Uint8Array): ContentCredentials | undefined {
  // Only look where XMP lives: the first MB is plenty for image headers
  const text = new TextDecoder('latin1').decode(data.subarray(0, Math.min(data.length, 1 << 20)));
  const sourceMatch = text.match(/DigitalSourceType[^>]*?(?:>|=["'])\s*(?:https?:\/\/cv\.iptc\.org\/newscodes\/digitalsourcetype\/)?(\w+)/i);
  const madeWith = text.match(/Made with ([A-Za-z][\w .-]{1,40}?AI)\b/);
  if (!madeWith && !(sourceMatch && AI_SOURCE_TYPES.test(sourceMatch[1]))) return undefined;
  const agent = text.match(/<(?:xmp:CreatorTool|photoshop:Credit|Iptc4xmpExt:AISystemUsed)>([^<]{1,80})</)?.[1];
  return {
    aiGenerated: true,
    product: productName(agent, madeWith?.[0]),
    softwareAgent: asString(agent),
    digitalSourceType: sourceMatch?.[1],
    actions: [],
    source: 'xmp',
  };
}

/** Reads a C2PA / IPTC provenance label from an image, if it has one. */
export function readContentCredentials(data: Uint8Array): ContentCredentials | null {
  try {
    const jumbf = findJumbf(data);
    const c2pa = jumbf ? readManifestStore(jumbf) : undefined;
    const xmp = readXmpLabel(data);
    if (c2pa) {
      // XMP can confirm AI origin when the manifest does not say so itself
      if (!c2pa.aiGenerated && xmp?.aiGenerated) {
        return { ...c2pa, aiGenerated: true, digitalSourceType: c2pa.digitalSourceType ?? xmp.digitalSourceType, product: c2pa.product ?? xmp.product };
      }
      return c2pa;
    }
    return xmp ?? null;
  } catch {
    return null;
  }
}
