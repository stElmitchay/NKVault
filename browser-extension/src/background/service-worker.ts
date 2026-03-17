// NKVault Extension — Background Service Worker
// Manages auth state, vault key, InstantDB connection, and credential matching.

import { init, id as instantId } from '@instantdb/core';
import { encrypt, decrypt, isEncrypted, importKey, unwrapKey, type WrappedKey } from '$ext/shared/crypto';
import { generatePassword, DEFAULT_PASSWORD_OPTIONS } from '$ext/shared/types';
import type { AuthStatusResponse, VaultItemsResponse, CredentialsResponse } from '$ext/shared/messages';

const APP_ID = '60e86fb7-dd9b-49bb-949e-aa33675eb019';
const AUTO_LOCK_MS = 15 * 60 * 1000; // 15 minutes

// ---- State ----
let db: ReturnType<typeof init> | null = null;
let authUser: { id: string; email: string } | null = null;
let vaultKey: CryptoKey | null = null;
let sharedVaultKey: CryptoKey | null = null;
let cachedItems: any[] = [];
let cachedVaults: any[] = [];
let autoLockTimer: ReturnType<typeof setTimeout> | null = null;
let unsubItems: (() => void) | null = null;
let unsubVaults: (() => void) | null = null;
let neverSaveDomains: Set<string> = new Set();

// ---- Initialize ----
async function initDB() {
  if (db) return;

  try {
    // Use schema-less init since we can't import the schema module in a service worker
    db = init({ appId: APP_ID });
    console.log('[NKVault BG] InstantDB initialized');

    // Subscribe to auth state
    db.subscribeAuth((authState: any) => {
      if (authState.user) {
        authUser = { id: authState.user.id, email: authState.user.email };
        console.log('[NKVault BG] Auth: signed in as', authUser.email);
        subscribeToData();
      } else {
        authUser = null;
        clearSubscriptions();
      }
    });
  } catch (err) {
    console.error('[NKVault BG] Failed to init DB:', err);
  }
}

function subscribeToData() {
  if (!db) return;

  // Subscribe to vaults
  if (unsubVaults) unsubVaults();
  unsubVaults = db.subscribeQuery({ vaults: {} }, (resp: any) => {
    if (resp.data) {
      cachedVaults = resp.data.vaults || [];
    }
  });

  // Subscribe to items
  if (unsubItems) unsubItems();
  unsubItems = db.subscribeQuery({ items: { vault: {} } }, (resp: any) => {
    if (resp.data) {
      cachedItems = resp.data.items || [];
      console.log('[NKVault BG] Items updated:', cachedItems.length);
    }
  });
}

function clearSubscriptions() {
  if (unsubItems) { unsubItems(); unsubItems = null; }
  if (unsubVaults) { unsubVaults(); unsubVaults = null; }
  cachedItems = [];
  cachedVaults = [];
}

// ---- Auto-lock ----
function resetAutoLock() {
  if (autoLockTimer) clearTimeout(autoLockTimer);
  if (vaultKey) {
    autoLockTimer = setTimeout(() => {
      console.log('[NKVault BG] Auto-locking vault');
      lockVault();
    }, AUTO_LOCK_MS);
  }
}

function lockVault() {
  vaultKey = null;
  sharedVaultKey = null;
  if (autoLockTimer) { clearTimeout(autoLockTimer); autoLockTimer = null; }
}

// ---- Vault key management ----
async function setVaultKeyFromRaw(rawKeyBase64: string) {
  try {
    const binary = atob(rawKeyBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    vaultKey = await importKey(bytes, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']);
    resetAutoLock();
    console.log('[NKVault BG] Vault key set');
    return true;
  } catch (err) {
    console.error('[NKVault BG] Failed to import vault key:', err);
    return false;
  }
}

// ---- Decrypt items ----
async function decryptItemsForDisplay(items: any[]): Promise<any[]> {
  if (!vaultKey) return items;

  const keys: CryptoKey[] = [vaultKey];
  if (sharedVaultKey) keys.push(sharedVaultKey);

  return Promise.all(items.map(async (item: any) => {
    let decTitle = item.title;
    let decData = item.data;

    // Decrypt title
    if (typeof item.title === 'string') {
      try {
        const parsed = JSON.parse(item.title);
        if (isEncrypted(parsed)) {
          for (const key of keys) {
            try {
              decTitle = await decrypt(key, parsed);
              break;
            } catch { /* try next */ }
          }
        }
      } catch { /* not JSON, use as-is */ }
    }

    // Decrypt data
    if (isEncrypted(item.data)) {
      for (const key of keys) {
        try {
          const plaintext = await decrypt(key, item.data);
          decData = JSON.parse(plaintext);
          break;
        } catch { /* try next */ }
      }
    }

    return { ...item, title: decTitle, data: decData };
  }));
}

// ---- URL matching ----
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url.toLowerCase();
  }
}

