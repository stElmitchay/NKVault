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
async function ensureSharedVault(userId: string): Promise<string> {
  const existing = vaults.find((v: any) => v.type === 'shared');
  if (existing) return existing.id;

  // The first user to create the shared vault becomes its owner. Update
  // permissions are bound to the owner. Shared distribution of items is
  // pending the per-user-wrap redesign — see security/hardening-pass-1.
  const vaultId = id();
  await db.transact(
    db.tx.vaults[vaultId].update({
      name: 'Shared',
      type: 'shared',
      ownerId: userId,
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
  if (!key) {
    throw new Error('Vault is locked — refusing to save plaintext.');
  }
  let storedData: any;
  let storedTitle: string;
  try {
    storedData = await encrypt(key, JSON.stringify(data));
    storedTitle = JSON.stringify(await encrypt(key, title));
  } catch (err) {
    // Fail closed — never persist plaintext.
    throw new Error(`Encryption failed: ${(err as Error).message}`);
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

  if ((updates.title !== undefined || updates.data !== undefined) && !key) {
    throw new Error('Vault is locked — refusing to save plaintext.');
  }

  if (updates.title && key) {
    try {
      finalUpdates.title = JSON.stringify(await encrypt(key, updates.title));
    } catch (err) {
      throw new Error(`Title encryption failed: ${(err as Error).message}`);
    }
  }

  if (updates.data !== undefined && !isEncrypted(updates.data)) {
    try {
      finalUpdates.data = await encrypt(key!, JSON.stringify(updates.data));
    } catch (err) {
      throw new Error(`Data encryption failed: ${(err as Error).message}`);
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
 * Decrypt-on-demand model
 * ----------------------
 * To bound the lifetime of plaintext in memory, we never hold the full
 * decrypted item set in a reactive store. Instead:
 *
 *   - `decryptItemsForList(rawItems)` decrypts each item's title and a
 *     small set of *non-secret* display fields needed by the list view
 *     (login username/url, card last-4, note preview, identity name).
 *     All true secrets — passwords, notes, CVVs, full card numbers —
 *     are stripped before the result reaches Svelte state.
 *
 *   - `decryptItemFull(itemId)` decrypts the title and full data of a
 *     single item, looked up by id from the raw `items` store. The
 *     caller stores the result in a single short-lived variable and
 *     clears it as soon as the user navigates away.
 *
 * See docs/THREAT_MODEL.md §5.7 / §6.
 */

/** Try decrypting an EncryptedBlob with each candidate key in turn. */
async function tryDecryptWithKeys(keys: CryptoKey[], blob: any): Promise<string | null> {
  for (const key of keys) {
    try {
      return await decrypt(key, blob);
    } catch {
      // Try next key
    }
  }
  return null;
}

function activeKeys(): CryptoKey[] {
  const out: CryptoKey[] = [];
  const vk = getVaultKey();
  const svk = getSharedVaultKey();
  if (vk) out.push(vk);
  if (svk && svk !== vk) out.push(svk);
  return out;
}

/** Decrypt the title field of an item, returning a placeholder on failure. */
async function decryptTitle(item: any, keys: CryptoKey[]): Promise<string> {
  if (typeof item.title !== 'string') return String(item.title ?? '');
  try {
    const parsed = JSON.parse(item.title);
    if (!isEncrypted(parsed)) return item.title;
    const dec = await tryDecryptWithKeys(keys, parsed);
    return dec ?? '🔒 Encrypted';
  } catch {
    // Title isn't a JSON-encoded blob → assume it's already plaintext
    // (legacy data path).
    return item.title;
  }
}

/** Decrypt the full data field of an item, or null on failure. */
async function decryptDataField(item: any, keys: CryptoKey[]): Promise<any> {
  if (!isEncrypted(item.data)) return item.data;
  for (const key of keys) {
    try {
      const plaintext = await decrypt(key, item.data);
      return JSON.parse(plaintext);
    } catch {
      // try next key
    }
  }
  return null;
}

/**
 * Build the *list-safe* projection of a single item: title plus only
 * the non-secret display fields the list view actually renders.
 * Pre-renders the subtitle and favicon so the consuming component does
 * not need access to raw secret fields like card number or note body.
 */
function projectForList(rawItem: any, decTitle: string, decData: any): any {
  const display: Record<string, unknown> = {};
  let subtitle = '';
  let faviconHost: string | null = null;

  if (decData && typeof decData === 'object') {
    switch (rawItem.type) {
      case 'login': {
        const username = typeof decData.username === 'string' ? decData.username : '';
        const url = typeof decData.url === 'string' ? decData.url : '';
        display.username = username;
        display.url = url;
        subtitle = username || url || 'No username';
        if (url) {
          try {
            faviconHost = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
          } catch {
            faviconHost = null;
          }
        }
        break;
      }
      case 'card': {
        const num = typeof decData.number === 'string' ? decData.number : '';
        // Pre-render the masked last-4. The full number never leaves
        // this scope — it is NOT placed on `display`.
        subtitle = num ? `•••• ${num.slice(-4)}` : 'No card number';
        break;
      }
      case 'note': {
        const content = typeof decData.content === 'string' ? decData.content : '';
        // Cap the preview at 50 chars; the rest stays out of memory
        // for the list view.
        subtitle = content ? content.substring(0, 50) : 'Empty note';
        break;
      }
      case 'identity': {
        const fn = typeof decData.firstName === 'string' ? decData.firstName : '';
        const ln = typeof decData.lastName === 'string' ? decData.lastName : '';
        display.firstName = fn;
        display.lastName = ln;
        subtitle = [fn, ln].filter(Boolean).join(' ') || 'No name';
        break;
      }
    }
  }

  return {
    id: rawItem.id,
    title: decTitle,
    type: rawItem.type,
    favorite: !!rawItem.favorite,
    createdAt: rawItem.createdAt,
    updatedAt: rawItem.updatedAt,
    vaultId: rawItem.vaultId,
    data: display,         // non-secret display fields only
    _subtitle: subtitle,   // pre-rendered for ItemList
    _faviconHost: faviconHost, // pre-rendered favicon source
  };
}

/**
 * Decrypt the *list view* of the given raw items. Strips all secret
 * fields. Returns objects safe to put in long-lived reactive state.
 */
async function decryptItemsForList(rawItems: any[]): Promise<any[]> {
  const keys = activeKeys();
  if (keys.length === 0) {
    // Vault is locked — render placeholders rather than raw ciphertext.
    return rawItems.map((item) => ({
      id: item.id,
      title: '🔒 Encrypted',
      type: item.type,
      favorite: !!item.favorite,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      vaultId: item.vaultId,
      data: {},
      _subtitle: '',
      _faviconHost: null,
    }));
  }

  return Promise.all(
    rawItems.map(async (item) => {
      const [decTitle, decData] = await Promise.all([
        decryptTitle(item, keys),
        decryptDataField(item, keys),
      ]);
      return projectForList(item, decTitle, decData);
    })
  );
}

/**
 * Decrypt one item's full plaintext (title + complete data). Looked up
 * by id from the raw `items` store so that callers do not need to keep
 * an encrypted blob around. Returns null if the item no longer exists
 * or cannot be decrypted with any active key.
 *
 * The returned object is the *only* place a fully-decrypted item should
 * live in memory — store it in a single short-lived variable and clear
 * it as soon as the user navigates away.
 */
/**
 * Decrypt EVERY item's full plaintext. Intended SOLELY for the user-
 * initiated export flow in SettingsPanel — that's the one place where
 * the user has explicitly asked for an in-memory dump of the entire
 * vault. Do not call this from any other surface.
 */
async function decryptAllForExport(): Promise<Array<{
  title: string;
  type: string;
  data: any;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}>> {
  const keys = activeKeys();
  if (keys.length === 0) return [];
  return Promise.all(
    items.map(async (item: any) => {
      const [decTitle, decData] = await Promise.all([
        decryptTitle(item, keys),
        decryptDataField(item, keys),
      ]);
      return {
        title: decTitle,
        type: item.type,
        data: decData,
        favorite: !!item.favorite,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    })
  );
}

async function decryptItemFull(itemId: string): Promise<{ title: string; data: any } | null> {
  const raw = items.find((i: any) => i.id === itemId);
  if (!raw) return null;
  const keys = activeKeys();
  if (keys.length === 0) return null;
  const [decTitle, decData] = await Promise.all([
    decryptTitle(raw, keys),
    decryptDataField(raw, keys),
  ]);
  if (decData == null) return null;
  return { title: decTitle, data: decData };
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
    decryptItemsForList,
    decryptItemFull,
    decryptAllForExport,
    destroy,
  };
}
