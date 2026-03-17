// NKVault Extension — Message Types
// Defines all message types used for communication between
// popup, background service worker, and content scripts.

export interface AuthStatus {
  authenticated: boolean;
  user?: { id: string; email: string } | null;
}

export interface VaultItem {
  id: string;
  title: string;
  type: 'login' | 'card' | 'note' | 'identity';
  data: any;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  vaultId: string;
}

export interface CredentialMatch {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
}

// ---- Popup → Background Messages ----

export type PopupMessage =
  | { type: 'GET_AUTH_STATUS' }
  | { type: 'GET_VAULT_ITEMS'; filter?: string }
  | { type: 'UNLOCK_VAULT'; walletAddress: string }
  | { type: 'LOCK_VAULT' }
  | { type: 'COPY_SECURE'; text: string }
  | { type: 'GET_CURRENT_URL' };

// ---- Content → Background Messages ----

export type ContentMessage =
  | { type: 'GET_CREDENTIALS_FOR_URL'; url: string }
  | { type: 'SAVE_AUTH'; token: string; refreshToken: string; user: { id: string; email: string } }
  | { type: 'AUTH_SYNC_CHECK' };

// ---- Background → Popup/Content Responses ----

export interface AuthStatusResponse {
  authenticated: boolean;
  user?: { id: string; email: string } | null;
  vaultUnlocked: boolean;
  hasProfile: boolean;
}

export interface VaultItemsResponse {
  items: VaultItem[];
  error?: string;
}

export interface CredentialsResponse {
  credentials: CredentialMatch[];
}
