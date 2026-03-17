// NKVault Auth Store — Svelte 5 runes wrapping InstantDB auth
import { db } from '$lib/db';
import { browser } from '$app/environment';
import type { AuthUser } from '$lib/types';

const ALLOWED_DOMAIN = '@christex.foundation';

// Reactive auth state
let user = $state<AuthUser | null>(null);
let isLoading = $state(true);
let error = $state<string | null>(null);

// Subscribe to auth changes (browser only)
if (browser && db) {
  db.subscribeAuth((authState: any) => {
    if (authState.error) {
      error = authState.error.message || 'Authentication error';
      user = null;
      isLoading = false;
      return;
    }

    if (authState.user) {
      user = {
        id: authState.user.id,
        email: authState.user.email,
      };
      error = null;
    } else {
      user = null;
    }
    isLoading = false;
  });
}

// Validate email domain
function validateEmail(email: string): boolean {
  return email.toLowerCase().endsWith(ALLOWED_DOMAIN);
}

// Send magic code
async function sendMagicCode(email: string): Promise<void> {
  error = null;

  if (!validateEmail(email)) {
    error = `Only ${ALLOWED_DOMAIN} email addresses are allowed.`;
    throw new Error(error);
  }

  try {
    await db.auth.sendMagicCode({ email });
  } catch (err: any) {
    error = err.body?.message || 'Failed to send magic code.';
    throw err;
  }
}

// Sign in with magic code
async function signInWithMagicCode(email: string, code: string): Promise<void> {
  error = null;

  try {
    await db.auth.signInWithMagicCode({ email, code });
  } catch (err: any) {
    error = err.body?.message || 'Invalid code. Please try again.';
    throw err;
  }
}

// Sign out
function signOut(): void {
  db.auth.signOut();
}

// Export reactive getters
export function getAuth() {
  return {
    get user() { return user; },
    get isLoading() { return isLoading; },
    get error() { return error; },
    sendMagicCode,
    signInWithMagicCode,
    signOut,
    validateEmail,
  };
}
