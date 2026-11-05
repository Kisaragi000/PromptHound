/**
 * True on Windows, and in the browser preview where there is no desktop app to ask.
 * Windows-only options (the Explorer right-click menu) are hidden when this is false.
 */
export function isWindowsApp(): boolean {
  const platform = window.promptHound?.appInfo?.platform;
  return !platform || platform === 'win32';
}
