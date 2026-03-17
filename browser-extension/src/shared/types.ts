// NKVault Extension — Shared Types (copied from web app)

export type VaultType = 'personal' | 'shared';
export type ItemType = 'login' | 'card' | 'note' | 'identity';

export interface LoginData {
  username: string;
  password: string;
  url: string;
  notes: string;
}

export interface CardData {
  cardholderName: string;
  number: string;
  expiry: string;
  cvv: string;
  notes: string;
}

export interface NoteData {
  content: string;
}

export interface IdentityData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
}

export type ItemData = LoginData | CardData | NoteData | IdentityData;

export interface VaultItem {
  id: string;
  title: string;
  type: ItemType;
  data: ItemData;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  vaultId: string;
}

export interface Vault {
  id: string;
  name: string;
  type: VaultType;
  ownerId: string;
}

export const ITEM_TYPE_META: Record<ItemType, { label: string; icon: string }> = {
  login: { label: 'Login', icon: 'key' },
  card: { label: 'Card', icon: 'credit-card' },
  note: { label: 'Note', icon: 'file-text' },
  identity: { label: 'Identity', icon: 'user' },
};

export function getDefaultData(type: ItemType): ItemData {
  switch (type) {
    case 'login':
      return { username: '', password: '', url: '', notes: '' };
    case 'card':
      return { cardholderName: '', number: '', expiry: '', cvv: '', notes: '' };
    case 'note':
      return { content: '' };
    case 'identity':
      return { firstName: '', lastName: '', email: '', phone: '', address: '', notes: '' };
  }
}

// Helper utilities (from web app)
export function maskValue(value: string, visibleChars: number = 4): string {
  if (value.length <= visibleChars) return '•'.repeat(value.length);
  return '•'.repeat(value.length - visibleChars) + value.slice(-visibleChars);
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getItemSubtitle(item: any): string {
  switch (item.type) {
    case 'login':
      return item.data?.username || item.data?.url || 'No username';
    case 'card':
      return item.data?.number ? `•••• ${item.data.number.slice(-4)}` : 'No card number';
    case 'note':
      return item.data?.content?.substring(0, 50) || 'Empty note';
    case 'identity':
      return [item.data?.firstName, item.data?.lastName].filter(Boolean).join(' ') || 'No name';
    default:
      return '';
  }
}

export function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return '';
  }
}

// Password generator (from web app)
export interface PasswordOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
}

const CHARS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

function cryptoRandom(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

export function generatePassword(options: PasswordOptions): string {
  let charset = '';
  const required: string[] = [];

  if (options.uppercase) {
    charset += CHARS.uppercase;
    required.push(CHARS.uppercase[cryptoRandom(CHARS.uppercase.length)]);
  }
  if (options.lowercase) {
    charset += CHARS.lowercase;
    required.push(CHARS.lowercase[cryptoRandom(CHARS.lowercase.length)]);
  }
  if (options.numbers) {
    charset += CHARS.numbers;
    required.push(CHARS.numbers[cryptoRandom(CHARS.numbers.length)]);
  }
  if (options.symbols) {
    charset += CHARS.symbols;
    required.push(CHARS.symbols[cryptoRandom(CHARS.symbols.length)]);
  }

  if (!charset) charset = CHARS.lowercase;

  const remaining = options.length - required.length;
  const password: string[] = [...required];

  for (let i = 0; i < Math.max(0, remaining); i++) {
    password.push(charset[cryptoRandom(charset.length)]);
  }

  // Fisher-Yates shuffle
  for (let i = password.length - 1; i > 0; i--) {
    const j = cryptoRandom(i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join('');
}

export function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: 'Weak', color: '#FF4D4D' };
  if (score <= 4) return { score, label: 'Fair', color: '#FFB800' };
  return { score, label: 'Strong', color: '#00D68F' };
}

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
};