async function getCredentialsForUrl(url: string): Promise<any[]> {
  if (!vaultKey || cachedItems.length === 0) return [];

  const targetHost = normalizeUrl(url);
  const decryptedItems = await decryptItemsForDisplay(cachedItems);

  return decryptedItems
    .filter(item => {
      if (item.type !== 'login') return false;
      if (!item.data?.url) return false;
      const itemHost = normalizeUrl(item.data.url);
      return targetHost === itemHost || targetHost.endsWith('.' + itemHost) || itemHost.endsWith('.' + targetHost);
    })
    .map(item => ({
      id: item.id,
      title: item.title,
      username: item.data?.username || '',
      password: item.data?.password || '',
      url: item.data?.url || '',
    }));
}

// ---- Message Handling ----
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handle = async () => {
    resetAutoLock();

    switch (message.type) {
      case 'GET_AUTH_STATUS': {
        // Check chrome.storage for auth
        const stored = await chrome.storage.local.get(['nkvault_auth']);
        const hasStoredAuth = !!stored.nkvault_auth;

        return {
          authenticated: !!authUser || hasStoredAuth,
          user: authUser,
          vaultUnlocked: !!vaultKey,
          hasProfile: !!authUser,
        } satisfies AuthStatusResponse;
      }

      case 'GET_VAULT_ITEMS': {
        if (!vaultKey) {
          return { items: [], error: 'Vault is locked' } satisfies VaultItemsResponse;
        }

        try {
          const decrypted = await decryptItemsForDisplay(cachedItems);

          let filteredItems = decrypted;
          if (message.filter && message.filter !== 'all') {
            if (message.filter === 'favorites') {
              filteredItems = filteredItems.filter((i: any) => i.favorite);
            } else {
              filteredItems = filteredItems.filter((i: any) => i.type === message.filter);
            }
          }

          // Sort by most recent
          filteredItems.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));

          return { items: filteredItems } satisfies VaultItemsResponse;
        } catch (err: any) {
          return { items: [], error: err.message } satisfies VaultItemsResponse;
        }
      }

      case 'GET_CREDENTIALS_FOR_URL': {
        const credentials = await getCredentialsForUrl(message.url);
        return { credentials } satisfies CredentialsResponse;
      }

      case 'SET_VAULT_KEY': {
        const success = await setVaultKeyFromRaw(message.keyBase64);
        return { success };
      }

      case 'LOCK_VAULT': {
        lockVault();
        return { success: true };
      }

      case 'SAVE_AUTH': {
        await chrome.storage.local.set({
          nkvault_auth: {
            token: message.token,
            refreshToken: message.refreshToken,
            user: message.user,
            savedAt: Date.now(),
          }
        });
        authUser = message.user;

        // Re-init DB connection
        if (!db) await initDB();
        return { success: true };
      }

      case 'COPY_SECURE': {
        // Copy to clipboard in background context — not always available
        // The popup can do this directly
        return { success: true };
      }

      case 'GET_CURRENT_URL': {
        // Get the active tab's URL
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          return { url: tab?.url || '' };
        } catch {
          return { url: '' };
        }
      }

      case 'AUTH_SYNC_CHECK': {
        const data = await chrome.storage.local.get(['nkvault_auth']);
        if (data.nkvault_auth) {
          authUser = data.nkvault_auth.user;
          if (!db) await initDB();
        }
        return { authenticated: !!authUser };
      }

      case 'GET_SIGNUP_DATA': {
        // Find identity items in the vault and generate a strong password
        let identity: any = null;

        if (vaultKey && cachedItems.length > 0) {
          const decryptedItems = await decryptItemsForDisplay(cachedItems);
          const identityItem = decryptedItems.find((i: any) => i.type === 'identity');
          if (identityItem?.data) {
            identity = {
              firstName: identityItem.data.firstName || '',
              lastName: identityItem.data.lastName || '',
              email: identityItem.data.email || '',
              phone: identityItem.data.phone || '',
              address: identityItem.data.address || '',
            };
          }
        }

        // If no identity item, try to use the auth user's email
        if (!identity && authUser) {
          identity = {
            firstName: '',
            lastName: '',
            email: authUser.email || '',
            phone: '',
            address: '',
          };
        }

        // Generate a strong password
        const generatedPassword = generatePassword(DEFAULT_PASSWORD_OPTIONS);

        return { identity, generatedPassword };
      }

      case 'SAVE_CREDENTIAL': {
        if (!vaultKey || !db || !authUser) {
          return { success: false, error: 'Vault is locked or not authenticated' };
        }

        // Check if domain is in never-save list
        const saveDomain = normalizeUrl(message.credential.url);
        if (neverSaveDomains.has(saveDomain)) {
          return { success: false, error: 'Domain is in never-save list' };
        }

        try {
          const itemId = instantId();
          const now = Date.now();

          // Find user's personal vault
          const personalVault = cachedVaults.find(
            (v: any) => v.type === 'personal' && v.ownerId === authUser!.id
          );
          if (!personalVault) {
            return { success: false, error: 'No personal vault found' };
          }

          // Encrypt title
          const encryptedTitle = JSON.stringify(await encrypt(vaultKey, message.credential.title));

          // Encrypt data
          const loginData = {
            username: message.credential.username,
            password: message.credential.password,
            url: message.credential.url,
            notes: '',
          };
          const encryptedData = await encrypt(vaultKey, JSON.stringify(loginData));

          await db.transact([
            db.tx.items[itemId].update({
              title: encryptedTitle,
              type: 'login',
              data: encryptedData,
              favorite: false,
              createdAt: now,
              updatedAt: now,
              createdBy: authUser!.id,
              vaultId: personalVault.id,
            }),
            db.tx.items[itemId].link({ vault: personalVault.id }),
          ]);

          console.log('[NKVault BG] Credential saved:', message.credential.title);
          return { success: true };
        } catch (err: any) {
          console.error('[NKVault BG] Failed to save credential:', err);
          return { success: false, error: err.message };
        }
      }

      case 'UPDATE_CREDENTIAL': {
        if (!vaultKey || !db) {
          return { success: false, error: 'Vault is locked' };
        }

        try {
          // Find the existing item
          const existingItem = cachedItems.find((i: any) => i.id === message.itemId);
          if (!existingItem) {
            return { success: false, error: 'Item not found' };
          }

          // Decrypt existing data to merge
          let existingData: any = {};
          if (isEncrypted(existingItem.data)) {
            try {
              const plaintext = await decrypt(vaultKey, existingItem.data);
              existingData = JSON.parse(plaintext);
            } catch {}
          }

          // Update password in the data
          const updatedData = {
            ...existingData,
            password: message.credential.password,
            username: message.credential.username || existingData.username,
          };

          const encryptedData = await encrypt(vaultKey, JSON.stringify(updatedData));

          await db.transact(
            db.tx.items[message.itemId].update({
              data: encryptedData,
              updatedAt: Date.now(),
            })
          );

          console.log('[NKVault BG] Credential updated:', message.itemId);
          return { success: true };
        } catch (err: any) {
          console.error('[NKVault BG] Failed to update credential:', err);
          return { success: false, error: err.message };
        }
      }

      case 'NEVER_SAVE_FOR_DOMAIN': {
        neverSaveDomains.add(message.domain);
        // Persist to chrome.storage
        await chrome.storage.local.set({
          nkvault_never_save: Array.from(neverSaveDomains),
        });
        console.log('[NKVault BG] Never save for:', message.domain);
        return { success: true };
      }

      default:
        return { error: 'Unknown message type' };
    }
  };

  handle().then(sendResponse).catch(err => {
    console.error('[NKVault BG] Error handling message:', err);
    sendResponse({ error: err.message });
  });

  return true; // Keep message channel open for async
});

// ---- Startup ----
initDB();
chrome.storage.local.get(['nkvault_auth', 'nkvault_never_save'], (data) => {
  if (data.nkvault_auth?.user) {
    authUser = data.nkvault_auth.user;
    console.log('[NKVault BG] Restored auth:', authUser.email);
  }
  if (data.nkvault_never_save) {
    neverSaveDomains = new Set(data.nkvault_never_save);
    console.log('[NKVault BG] Restored never-save domains:', neverSaveDomains.size);
  }
});

console.log('[NKVault] Background service worker started');
