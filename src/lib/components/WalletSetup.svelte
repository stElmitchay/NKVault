<script lang="ts">
  import { detectWallets, connectWallet, getWalletAddress, truncateAddress, type DetectedWallet } from '$lib/crypto/wallet';
  import { getCryptoStore } from '$lib/stores/crypto.svelte';
  import Icon from './Icon.svelte';

  interface Props {
    userId: string;
    userEmail: string;
    onComplete: () => void;
  }

  let { userId, userEmail, onComplete }: Props = $props();

  const cryptoStore = getCryptoStore();

  let detectedWallet = $state<DetectedWallet | null>(null);
  let walletAddress = $state<string | null>(null);
  let isConnecting = $state(false);
  let isSettingUp = $state(false);
  let noWalletFound = $state(false);
  let step = $state<'initial' | 'connected'>('initial');

  // Auto-detect wallet on mount
  $effect(() => {
    const timer = setTimeout(() => {
      const wallets = detectWallets();
      if (wallets.length > 0) {
        detectedWallet = wallets[0]; // Auto-pick first available
        noWalletFound = false;

        // If already connected (e.g. Phantom auto-connects), grab address
        const addr = getWalletAddress(wallets[0].provider);
        if (addr) {
          walletAddress = addr;
          step = 'connected';
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

    try {
      const address = await connectWallet(detectedWallet.provider);
      walletAddress = address;
      step = 'connected';
    } catch (err: any) {
      console.error('Wallet connection failed:', err);
    } finally {
      isConnecting = false;
    }
  }

  async function handleSetup() {
    if (!detectedWallet || !walletAddress) return;
    isSettingUp = true;

    try {
      await cryptoStore.setupWithWallet(userId, userEmail, detectedWallet.provider, walletAddress);
      onComplete();
    } catch (err: any) {
      console.error('Wallet setup failed:', err);
    } finally {
      isSettingUp = false;
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

<div class="wallet-setup fade-in">
  <div class="setup-card glass-solid">
    <div class="setup-header">
      <img src="/logo-green.png" alt="NKVault" class="setup-logo logo-dark" />
      <img src="/logo-coral.png" alt="NKVault" class="setup-logo logo-light" />
      <h1>Secure Your Vault</h1>
      <p class="setup-subtitle">
        Connect your Solana wallet to create your encryption key.<br />
        No master password needed — your wallet <em>is</em> the key.
      </p>
    </div>

    {#if noWalletFound}
      <!-- No wallet extension detected -->
      <div class="no-wallet-state">
        <div class="no-wallet-icon">🔌</div>
        <p class="no-wallet-title">No wallet detected</p>
        <p class="no-wallet-desc">
          Install a Solana wallet extension to continue
        </p>
        <div class="install-links">
          <a href="https://phantom.app" target="_blank" rel="noopener" class="install-link">
            <span class="install-emoji">👻</span> Phantom
          </a>
          <a href="https://solflare.com" target="_blank" rel="noopener" class="install-link">
            <span class="install-emoji">🔆</span> Solflare
          </a>
          <a href="https://backpack.app" target="_blank" rel="noopener" class="install-link">
            <span class="install-emoji">🎒</span> Backpack
          </a>
        </div>
        <button class="btn btn-secondary" onclick={retryDetection}>
          <Icon name="refresh-cw" size={14} /> Retry Detection
        </button>
      </div>

    {:else if step === 'initial'}
      <!-- Wallet detected, ready to connect -->
      <div class="connect-state">
        {#if detectedWallet}
          <div class="detected-badge fade-in">
            <span class="detected-icon">{detectedWallet.icon}</span>
            <span class="detected-text">{detectedWallet.name} detected</span>
          </div>
        {/if}

        <button
          class="btn btn-primary btn-connect"
          onclick={handleConnect}
          disabled={isConnecting || !detectedWallet}
        >
          {#if isConnecting}
            <span class="btn-spinner"></span> Connecting...
          {:else}
            <Icon name="zap" size={18} /> Connect Wallet
          {/if}
        </button>
      </div>

    {:else if step === 'connected'}
      <!-- Connected, ready to set up vault -->
      <div class="connected-state">
        <div class="wallet-badge">
          <span class="wallet-icon-lg">{detectedWallet?.icon}</span>
          <div class="wallet-info">
            <span class="wallet-label">{detectedWallet?.name} Connected</span>
            <span class="wallet-addr">{walletAddress ? truncateAddress(walletAddress) : ''}</span>
          </div>
          <div class="connected-check">✓</div>
        </div>

        <div class="sign-explainer">
          <div class="explainer-item">
            <Icon name="shield" size={16} />
            <span>Your wallet will sign a message to create your encryption key</span>
          </div>
          <div class="explainer-item">
            <Icon name="zap" size={16} />
            <span>No transaction — zero SOL cost</span>
          </div>
          <div class="explainer-item">
            <Icon name="lock" size={16} />
            <span>Your private key never leaves your wallet</span>
          </div>
        </div>

        <button
          class="btn btn-primary btn-setup"
          onclick={handleSetup}
          disabled={isSettingUp}
        >
          {#if isSettingUp}
            <span class="btn-spinner"></span> Creating Vault...
          {:else}
            <Icon name="lock" size={16} /> Set Up Vault
          {/if}
        </button>
      </div>
    {/if}

    {#if cryptoStore.setupError}
      <div class="error-msg">{cryptoStore.setupError}</div>
    {/if}

    <div class="setup-footer">
      <p>Signed in as <strong>{userEmail}</strong></p>
    </div>
  </div>
</div>

<style>
  .wallet-setup {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-lg);
  }

  .setup-card {
    width: 100%;
    max-width: 480px;
    padding: var(--space-2xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  .setup-header {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
  }

  .setup-logo {
    height: 80px;
    width: 80px;
    object-fit: contain;
    margin-bottom: var(--space-sm);
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

  .setup-header h1 {
    font-size: var(--font-xl);
    font-weight: 700;
    color: var(--color-accent);
  }

  .setup-subtitle {
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
    line-height: 1.6;
  }

  .setup-subtitle em {
    color: var(--color-primary-dark);
    font-style: normal;
    font-weight: 600;
  }

  /* Connect state */
  .connect-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-lg);
  }

  .detected-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 8px 16px;
    border-radius: var(--radius-full);
    background: var(--color-primary-subtle);
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
  }

  .detected-icon {
    font-size: 18px;
  }

  .detected-text {
    font-weight: 500;
  }

  .btn-connect {
    width: 100%;
    padding: 16px 24px;
    font-size: var(--font-base);
    font-weight: 600;
    border-radius: var(--radius-md);
    gap: var(--space-sm);
  }

  /* No wallet */
  .no-wallet-state {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) 0;
  }

  .no-wallet-icon {
    font-size: 40px;
    opacity: 0.6;
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

  .install-links {
    display: flex;
    gap: var(--space-md);
    flex-wrap: wrap;
    justify-content: center;
  }

  .install-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: var(--radius-full);
    background: var(--color-surface);
    border: 1px solid var(--glass-border);
    font-size: var(--font-sm);
    font-weight: 500;
    color: var(--color-text);
    text-decoration: none;
    transition: all var(--transition-fast);
  }

  .install-link:hover {
    background: var(--color-surface-hover);
    border-color: var(--color-primary);
    transform: translateY(-1px);
  }

  .install-emoji {
    font-size: 16px;
  }

  /* Connected state */
  .connected-state {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .wallet-badge {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: 16px 20px;
    border-radius: var(--radius-md);
    background: var(--color-primary-subtle);
    border: 1px solid var(--color-primary-light);
  }

  .wallet-icon-lg {
    font-size: 28px;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
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
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--color-success);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
  }

  /* Sign explainer */
  .sign-explainer {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .explainer-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
  }

  /* Setup button */
  .btn-setup {
    width: 100%;
    padding: 14px 24px;
    font-size: var(--font-base);
    font-weight: 600;
    border-radius: var(--radius-md);
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

  /* Error */
  .error-msg {
    padding: 12px 16px;
    border-radius: var(--radius-sm);
    background: rgba(220, 53, 69, 0.1);
    color: var(--color-danger);
    font-size: var(--font-sm);
    text-align: center;
  }

  /* Footer */
  .setup-footer {
    text-align: center;
    padding-top: var(--space-md);
    border-top: 1px solid var(--glass-border);
  }

  .setup-footer p {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
  }

  .setup-footer strong {
    color: var(--color-text-secondary);
  }

  @media (max-width: 768px) {
    .setup-card {
      padding: var(--space-xl);
    }
  }
</style>
