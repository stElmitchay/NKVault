// NKVault Password Generator

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

  if (!charset) {
    charset = CHARS.lowercase;
  }

  const remaining = options.length - required.length;
  const password: string[] = [...required];

  for (let i = 0; i < Math.max(0, remaining); i++) {
    password.push(charset[cryptoRandom(charset.length)]);
  }

  // Shuffle using Fisher-Yates
  for (let i = password.length - 1; i > 0; i--) {
    const j = cryptoRandom(i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join('');
}

function cryptoRandom(max: number): number {
  if (max <= 0) return 0;
  // Rejection sampling: discard values that would introduce modulo bias.
  const array = new Uint32Array(1);
  const limit = Math.floor(0xFFFFFFFF / max) * max;
  let r: number;
  do {
    crypto.getRandomValues(array);
    r = array[0];
  } while (r >= limit);
  return r % max;
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

  if (score <= 2) return { score, label: 'Weak', color: 'var(--color-danger)' };
  if (score <= 4) return { score, label: 'Fair', color: 'var(--color-warning)' };
  return { score, label: 'Strong', color: 'var(--color-success)' };
}

export const DEFAULT_OPTIONS: PasswordOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
};
