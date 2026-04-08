<script lang="ts">
  import { getCryptoStore } from '$lib/stores/crypto.svelte';
  import { getSettings } from '$lib/stores/settings.svelte';
  import { getAuth } from '$lib/stores/auth.svelte';
  import { getVaultStore } from '$lib/stores/vault.svelte';
  import { encrypt, isEncrypted } from '$lib/crypto/aes';
  import { getVaultKey } from '$lib/crypto/session';
  import { truncateAddress } from '$lib/crypto/wallet';
  import Icon from './Icon.svelte';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  const cryptoStore = getCryptoStore();
  const settings = getSettings();
  const auth = getAuth();
  const vault = getVaultStore();

  // Migration state
  let isMigrating = $state(false);
  let migrationResult = $state('');

  // Export state
  let isExporting = $state(false);

  let walletAddress = $derived(cryptoStore.getStoredWalletAddress());

  async function handleMigrateItems() {
    const vaultKey = getVaultKey();
    if (!vaultKey || !auth.user) return;

    isMigrating = true;
    migrationResult = '';

    try {
      const allItems = vault.items;
      let migrated = 0;

      for (const item of allItems) {
        if (!isEncrypted(item.data)) {
          const encryptedData = await encrypt(vaultKey, JSON.stringify(item.data));
          await vault.updateItem(item.id, { data: encryptedData as any });
          migrated++;
        }
      }

      migrationResult = migrated > 0
        ? `✓ ${migrated} item(s) encrypted successfully.`
        : '✓ All items are already encrypted.';
    } catch (err: any) {
      migrationResult = `✗ Migration failed: ${err.message}`;
    } finally {
      isMigrating = false;
    }
  }

  async function handleExport() {
    isExporting = true;
    try {
      // User-initiated full export — this is the one place we
      // intentionally pull every item's plaintext into memory.
      const decrypted = await vault.decryptAllForExport();
      const exportData = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        itemCount: decrypted.length,
        items: decrypted,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nkvault-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      isExporting = false;
    }
  }

  function handleLock() {
    cryptoStore.lockVault();
  }
</script>

<div class="settings-panel fade-in">
  <div class="settings-header">
    <h2>Settings</h2>
    <button class="btn btn-ghost" onclick={onClose}>
      <Icon name="x" size={18} />
    </button>
  </div>

  <div class="settings-sections">
    <!-- Appearance -->
    <div class="settings-section">
      <h3>Appearance</h3>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Dark Mode</span>
          <span class="setting-desc">Switch between light and dark theme</span>
        </div>
        <button
          class="toggle-switch"
          class:active={settings.darkMode}
          onclick={settings.toggleDarkMode}
          aria-label="Toggle dark mode"
        >
          <span class="toggle-knob"></span>
        </button>
      </div>
    </div>

    <!-- Security -->
    <div class="settings-section">
      <h3>Security</h3>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Connected Wallet</span>
          <span class="setting-desc">
            {walletAddress ? truncateAddress(walletAddress) : 'Not linked'}
          </span>
        </div>
        <div class="wallet-badge-sm">
          <Icon name="shield" size={14} /> Solana
        </div>
      </div>

      <button class="setting-action-btn" onclick={handleLock}>
        <Icon name="lock" size={16} />
        <span>Lock Vault</span>
        <Icon name="chevron-right" size={14} />
      </button>
    </div>

    <!-- Data -->
    <div class="settings-section">
      <h3>Data</h3>

      <button class="setting-action-btn" onclick={handleMigrateItems} disabled={isMigrating}>
        <Icon name="shield" size={16} />
        <span>{isMigrating ? 'Encrypting...' : 'Encrypt Plaintext Items'}</span>
        <Icon name="chevron-right" size={14} />
      </button>

      {#if migrationResult}
        <div class="setting-info-text fade-in">{migrationResult}</div>
      {/if}

      <button class="setting-action-btn" onclick={handleExport} disabled={isExporting}>
        <Icon name="download" size={16} />
        <span>{isExporting ? 'Exporting...' : 'Export Vault Data'}</span>
        <Icon name="chevron-right" size={14} />
      </button>
    </div>

    <!-- Sort -->
    <div class="settings-section">
      <h3>Display</h3>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Sort By</span>
        </div>
        <select class="select select-sm" value={settings.sortBy} onchange={(e) => settings.setSortBy((e.target as HTMLSelectElement).value as any)}>
          <option value="updated">Last Updated</option>
          <option value="created">Created Date</option>
          <option value="name">Name</option>
          <option value="type">Type</option>
        </select>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Sort Order</span>
        </div>
        <select class="select select-sm" value={settings.sortDir} onchange={(e) => settings.setSortDir((e.target as HTMLSelectElement).value as any)}>
          <option value="desc">Newest First</option>
          <option value="asc">Oldest First</option>
        </select>
      </div>
    </div>

    <!-- About -->
    <div class="settings-section">
      <h3>About</h3>
      <div class="about-info">
        <p><strong>NKVault</strong> v0.1.0</p>
        <p class="about-desc">NO-Knowledge Vault — Zero-knowledge password manager for Christex Foundation</p>
        <p class="about-desc">Encryption: AES-256-GCM · Key: Solana Wallet Signature</p>
      </div>
    </div>
  </div>
</div>

<style>
  .settings-panel {
    padding: var(--space-lg);
  }

  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-xl);
  }

  .settings-header h2 {
    font-size: var(--font-xl);
    font-weight: 600;
  }

  .settings-sections {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  .settings-section h3 {
    font-size: var(--font-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--color-text-muted);
    margin-bottom: var(--space-md);
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid var(--glass-border);
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .setting-label {
    font-size: var(--font-sm);
    font-weight: 500;
    color: var(--color-text);
  }

  .setting-desc {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
  }

  .toggle-switch {
    width: 44px;
    height: 24px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.12);
    position: relative;
    transition: background var(--transition-fast);
    cursor: pointer;
    border: none;
    padding: 0;
  }

  .toggle-switch.active {
    background: var(--color-primary);
  }

  .toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--color-surface-solid);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform var(--transition-fast);
  }

  .toggle-switch.active .toggle-knob {
    transform: translateX(20px);
  }

  .setting-action-btn {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: 12px var(--space-sm);
    border-radius: var(--radius-md);
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
    transition: all var(--transition-fast);
    text-align: left;
    cursor: pointer;
    border: none;
    background: none;
  }

  .setting-action-btn span {
    flex: 1;
  }

  .setting-action-btn:hover {
    background: rgba(255, 255, 255, 0.04);
    color: var(--color-text);
  }

  .setting-action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .wallet-badge-sm {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-xs);
    color: var(--color-primary-dark);
    background: var(--color-primary-subtle);
    padding: 4px 10px;
    border-radius: var(--radius-full);
    font-weight: 500;
  }

  .setting-info-text {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    padding: 4px var(--space-sm);
  }

  .select-sm {
    width: auto;
    padding: 6px 28px 6px 10px;
    font-size: var(--font-xs);
    min-width: 140px;
  }

  .about-info p {
    font-size: var(--font-sm);
    color: var(--color-text);
    margin-bottom: 4px;
  }

  .about-desc {
    font-size: var(--font-xs) !important;
    color: var(--color-text-muted) !important;
  }
</style>
