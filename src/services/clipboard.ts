export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Use Electron's clipboard API through the preload bridge
    if (window.electron) {
      return await window.electron.copyToClipboard(text);
    }

    // Fallback to browser clipboard API
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

export async function readFromClipboard(): Promise<string> {
  try {
    return await navigator.clipboard.readText();
  } catch (error) {
    console.error('Failed to read from clipboard:', error);
    return '';
  }
}
