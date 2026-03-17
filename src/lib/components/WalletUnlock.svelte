<script lang="ts">
  import { detectWallets, connectWallet, getWalletAddress, truncateAddress, type DetectedWallet } from '$lib/crypto/wallet';
  import { getCryptoStore } from '$lib/stores/crypto.svelte';
  import Icon from './Icon.svelte';

  interface Props {
    userEmail: string;
    storedWalletAddress: string;
  }

  let { userEmail, storedWalletAddress }: Props = $props();

  const cryptoStore = getCryptoStore();

  let detectedWallet = $state<DetectedWallet | null>(null);
  let connectedAddress = $state<string | null>(null);
  let isConnecting = $state(false);
  let isUnlocking = $state(false);
  let noWalletFound = $state(false);
  let addressMismatch = $state(false);
  let connectError = $state<string | null>(null);

  // Auto-detect and attempt connection on mount
  $effect(() => {
    const timer = setTimeout(async () => {
      const wallets = detectWallets();
      if (wallets.length > 0) {
        detectedWallet = wallets[0];
        noWalletFound = false;

        // If already connected (Phantom auto-connects on revisit)
        const addr = getWalletAddress(wallets[0].provider);
        if (addr) {
          connectedAddress = addr;
          addressMismatch = !!storedWalletAddress && addr !== storedWalletAddress;
        }
      } else {
        noWalletFound = true;
      }
    }, 300);
    return () => clearTimeout(timer);
  });

  async function handleConnect() {
    if (!detectedWallet) return;
    isConnecting = true;
    addressMismatch = false;

    try {
      const address = await connectWallet(detectedWallet.provider);
      connectedAddress = address;
      connectError = null;

      if (storedWalletAddress && address !== storedWalletAddress) {
        addressMismatch = true;
      }
    } catch (err: any) {
      console.error('Wallet connection failed:', err);
      connectError = err?.message || 'Failed to connect wallet. Try refreshing the page.';
    } finally {
      isConnecting = false;
    }
  }

  async function handleUnlock() {
    if (!detectedWallet || addressMismatch) return;
    isUnlocking = true;

    try {
      await cryptoStore.unlockWithWallet(userEmail, detectedWallet.provider);
    } catch (err: any) {
      console.error('Unlock failed:', err);
    } finally {
      isUnlocking = false;
    }
  }

  function retryDetection() {
    const wallets = detectWallets();
    if (wallets.length > 0) {
      detectedWallet = wallets[0];
      noWalletFound = false;
    }
  }
</script>

