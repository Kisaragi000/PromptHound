import { unzlibSync, inflateSync } from 'fflate';
import { decodeLatin1OrUtf8 } from './text-decode.js';
import { readExifTextFromPayload } from './exif.js';

export interface PngTextChunk {
  keyword: string;
  text: string;
  type: 'tEXt' | 'zTXt' | 'iTXt';
}

export interface PngParseResult {
  width?: number;
  height?: number;
  textChunks: Record<string, string>;
  allChunks: PngTextChunk[];
  /** Text tags of an eXIf chunk (EXIF UserComment etc.), as some tools write them */
  exifTexts: string[];
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/**
 * Universal safe decompressor for zlib/deflate streams in both Node and Browser.
 */
function decompressZlib(data: Uint8Array): Uint8Array {
  try {
    return unzlibSync(data);
  } catch {
    return inflateSync(data);
  }
}

/**
 * Checks if the buffer starts with the standard PNG 8-byte signature.
 */
export function isPng(buffer: Uint8Array | Buffer): boolean {
  if (buffer.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== PNG_SIGNATURE[i]) return false;
  }
  return true;
}

/**
 * Dependency-free PNG chunk reader handling tEXt, zTXt (compressed), iTXt (UTF-8) and eXIf.
 * Isomorphic and safe across both Node and browser runtimes.
 */
export function readPngChunks(buffer: Uint8Array | Buffer): PngParseResult {
  const result: PngParseResult = {
    textChunks: {},
    allChunks: [],
    exifTexts: [],
  };

  if (!isPng(buffer)) {
    return result;
  }

  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength
  );

  let offset = 8;
  const totalLength = buffer.length;

  while (offset + 8 <= totalLength) {
    const length = view.getUint32(offset, false);
    offset += 4;

    const typeBytes = buffer.subarray(offset, offset + 4);
    const type = String.fromCharCode(...typeBytes);
    offset += 4;

    if (offset + length > totalLength) {
      break;
    }

    const chunkData = buffer.subarray(offset, offset + length);
    // Skip data and 4 bytes of CRC
    offset += length + 4;

    if (type === 'IHDR' && length >= 8) {
      const ihdrView = new DataView(
        chunkData.buffer,
        chunkData.byteOffset,
        chunkData.byteLength
      );
      result.width = ihdrView.getUint32(0, false);
      result.height = ihdrView.getUint32(4, false);
    } else if (type === 'tEXt') {
      const nullIdx = chunkData.indexOf(0);
      if (nullIdx !== -1) {
        const keyword = new TextDecoder('latin1').decode(chunkData.subarray(0, nullIdx));
        const text = decodeLatin1OrUtf8(chunkData.subarray(nullIdx + 1));
        result.textChunks[keyword] = text;
        result.allChunks.push({ keyword, text, type: 'tEXt' });
      }
    } else if (type === 'zTXt') {
      const nullIdx = chunkData.indexOf(0);
      if (nullIdx !== -1 && nullIdx + 2 <= chunkData.length) {
        const keyword = new TextDecoder('latin1').decode(chunkData.subarray(0, nullIdx));
        const compressedData = chunkData.subarray(nullIdx + 2);
        try {
          const decompressed = decompressZlib(compressedData);
          const text = decodeLatin1OrUtf8(decompressed);
          result.textChunks[keyword] = text;
          result.allChunks.push({ keyword, text, type: 'zTXt' });
        } catch {
          // Ignore decompression failure on corrupted chunks
        }
      }
    } else if (type === 'iTXt') {
      let cur = 0;
      while (cur < chunkData.length && chunkData[cur] !== 0) cur++;
      if (cur < chunkData.length) {
        const keyword = new TextDecoder('utf-8').decode(chunkData.subarray(0, cur));
        cur++; // skip null
        if (cur + 2 <= chunkData.length) {
          const compressionFlag = chunkData[cur++];
          cur++; // skip compression method

          // skip language tag (null-terminated)
          while (cur < chunkData.length && chunkData[cur] !== 0) cur++;
          cur++;

          // skip translated keyword (null-terminated)
          while (cur < chunkData.length && chunkData[cur] !== 0) cur++;
          cur++;

          if (cur <= chunkData.length) {
            const rawBody = chunkData.subarray(cur);
            let text = '';
            if (compressionFlag === 1) {
              try {
                const decompressed = decompressZlib(rawBody);
                text = new TextDecoder('utf-8').decode(decompressed);
              } catch {
                // Ignore failure
              }
            } else {
              text = new TextDecoder('utf-8').decode(rawBody);
            }

            if (text) {
              result.textChunks[keyword] = text;
              result.allChunks.push({ keyword, text, type: 'iTXt' });
            }
          }
        }
      }
    } else if (type === 'eXIf') {
      try {
        result.exifTexts.push(...readExifTextFromPayload(chunkData));
      } catch {
        // Ignore malformed EXIF
      }
    } else if (type === 'IEND') {
      break;
    }
  }

  return result;
}
