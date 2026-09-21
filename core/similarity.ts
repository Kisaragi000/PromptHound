/**
 * String similarity, token overlap, and candidate ranking utilities
 * to prevent false-positive LoRA matches from Civitai/SeaArt search APIs.
 */

const NOISE_TOKENS = new Set([
  'lora',
  'loras',
  'v1',
  'v2',
  'v3',
  'v4',
  'v5',
  'v10',
  'v20',
  'sdxl',
  'sd15',
  'sd1.5',
  'sd21',
  'sd2.1',
  'pony',
  'flux',
  'flux1',
  'illustrious',
  'animagine',
  'noobai',
  'offset',
  'safetensors',
  'pt',
  'ckpt',
  'bin',
  'style',
  'epoch',
  'step',
  'version',
  'model',
  'checkpoint',
  'weights',
  'civitai',
]);

/**
 * Normalizes a string into meaningful alphanumeric tokens.
 */
export function extractMeaningfulTokens(text: string): string[] {
  if (!text) return [];
  const clean = text
    .toLowerCase()
    .replace(/[._\-–—/\\()[\]{}<>:;"',+*^&%$#@!~?`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return clean
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !NOISE_TOKENS.has(t));
}

/**
 * Calculates Dice coefficient (Bigram similarity) between two strings.
 * Returns float between 0.0 and 1.0.
 */
export function diceCoefficient(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/\s+/g, '');
  const s2 = str2.toLowerCase().replace(/\s+/g, '');

  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const bigrams1 = new Map<string, number>();
  for (let i = 0; i < s1.length - 1; i++) {
    const bigram = s1.substring(i, i + 2);
    bigrams1.set(bigram, (bigrams1.get(bigram) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bigram = s2.substring(i, i + 2);
    const count = bigrams1.get(bigram) || 0;
    if (count > 0) {
      bigrams1.set(bigram, count - 1);
      intersection++;
    }
  }

  const totalBigrams = s1.length - 1 + (s2.length - 1);
  return (2.0 * intersection) / totalBigrams;
}

export interface CandidateModelItem {
  id: number;
  name: string;
  nsfw?: boolean;
  nsfwLevel?: number;
  modelVersions?: Array<{
    id: number;
    name?: string;
    baseModel?: string;
    trainedWords?: string[];
    images?: Array<{ id?: string | number; url?: string }>;
    files?: Array<{
      name?: string;
      hashes?: Record<string, string>;
    }>;
  }>;
}

export interface CandidateMatchResult {
  candidate: CandidateModelItem;
  score: number;
  matchReason: string;
  matchedVersionId?: number;
}

/**
 * Evaluates how strongly a Civitai model search candidate matches the query.
 * Rejects unrelated models (score < 0.45).
 */
export function scoreModelCandidate(
  rawQuery: string,
  normalizedQuery: string,
  candidate: CandidateModelItem,
  targetHash?: string
): CandidateMatchResult {
  const cleanQuery = normalizedQuery.trim().toLowerCase();
  const rawClean = rawQuery.trim().toLowerCase();
  const queryTokens = extractMeaningfulTokens(cleanQuery.length > 0 ? cleanQuery : rawClean);

  const modelName = (candidate.name || '').trim().toLowerCase();
  const modelTokens = extractMeaningfulTokens(modelName);

  // 1. Exact Hash Match Check
  if (targetHash && candidate.modelVersions) {
    const cleanTargetHash = targetHash.trim().toLowerCase();
    for (const v of candidate.modelVersions) {
      if (v.files) {
        for (const f of v.files) {
          if (f.hashes) {
            for (const hVal of Object.values(f.hashes)) {
              const hLower = String(hVal).toLowerCase();
              if (
                hLower === cleanTargetHash ||
                (cleanTargetHash.length >= 8 && hLower.startsWith(cleanTargetHash)) ||
                (hLower.length >= 8 && cleanTargetHash.startsWith(hLower))
              ) {
                return {
                  candidate,
                  score: 1.0,
                  matchReason: `Exact hash match (${targetHash.slice(0, 10)})`,
                  matchedVersionId: v.id,
                };
              }
            }
          }
        }
      }
    }
  }

  // 2. Exact Title Match
  if (modelName === cleanQuery || modelName === rawClean) {
    return {
      candidate,
      score: 1.0,
      matchReason: 'Exact title match',
    };
  }

  // 3. File Name Match across versions
  if (candidate.modelVersions) {
    for (const v of candidate.modelVersions) {
      if (v.files) {
        for (const f of v.files) {
          if (f.name) {
            const fNameClean = f.name.toLowerCase().replace(/\.(safetensors|pt|ckpt|bin)$/i, '');
            if (fNameClean === cleanQuery || fNameClean === rawClean) {
              return {
                candidate,
                score: 0.95,
                matchReason: `Exact filename match (${f.name})`,
                matchedVersionId: v.id,
              };
            }
          }
        }
      }
    }
  }

  // 4. Token Overlap & Intersection
  if (queryTokens.length > 0 && modelTokens.length > 0) {
    const modelSet = new Set(modelTokens);
    let tokenMatches = 0;
    for (const qToken of queryTokens) {
      if (modelSet.has(qToken)) {
        tokenMatches++;
      } else {
        // Partial token prefix/stem match
        for (const mToken of modelTokens) {
          if (
            (mToken.startsWith(qToken) || qToken.startsWith(mToken)) &&
            Math.min(mToken.length, qToken.length) >= 4
          ) {
            tokenMatches += 0.8;
            break;
          }
        }
      }
    }

    const queryRecall = tokenMatches / queryTokens.length;
    const modelPrecision = tokenMatches / modelTokens.length;
    const harmonicScore = (2 * queryRecall * modelPrecision) / (queryRecall + modelPrecision || 1);

    // Also compute string dice coefficient
    const dice = diceCoefficient(cleanQuery, modelName);

    // Blended score
    const combinedScore = Math.max(
      harmonicScore * 0.6 + dice * 0.4,
      queryRecall * 0.7 + dice * 0.3
    );

    // If query had multiple tokens and ZERO matched, hard reject
    if (queryTokens.length >= 2 && tokenMatches === 0) {
      return {
        candidate,
        score: 0.0,
        matchReason: 'Zero token intersection',
      };
    }

    return {
      candidate,
      score: combinedScore,
      matchReason: `Token similarity (${Math.round(combinedScore * 100)}%)`,
    };
  }

  // Fallback string dice
  const fallbackDice = diceCoefficient(cleanQuery, modelName);
  return {
    candidate,
    score: fallbackDice,
    matchReason: `String bigram similarity (${Math.round(fallbackDice * 100)}%)`,
  };
}
