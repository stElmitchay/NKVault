// NKVault — Secure Clipboard with Auto-Clear

const CLEAR_TIMEOUT_MS = 30_000; // 30 seconds
let clearTimeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Copy text to clipboard and auto-clear after 30 seconds.
 * Returns true if copy succeeded.
 */
export async function secureCopy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);

    // Clear any existing timeout
    if (clearTimeoutId !== null) {
      clearTimeout(clearTimeoutId);
    }

    // Schedule auto-clear
    clearTimeoutId = setTimeout(async () => {
      try {
        // Only clear if clipboard still has our text
        const current = await navigator.clipboard.readText();
        if (current === text) {
          await navigator.clipboard.writeText('');
        }
      } catch {
        // readText may fail due to permissions — still try to clear
        try {
          await navigator.clipboard.writeText('');
        } catch {
          // Silently fail
        }
      }
      clearTimeoutId = null;
    }, CLEAR_TIMEOUT_MS);

    return true;
  } catch {
    return false;
  }
}

/** Immediately clear the clipboard. */
export async function clearClipboard(): Promise<void> {
  if (clearTimeoutId !== null) {
    clearTimeout(clearTimeoutId);
    clearTimeoutId = null;
  }
  try {
    await navigator.clipboard.writeText('');
  } catch {
    // Silently fail
  }
}
