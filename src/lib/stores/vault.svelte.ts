// NKVault Vault Store — Svelte 5 runes wrapping InstantDB queries
// Now with AES-256-GCM encryption/decryption of item data.
import { db } from '$lib/db';
import { id } from '@instantdb/core';
import type { ItemType, ItemData, VaultType } from '$lib/types';
import { encrypt, decrypt, isEncrypted } from '$lib/crypto/aes';
import { getVaultKey, getSharedVaultKey } from '$lib/crypto/session';

// Reactive state
let items = $state<any[]>([]);
let vaults = $state<any[]>([]);
let isLoading = $state(true);
let activeVaultType = $state<VaultType>('personal');
let activeFilter = $state<ItemType | 'all' | 'favorites'>('all');
let searchQuery = $state('');

let unsubItems: (() => void) | null = null;
let unsubVaults: (() => void) | null = null;

// Subscribe to vaults
function subscribeToVaults() {
  if (unsubVaults) unsubVaults();

  unsubVaults = db.subscribeQuery({ vaults: {} }, (resp: any) => {
    if (resp.data) {
      vaults = resp.data.vaults || [];
    }
  });
}

// Subscribe to items with vault
function subscribeToItems() {
  if (unsubItems) unsubItems();

  unsubItems = db.subscribeQuery(
    { items: { vault: {} } },
    (resp: any) => {
      if (resp.data) {
        items = resp.data.items || [];
      }
      isLoading = false;
    }
  );
}

// Initialize subscriptions
function init() {
  subscribeToVaults();
  subscribeToItems();
}

// Ensure a personal vault exists for the user
async function ensurePersonalVault(userId: string): Promise<string> {
  const existing = vaults.find(
    (v: any) => v.type === 'personal' && v.ownerId === userId
  );
  if (existing) return existing.id;

  const vaultId = id();
  await db.transact(
    db.tx.vaults[vaultId].update({
      name: 'Personal',
      type: 'personal',
      ownerId: userId,
    })
  );
  return vaultId;
}

// Ensure a shared vault exists
async function ensureSharedVault(): Promise<string> {
  const existing = vaults.find((v: any) => v.type === 'shared');
  if (existing) return existing.id;

  const vaultId = id();
  await db.transact(
    db.tx.vaults[vaultId].update({
      name: 'Shared',
      type: 'shared',
      ownerId: 'system',
    })
  );
  return vaultId;
}

/**
 * Get the encryption key for the current vault type.
 * Personal → vaultKey, Shared → sharedVaultKey (falls back to vaultKey).
 */
function getEncryptionKey(): CryptoKey | null {
  if (activeVaultType === 'shared') {
    return getSharedVaultKey() || getVaultKey();
  }
  return getVaultKey();
}

/**
 * Decrypt an item's data field if it's encrypted.
 * Returns the decrypted ItemData or the raw data if not encrypted.
 */
async function decryptItemData(data: any): Promise<any> {
  if (!isEncrypted(data)) return data;

  const key = getEncryptionKey();
  if (!key) return data; // Can't decrypt without key

  try {
    const plaintext = await decrypt(key, data);
    return JSON.parse(plaintext);
  } catch (err) {
    console.warn('Failed to decrypt item:', err);
    return data;
  }
}

// Create an item (encrypts BOTH title and data before storing)
async function createItem(
  title: string,
  type: ItemType,
  data: ItemData,
  vaultId: string,
  userId: string
): Promise<void> {
  const itemId = id();
  const now = Date.now();

  const key = getEncryptionKey();
  let storedData: any = data;
  let storedTitle: string = title;

  if (key) {
    try {
      storedData = await encrypt(key, JSON.stringify(data));
      storedTitle = JSON.stringify(await encrypt(key, title));
    } catch (err) {
      console.warn('Encryption failed, storing plaintext:', err);
    }
  }

  await db.transact([
    db.tx.items[itemId].update({
      title: storedTitle,
      type,
      data: storedData,
      favorite: false,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      vaultId,
    }),
    db.tx.items[itemId].link({ vault: vaultId }),
  ]);
}

