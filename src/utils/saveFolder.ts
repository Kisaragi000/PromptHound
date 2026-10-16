const LAST_FOLDER_KEY = 'prompthound_last_save_folder';
const DEFAULT_FOLDER = 'My Creations';

/** The folder new entries were last saved into, if it still exists */
export function lastSaveFolder(folders: string[]): string {
  let last: string | null = null;
  try {
    last = localStorage.getItem(LAST_FOLDER_KEY);
  } catch {
    // ignore
  }
  const choices = folders.filter((f) => f !== 'All Prompts');
  if (last && choices.includes(last)) return last;
  return choices.includes(DEFAULT_FOLDER) ? DEFAULT_FOLDER : choices[0] ?? DEFAULT_FOLDER;
}

export function rememberSaveFolder(folder: string): void {
  try {
    localStorage.setItem(LAST_FOLDER_KEY, folder);
  } catch {
    // ignore
  }
}
