// NKVault — Settings Store (Svelte 5 runes)
// Manages dark mode, sort preferences, and persists to localStorage.

import { browser } from '$app/environment';

type SortBy = 'updated' | 'created' | 'name' | 'type';
type SortDir = 'asc' | 'desc';

// Load saved preferences
function loadPref<T>(key: string, fallback: T): T {
  if (!browser) return fallback;
  try {
    const saved = localStorage.getItem(`nkvault_${key}`);
    if (saved !== null) return JSON.parse(saved);
  } catch {}
  return fallback;
}

function savePref(key: string, value: any): void {
  if (!browser) return;
  try {
    localStorage.setItem(`nkvault_${key}`, JSON.stringify(value));
  } catch {}
}

// Reactive state
let darkMode = $state(loadPref('darkMode', true));
let sortBy = $state<SortBy>(loadPref('sortBy', 'updated'));
let sortDir = $state<SortDir>(loadPref('sortDir', 'desc'));
let clipboardClearSeconds = $state(loadPref('clipboardClear', 30));

// Apply dark mode on init
if (browser) {
  const initialDark = loadPref('darkMode', true);
  applyDarkMode(initialDark);
}

function applyDarkMode(isDark: boolean): void {
  if (!browser) return;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

function toggleDarkMode(): void {
  darkMode = !darkMode;
  savePref('darkMode', darkMode);
  applyDarkMode(darkMode);
}

function setSortBy(value: SortBy): void {
  sortBy = value;
  savePref('sortBy', value);
}

function setSortDir(value: SortDir): void {
  sortDir = value;
  savePref('sortDir', value);
}

function setClipboardClearSeconds(value: number): void {
  clipboardClearSeconds = value;
  savePref('clipboardClear', value);
}

export function getSettings() {
  return {
    get darkMode() { return darkMode; },
    get sortBy() { return sortBy; },
    get sortDir() { return sortDir; },
    get clipboardClearSeconds() { return clipboardClearSeconds; },
    toggleDarkMode,
    setSortBy,
    setSortDir,
    setClipboardClearSeconds,
  };
}