// Update an item (encrypts title and data)
async function updateItem(
  itemId: string,
  updates: { title?: string; type?: ItemType; data?: ItemData; favorite?: boolean }
): Promise<void> {
  const finalUpdates: any = { ...updates, updatedAt: Date.now() };
  const key = getEncryptionKey();

  // Encrypt title if provided
  if (updates.title && key) {
    try {
      finalUpdates.title = JSON.stringify(await encrypt(key, updates.title));
    } catch (err) {
      console.warn('Title encryption failed on update:', err);
    }
  }

  // Encrypt data if provided and not already encrypted
  if (updates.data && !isEncrypted(updates.data)) {
    if (key) {
      try {
        finalUpdates.data = await encrypt(key, JSON.stringify(updates.data));
      } catch (err) {
        console.warn('Encryption failed on update:', err);
      }
    }
  }

  await db.transact(
    db.tx.items[itemId].update(finalUpdates)
  );
}

// Delete an item
async function deleteItem(itemId: string): Promise<void> {
  await db.transact(db.tx.items[itemId].delete());
}

// Toggle favorite
async function toggleFavorite(itemId: string, currentValue: boolean): Promise<void> {
  await db.transact(
    db.tx.items[itemId].update({ favorite: !currentValue, updatedAt: Date.now() })
  );
}

/**
 * Decrypt all items — decrypts both title and data for display.
 * Tries all available keys (personal vault key + shared vault key) to
 * handle cross-vault items gracefully.
 */
async function decryptItems(rawItems: any[]): Promise<any[]> {
  // Collect all available keys
  const keys: CryptoKey[] = [];
  const vk = getVaultKey();
  const svk = getSharedVaultKey();
  if (vk) keys.push(vk);
  if (svk && svk !== vk) keys.push(svk);
  if (keys.length === 0) return rawItems;

  return Promise.all(
    rawItems.map(async (item: any) => {
      let decTitle = item.title;
      let decData = item.data;

      // Try decrypting title with each key
      if (typeof item.title === 'string') {
        try {
          const parsed = JSON.parse(item.title);
          if (isEncrypted(parsed)) {
            decTitle = await tryDecryptWithKeys(keys, parsed);
          }
        } catch {
          // Not JSON or not encrypted — use as-is
        }
      }

      // Try decrypting data with each key
      if (isEncrypted(item.data)) {
        for (const key of keys) {
          try {
            const plaintext = await decrypt(key, item.data);
            decData = JSON.parse(plaintext);
            break; // Success
          } catch {
            // Try next key
          }
        }
      }

      return { ...item, title: decTitle, data: decData, _rawTitle: item.title, _rawData: item.data };
    })
  );
}

/** Try decrypting an EncryptedBlob with multiple keys, return first success. */
async function tryDecryptWithKeys(keys: CryptoKey[], blob: any): Promise<string> {
  for (const key of keys) {
    try {
      return await decrypt(key, blob);
    } catch {
      // Try next key
    }
  }
  return '🔒 Encrypted';
}

// Get filtered items
function getFilteredItems(userId: string): any[] {
  let filtered = items;

  // Filter by vault type
  if (activeVaultType === 'personal') {
    const personalVaultIds = vaults
      .filter((v: any) => v.type === 'personal' && v.ownerId === userId)
      .map((v: any) => v.id);
    filtered = filtered.filter((item: any) => personalVaultIds.includes(item.vaultId));
  } else {
    const sharedVaultIds = vaults
      .filter((v: any) => v.type === 'shared')
      .map((v: any) => v.id);
    filtered = filtered.filter((item: any) => sharedVaultIds.includes(item.vaultId));
  }

  // Filter by type or favorites
  if (activeFilter === 'favorites') {
    filtered = filtered.filter((item: any) => item.favorite);
  } else if (activeFilter !== 'all') {
    filtered = filtered.filter((item: any) => item.type === activeFilter);
  }

  // Search is deferred to the decrypted items (handled after decryptItems call)

  // Sort by most recent
  return filtered.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

// Cleanup
function destroy() {
  if (unsubItems) unsubItems();
  if (unsubVaults) unsubVaults();
}

export function getVaultStore() {
  return {
    get items() { return items; },
    get vaults() { return vaults; },
    get isLoading() { return isLoading; },
    get activeVaultType() { return activeVaultType; },
    set activeVaultType(val: VaultType) { activeVaultType = val; },
    get activeFilter() { return activeFilter; },
    set activeFilter(val: ItemType | 'all' | 'favorites') { activeFilter = val; },
    get searchQuery() { return searchQuery; },
    set searchQuery(val: string) { searchQuery = val; },
    init,
    ensurePersonalVault,
    ensureSharedVault,
    createItem,
    updateItem,
    deleteItem,
    toggleFavorite,
    getFilteredItems,
    decryptItemData,
    decryptItems,
    destroy,
  };
}