<div class="wallet-unlock fade-in">
  <div class="unlock-card glass-solid">
    <div class="unlock-header">
      <img src="/logo-green.png" alt="NKVault" class="unlock-logo logo-dark" />
      <img src="/logo-coral.png" alt="NKVault" class="unlock-logo logo-light" />
      <h1>Welcome Back</h1>
      <p class="unlock-email">{userEmail}</p>
    </div>

    {#if noWalletFound}
      <!-- No wallet detected -->
      <div class="no-wallet-state">
        <p class="no-wallet-title">No wallet detected</p>
        <p class="no-wallet-desc">Install a Solana wallet to unlock your vault</p>
        <a href="https://phantom.app" target="_blank" rel="noopener" class="install-link">
          Install Phantom →
        </a>
        <button class="btn btn-secondary btn-sm" onclick={retryDetection}>
          <Icon name="refresh-cw" size={14} /> Retry
        </button>
      </div>

    {:else if addressMismatch && connectedAddress}
      <!-- Wrong wallet -->
      <div class="mismatch-state">
        <div class="mismatch-icon">⚠️</div>
        <p class="mismatch-title">Wrong Wallet</p>
        <p class="mismatch-desc">
          Your vault is linked to <strong>{truncateAddress(storedWalletAddress)}</strong>
          but <strong>{truncateAddress(connectedAddress)}</strong> is connected.
        </p>
        <p class="mismatch-hint">
          Switch to the correct wallet in your extension and retry.
        </p>
        <button class="btn btn-secondary" onclick={() => { connectedAddress = null; addressMismatch = false; }}>
          <Icon name="refresh-cw" size={14} /> Retry
        </button>
      </div>

    {:else if connectedAddress && !addressMismatch}
      <!-- Wallet connected & matches — unlock ready -->
      <div class="unlock-ready">
        <div class="wallet-badge">
          <span class="wallet-icon">{detectedWallet?.icon}</span>
          <div class="wallet-info">
            <span class="wallet-label">{detectedWallet?.name}</span>
            <span class="wallet-addr">{truncateAddress(connectedAddress)}</span>
          </div>
          <div class="connected-check">✓</div>
        </div>

        <button
          class="btn btn-primary btn-unlock"
          onclick={handleUnlock}
          disabled={isUnlocking}
          id="unlock-btn"
        >
          {#if isUnlocking}
            <span class="btn-spinner"></span> Unlocking...
          {:else}
            <Icon name="lock" size={18} /> Unlock Vault
          {/if}
        </button>

        <p class="unlock-hint">
          Signs a message to derive your encryption key — no transaction, no cost.
        </p>
      </div>

    {:else}
      <!-- Wallet detected but not connected -->
      <div class="connect-state">
        {#if detectedWallet}
          <div class="detected-badge">
            <span class="detected-icon">{detectedWallet.icon}</span>
            <span>{detectedWallet.name} detected</span>
          </div>
        {/if}

        <button
          class="btn btn-primary btn-connect"
          onclick={handleConnect}
          disabled={isConnecting}
        >
          {#if isConnecting}
            <span class="btn-spinner"></span> Connecting...
          {:else}
            <Icon name="zap" size={18} /> Connect Wallet
          {/if}
        </button>
      </div>
    {/if}

    {#if connectError}
      <div class="error-msg">{connectError}</div>
    {/if}

    {#if cryptoStore.unlockError}
      <div class="error-msg">{cryptoStore.unlockError}</div>
      <div class="reset-section">
        <p class="reset-hint">
          If you're migrating from the old password-based vault, reset it to link your wallet.
        </p>
        <button class="btn btn-secondary btn-sm" onclick={() => cryptoStore.resetProfile()}>
          <Icon name="refresh-cw" size={14} /> Reset & Re-link Wallet
        </button>
      </div>
    {/if}

  </div>
</div>

<style>
  .wallet-unlock {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-lg);
  }

  .unlock-card {
    width: 100%;
    max-width: 440px;
    padding: var(--space-2xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  .unlock-header {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
  }

  .unlock-logo {
    height: 72px;
    width: 72px;
    object-fit: contain;
    margin-bottom: var(--space-sm);
    animation: pulse 2s ease-in-out infinite;
  }

  .logo-light {
    display: none;
  }

  :global([data-theme="light"]) .logo-dark {
    display: none;
  }

  :global([data-theme="light"]) .logo-light {
    display: block;
  }

  .unlock-header h1 {
    font-size: var(--font-xl);
    font-weight: 700;
    color: var(--color-accent);
  }

  .unlock-email {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
  }

  /* Connect state — single button */
  .connect-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
  }

  .detected-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 6px 14px;
    border-radius: var(--radius-full);
    background: var(--color-primary-subtle);
    font-size: var(--font-xs);
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .detected-icon {
    font-size: 16px;
  }

  .btn-connect {
    width: 100%;
    padding: 16px 24px;
    font-size: var(--font-base);
    font-weight: 600;
    border-radius: var(--radius-md);
    gap: var(--space-sm);
  }

  /* Unlock ready state */
  .unlock-ready {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    align-items: center;
  }

  .wallet-badge {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: 14px 18px;
    border-radius: var(--radius-md);
    background: var(--color-primary-subtle);
    border: 1px solid var(--color-primary-light);
    width: 100%;
  }

  .wallet-icon {
    font-size: 24px;
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.6);
    border-radius: var(--radius-sm);
  }

  .wallet-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .wallet-label {
    font-size: var(--font-sm);
    font-weight: 600;
    color: var(--color-accent);
  }

  .wallet-addr {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    font-family: monospace;
  }

  .connected-check {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--color-success);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
  }

  .btn-unlock {
    width: 100%;
    padding: 16px 24px;
    font-size: var(--font-base);
    font-weight: 600;
    border-radius: var(--radius-md);
    gap: var(--space-sm);
  }

  .unlock-hint {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    text-align: center;
  }

  /* No wallet */
  .no-wallet-state {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md) 0;
  }

  .no-wallet-title {
    font-size: var(--font-base);
    font-weight: 600;
    color: var(--color-text);
  }

  .no-wallet-desc {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
  }

  .install-link {
    font-size: var(--font-sm);
    color: var(--color-primary-dark);
    font-weight: 500;
    text-decoration: underline;
  }

  .btn-sm {
    padding: 6px 14px;
    font-size: var(--font-xs);
  }

  /* Mismatch state */
  .mismatch-state {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md) 0;
  }

  .mismatch-icon {
    font-size: 36px;
  }

  .mismatch-title {
    font-size: var(--font-lg);
    font-weight: 600;
    color: var(--color-warning);
  }

  .mismatch-desc {
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
    line-height: 1.6;
  }

  .mismatch-desc strong {
    font-family: monospace;
    color: var(--color-text);
  }

  .mismatch-hint {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
  }

  /* Error */
  .error-msg {
    padding: 12px 16px;
    border-radius: var(--radius-sm);
    background: rgba(220, 53, 69, 0.1);
    color: var(--color-danger);
    font-size: var(--font-sm);
    text-align: center;
  }

  .reset-section {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) 0;
  }

  .reset-hint {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    line-height: 1.5;
  }

  .btn-sm {
    padding: 6px 14px;
    font-size: var(--font-xs);
  }


  .btn-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 768px) {
    .unlock-card {
      padding: var(--space-xl);
    }
  }
</style>
