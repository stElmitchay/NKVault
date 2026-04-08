// NKVault — Secure Clipboard with Auto-Clear

const DEFAULT_CLEAR_MS = 30_000;
let clearTimeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Copy text to clipboard and auto-clear after `clearMs` (default 30s).
 * Returns true if copy succeeded.
 *
 * The clear path unconditionally overwrites with an empty string rather
 * than reading first — `readText` requires document focus and silently
 * fails in popup/background contexts, which previously left passwords
 * sitting on the clipboard indefinitely.
 */
export async function secureCopy(text: string, clearMs: number = DEFAULT_CLEAR_MS): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);

    if (clearTimeoutId !== null) {
      clearTimeout(clearTimeoutId);
    }

    clearTimeoutId = setTimeout(async () => {
      try {
        await navigator.clipboard.writeText('');
      } catch {
        // Silently fail — best-effort
      }
      clearTimeoutId = null;
    }, clearMs);

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
