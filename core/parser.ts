import { ExtractedMetadata } from './types.js';
import { parseA1111 } from './parsers/a1111.js';

/**
 * Parses Automatic1111 / WebUI parameter string.
 * Maintained for backwards-compatibility.
 */
export function parseA1111Parameters(raw: string, _imageUrl?: string): ExtractedMetadata {
  return parseA1111(raw);
}
