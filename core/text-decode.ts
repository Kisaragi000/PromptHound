/**
 * Text decoding helpers shared by the image readers.
 */

const utf8Strict = new TextDecoder('utf-8', { fatal: true });
const latin1 = new TextDecoder('latin1');

/**
 * Decodes a PNG tEXt / zTXt body. The PNG spec says Latin-1, and Pillow (A1111, ComfyUI)
 * writes Latin-1 when the text fits, but many tools write UTF-8 there anyway. Bytes that
 * form valid UTF-8 are read as UTF-8, anything else as Latin-1.
 */
export function decodeLatin1OrUtf8(bytes: Uint8Array): string {
  try {
    return utf8Strict.decode(bytes);
  } catch {
    return latin1.decode(bytes);
  }
}

// Windows-1252 characters in 0x80–0x9F (TextDecoder's "latin1" is really windows-1252)
const CP1252_BYTES: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88,
  '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93,
  '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b,
  'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
};

/**
 * Undoes UTF-8 text that was decoded as Latin-1 / Windows-1252 ("å°å¥³" back to "少女").
 * Text is only changed when every character maps back to one byte and those bytes are
 * valid UTF-8 with at least one multi-byte character, so real Latin-1 text ("café") stays.
 */
export function repairMojibake(text: string): string;
export function repairMojibake(text: string | undefined): string | undefined;
export function repairMojibake(text: string | undefined): string | undefined {
  if (!text || !/[\u0080-￿]/.test(text)) return text;
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const byte = code <= 0xff ? code : CP1252_BYTES[text[i]];
    if (byte === undefined) return text;
    bytes[i] = byte;
  }
  try {
    return utf8Strict.decode(bytes);
  } catch {
    return text;
  }
}

/**
 * JSON.parse that also accepts the bare NaN / Infinity / -Infinity that Python's
 * json.dumps writes (ComfyUI graphs carry them, e.g. "denoise": NaN). They become null.
 */
export function parseJsonLenient(text: string): any {
  try {
    return JSON.parse(text);
  } catch (err) {
    if (!/NaN|Infinity/.test(text)) throw err;
  }
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === '\\') out += text[++i] ?? '';
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
    } else if (text.startsWith('NaN', i)) {
      out += 'null';
      i += 2;
    } else if (text.startsWith('-Infinity', i)) {
      out += 'null';
      i += 8;
    } else if (text.startsWith('Infinity', i)) {
      out += 'null';
      i += 7;
    } else {
      out += ch;
    }
  }
  return JSON.parse(out);
}
