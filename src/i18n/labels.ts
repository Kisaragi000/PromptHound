import { getLanguage, localeTag, t, type StringKey, type TranslateVars } from './index.js';

// Folders and sources are stored in English; only their display name is translated,
// so libraries and backups stay the same whichever language the app is in
const FOLDER_KEYS: Record<string, StringKey> = {
  'All Prompts': 'folder.allPrompts',
  Portraits: 'folder.portraits',
  Landscapes: 'folder.landscapes',
  Architecture: 'folder.architecture',
  Illustrations: 'folder.illustrations',
  Anime: 'folder.anime',
  'My Creations': 'folder.myCreations',
  'Batch Imports': 'folder.batchImports',
};

const SOURCE_KEYS: Record<string, StringKey> = {
  'Local File': 'source.localFile',
  Clipboard: 'source.clipboard',
  Web: 'source.web',
};

/** Display name of a folder: built-in folders are translated, the user's own are shown as named */
export function folderLabel(name: string): string {
  const key = FOLDER_KEYS[name];
  return key ? t(key) : name;
}

/** Display name of a saved item's source (Civitai and SeaArt stay as they are) */
export function sourceLabel(source: string): string {
  const key = SOURCE_KEYS[source];
  return key ? t(key) : source;
}

/** A library item's saved date ("Oct 8, 2026") in the interface language */
export function formatItemDate(date: string): string {
  if (getLanguage() === 'en') return date;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString(localeTag(), { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Messages written in English by the extraction engine, the desktop app and the backup
 * reader, matched to their translations. Unknown messages are shown unchanged.
 */
const MESSAGE_PATTERNS: Array<[RegExp, StringKey, (m: RegExpMatchArray) => TranslateVars]> = [
  [/^No AI generation metadata could be found in this image\./, 'msg.noMetadata', () => ({})],
  [/^Failed to parse image metadata\.$/, 'msg.parseFailed', () => ({})],
  [/^Failed to parse image file\.$/, 'msg.parseFileFailed', () => ({})],
  [/^This image is labeled as AI-generated, but/, 'msg.aiLabelNoPrompt', () => ({})],
  [/^This image has Content Credentials, but/, 'msg.credentialsNoAi', () => ({})],
  [/^Failed to fetch image: HTTP (.*)$/, 'msg.fetchImageFailed', (m) => ({ status: m[1].trim() })],
  [/^Failed to fetch page: HTTP (.*)$/, 'msg.fetchPageFailed', (m) => ({ status: m[1].trim() })],
  [/^Could not extract generation metadata from this page\./, 'msg.pageNoMetadata', () => ({})],
  [/^Network error occurred while fetching link\.$/, 'msg.networkError', () => ({})],
  [/^Something unexpected went wrong\.$/, 'msg.unexpected', () => ({})],
  [/^Direct file path extraction is only supported/, 'msg.filePathDesktopOnly', () => ({})],
  [/^Clipboard image reading is supported/, 'msg.clipboardDesktopOnly', () => ({})],
  [/^No image was found on the clipboard\.$/, 'msg.noClipboardImage', () => ({})],
  [/^Could not read that file: ([\s\S]*)$/, 'msg.readFileFailed', (m) => ({ detail: m[1] })],
  [/^Something went wrong fetching that link: ([\s\S]*)$/, 'msg.fetchLinkFailed', (m) => ({ detail: m[1] })],
  [/^This file is not a PromptHound library backup/, 'msg.notBackup', () => ({})],
  [/^This zip has no manifest\.json/, 'msg.noManifest', () => ({})],
  [/^The backup manifest could not be read\.$/, 'msg.badManifest', () => ({})],
  [/^This zip is not a PromptHound library backup\.$/, 'msg.notBackupZip', () => ({})],
  [/Backups larger than 2 GB are not supported\./, 'msg.backupTooLarge', () => ({})],
  [/^Exact hash match \((.*)\)$/, 'loraModal.match.hash', (m) => ({ hash: m[1] })],
  [/^Exact title match$/, 'loraModal.match.title', () => ({})],
  [/^Exact filename match \((.*)\)$/, 'loraModal.match.file', (m) => ({ name: m[1] })],
  [/^Zero token intersection$/, 'loraModal.match.none', () => ({})],
  [/^Token similarity \((\d+)%\)$/, 'loraModal.match.tokens', (m) => ({ percent: m[1] })],
  [/^String bigram similarity \((\d+)%\)$/, 'loraModal.match.bigram', (m) => ({ percent: m[1] })],
];

export function translateMessage(message: string): string {
  if (getLanguage() === 'en') return message;
  for (const [pattern, key, vars] of MESSAGE_PATTERNS) {
    const match = message.match(pattern);
    if (match) return t(key, vars(match));
  }
  return message;
}
