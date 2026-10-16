/**
 * "Readable" prompt layout: the same tags, regrouped into blocks separated by a blank line.
 *
 *   art style, artist, LoRA tags and trigger words
 *   character: 1girl, hair, eyes, clothes…
 *   pose, expression, framing
 *   background and setting
 *   quality tags
 *
 * Tags are sorted by keywords. A tag no rule knows (an artist or character name, a typo)
 * stays with the tag before it, so names written next to what they belong to stay there.
 */

export type TagGroup = 'style' | 'character' | 'action' | 'scene' | 'quality';

export const TAG_GROUP_ORDER: TagGroup[] = ['style', 'character', 'action', 'scene', 'quality'];

/** Splits a prompt at commas and line breaks that are not inside (), [], {} or <> */
export function splitPromptTags(prompt: string): string[] {
  const tags: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < prompt.length; i++) {
    const ch = prompt[i];
    if (ch === '\\' && i + 1 < prompt.length) {
      current += ch + prompt[++i];
      continue;
    }
    if ('([{<'.includes(ch)) depth++;
    else if (')]}>'.includes(ch)) depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === '\n') && depth === 0) {
      tags.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  tags.push(current);
  return tags.map((t) => t.trim()).filter(Boolean);
}

/** The words of a tag without weights, brackets, escapes or underscores, lower case */
export function normalizeTag(tag: string): string {
  return tag
    .replace(/\\([()[\]])/g, '$1')
    .replace(/^[([{]+|[)\]}]+$/g, '')
    .replace(/:\s*-?[\d.]+\s*$/, '')
    .replace(/^[([{]+|[)\]}]+$/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Builds a regex matching any of the words (plural "s"/"es" allowed) as whole words */
const words = (list: string) =>
  new RegExp(`(^|[^a-z])(${list.trim().split(/\s*\|\s*/).join('|')})(e?s)?($|[^a-z])`);

const QUALITY = [
  /quality|score \d|absurdres|highres|lowres|resolution|masterpiece|masterwork|aesthetic/,
  /^(newest|recent|oldest|old|mid|year \d{4}|rating[: ].*|safe|sensitive|nsfw|sfw|explicit|questionable|general)$/,
  /^((ultra|extremely|highly|very|super|insanely|hyper)[ -]?)?(detailed|detail)$/,
  /^(high|best|ultra|very) (detail|details|res|detailed|pixcel|pixel)s?$/,
  /^intricate( details?)?$/,
  /(^|[^a-z0-9])(4k|8k|16k|uhd|hdr|hd|fhd)($|[^a-z0-9])/,
  /^(sharp focus|official art|award winning|trending on .*)$/,
];

const STYLE = [
  /(^| )style$|^style |art style|artstyle|^artist[: ]|^by /,
  words(
    'anime|manga|realistic|realism|photorealistic|photorealism|photo|photograph|illustration|painting|watercolor|' +
      'oil painting|sketch|lineart|line art|cel shading|flat color|pixel art|3d|2d|render|cgi|chibi|monochrome|' +
      'greyscale|grayscale|cinematic|film grain|color grading|vibrant colors|pastel colors|retro artstyle|traditional media|' +
      'digital art|concept art|comic|cartoon|ukiyo-e|impressionism|surreal|vector|lowpoly|low poly|screencap'
  ),
];

// Pose, expression, framing; checked before character, so "closed eyes" isn't taken for eye color
const ACTION = [
  /^(feet|foot|legs|leg|hands|hand|arms|arm|toes|soles|barefoot|thighs|ass|back|armpits|navel|midriff)$/,
  words(
    'looking|look|facing|sitting|sit|standing|stand|lying|kneeling|squatting|crouching|leaning|bending|bent over|' +
      'walking|running|jumping|dancing|fighting|flying|floating|swimming|sleeping|eating|drinking|reading|' +
      'holding|hugging|reaching|pointing|waving|stretching|posing|pose|dynamic|action|' +
      'arms up|arms behind|arm up|hand on|hands on|hand up|hands up|hand in|on back|on stomach|on side|all fours|' +
      'crossed|spread|outstretched|peace sign|salute|' +
      'smile|smiling|grin|laughing|blush|blushing|crying|tears|sweat|sweating|steam|' +
      'open mouth|closed mouth|closed eyes|half-closed eyes|one eye closed|wink|tongue|tongue out|parted lips|pout|' +
      'expression|expressionless|angry|surprised|embarrassed|happy|sad|shy|nervous|scared|serious|smug|' +
      'cowboy shot|full body|upper body|lower body|portrait|close-up|closeup|from above|from below|from behind|' +
      'from side|dutch angle|pov|wide shot|profile|focus|skindentation|motion blur|motion lines|' +
      'heart hands|selfie'
  ),
  /^[:;>xX=][-']?[dDpPoO3)(<>|]$|^\^\^?$|^[:;]\)/,
];

// Who is in the picture; checked before pose, so "solo focus" isn't taken for framing
const PEOPLE = [
  /^(\d+\+?|multiple|no) ?(girl|boy|other|women|men|people|humans)s?$/,
  /^(solo|solo focus|female|male|woman|man|girl|boy|loli|shota|child|teen|teenager|mature|adult|milf|elf|kemonomimi)$/,
  /years? old|mature (female|male)/,
];

const CHARACTER = [
  words(
    'hair|hairstyle|ponytail|twintails|braid|braids|bangs|ahoge|sidelocks|bob cut|eyes|eye|pupils|iris|eyebrows|' +
      'eyelashes|eyeliner|eyeshadow|makeup|lipstick|lips|skin|tan|ears|horns|horn|tail|wings|halo|breasts|' +
      'body|chest|abs|muscular|petite|curvy|freckles|mole|fang|fangs|teeth|nails|nail polish|tattoo|scar|' +
      'piercing|earrings|earring|necklace|choker|jewelry|bracelet|ring|ribbon|bow|hairband|hairclip|hair ornament|' +
      'headdress|headband|headwear|headgear|hat|cap|beret|helmet|crown|tiara|veil|glasses|eyewear|sunglasses|mask|' +
      'gloves|glove|dress|shirt|blouse|top|crop top|skirt|shorts|pants|jeans|trousers|jacket|coat|hoodie|sweater|' +
      'cardigan|vest|uniform|serafuku|kimono|yukata|hanfu|maid|apron|swimsuit|bikini|leotard|bodysuit|armor|' +
      'cape|cloak|robe|scarf|necktie|tie|collar|sleeves|sleeve|sleeveless|detached sleeves|thighhighs|thighhigh|' +
      'stockings|pantyhose|socks|kneehighs|legwear|garter|shoes|boots|heels|sandals|sneakers|footwear|' +
      'underwear|bra|panties|lingerie|clothes|clothing|outfit|costume|nude|naked|topless|' +
      'cat ears|animal ears|fox ears|bunny ears|tassel|bowtie|belt|buttons|zipper|frills|frilled|lace|' +
      'hood|backpack|bag|weapon|sword|gun|staff'
  ),
];

const SCENE = [
  words(
    'indoors|outdoors|room|bedroom|bathroom|kitchen|classroom|office|library|hallway|' +
      'background|scenery|landscape|sky|cloud|clouds|sun|moon|night|day|daytime|sunset|sunrise|dusk|dawn|evening|' +
      'morning|twilight|city|cityscape|street|road|alley|building|house|castle|forest|tree|grass|field|garden|' +
      'flower|petals|beach|ocean|sea|water|river|lake|pool|onsen|rain|snow|snowing|fog|mist|window|curtain|' +
      'bed|couch|sofa|chair|table|desk|floor|wall|stairs|light|lighting|lights|sunlight|moonlight|backlighting|' +
      'rim light|shadow|shadows|dark|darkness|bokeh|depth of field|blurry|atmosphere|weather|stars|starry sky|' +
      'space|nature|mountain|cave|ruins|temple|shrine|school|cafe|restaurant|shop|train|car|neon|' +
      'cyberpunk|fantasy|underwater|horizon|bridge|park|rooftop|balcony|fireworks|lantern|candle|smoke|fire'
  ),
];

/** The group a tag belongs to, or null when no rule knows it */
export function classifyTag(tag: string, triggerWords: string[] = []): TagGroup | null {
  if (/^<(lora|lyco|hypernet|embedding):/i.test(tag.trim())) return 'style';
  const t = normalizeTag(tag);
  if (!t) return null;
  if (triggerWords.some((w) => normalizeTag(w) === t)) return 'style';
  if (QUALITY.some((r) => r.test(t))) return 'quality';
  if (STYLE.some((r) => r.test(t))) return 'style';
  if (PEOPLE.some((r) => r.test(t))) return 'character';
  if (ACTION.some((r) => r.test(t))) return 'action';
  if (CHARACTER.some((r) => r.test(t))) return 'character';
  if (SCENE.some((r) => r.test(t))) return 'scene';
  return null;
}

/** Sorts the tags into groups, in prompt order within each group */
export function groupPromptTags(prompt: string, triggerWords: string[] = []): Record<TagGroup, string[]> {
  const groups: Record<TagGroup, string[]> = { style: [], character: [], action: [], scene: [], quality: [] };
  let previous: TagGroup = 'style';
  for (const tag of splitPromptTags(prompt)) {
    if (/^BREAK$/.test(tag)) continue;
    const known = classifyTag(tag, triggerWords);
    // A name next to quality tags is usually an artist, not a quality tag
    const group: TagGroup = known ?? (previous === 'quality' ? 'style' : previous);
    groups[group].push(tag);
    previous = group;
  }
  return groups;
}

/** The prompt laid out in groups, one blank line between them */
export function readablePrompt(prompt: string, triggerWords: string[] = []): string {
  const groups = groupPromptTags(prompt, triggerWords);
  return TAG_GROUP_ORDER.map((g) => groups[g])
    .filter((tags) => tags.length)
    .map((tags) => tags.join(', '))
    .join(',\n\n');
}
