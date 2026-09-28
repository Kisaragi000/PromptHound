// Quality / rating boilerplate that makes a poor title ("score_9", "masterpiece")
const BOILERPLATE_TAG =
  /^(score_\d+(_up)?|rating_\w+|source_\w+|masterpiece|best quality|(very |ultra |absurdly )?(high|good|amazing|best|normal|low|worst) quality|very aesthetic|aesthetic|(very )?awa|absurdres|highres|hires|ultra detailed|highly detailed|detailed|8k|4k|uhd|hdr|newest|photo|safe|sfw|nsfw|solo|\d+\+?(girl|boy|other)s?)$/i;

/** A short title from the first descriptive prompt tag */
export function recipeTitle(prompt: string | undefined): string {
  const tags = (prompt || '')
    .replace(/<[^>]+>/g, ' ')
    .split(/,|\n/)
    .map((t) => t.replace(/[()[\]{}]/g, '').replace(/:\s*[\d.]+\s*$/, '').replace(/\\/g, '').trim())
    .filter((t) => /\p{L}/u.test(t) && !BOILERPLATE_TAG.test(t));
  const title = tags[0] || '';
  return title.length > 40 ? `${title.slice(0, 38).trimEnd()}…` : title;
}
