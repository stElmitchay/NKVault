<script lang="ts">
  import '../app.css';
  import { getAuth } from '$lib/stores/auth.svelte';
  import { getCryptoStore } from '$lib/stores/crypto.svelte';
  import { getSettings } from '$lib/stores/settings.svelte';
  import LoginForm from '$lib/components/LoginForm.svelte';
  import WalletSetup from '$lib/components/WalletSetup.svelte';
  import WalletUnlock from '$lib/components/WalletUnlock.svelte';

  const auth = getAuth();
  const cryptoStore = getCryptoStore();
  const settings = getSettings();

  let { children } = $props();

  // Subscribe to profile when user is available
  $effect(() => {
    if (auth.user) {
      cryptoStore.subscribeToProfile(auth.user.id);
    }
  });

  // ---- Browser Extension Lock-State Bridge ----
  // The vault key is NEVER broadcast to the extension via postMessage —
  // any iframe on the page would receive it. Instead, the extension
  // derives its own copy via the wallet signature path. We only signal
  // lock-state transitions here, scoped to the current origin.
  $effect(() => {
    if (typeof window === 'undefined') return;
    const unlocked = cryptoStore.isVaultUnlocked;
    if (auth.user && !unlocked) {
      window.postMessage({ type: 'NKVAULT_VAULT_LOCKED' }, window.location.origin);
    }
  });
</script>

<svelte:head>
  <title>NKVault — NO-Knowledge Vault</title>
</svelte:head>

<svelte:window
  onkeydown={(e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.querySelector<HTMLInputElement>('#search-input');
      searchInput?.focus();
    }
  }}
/>

{#if !auth.isLoading && !auth.user}
  <LoginForm />

{:else if auth.user && !cryptoStore.profileLoading && !cryptoStore.hasCompletedSetup()}
  <WalletSetup
    userId={auth.user.id}
    userEmail={auth.user.email}
    onComplete={() => {}}
  />

{:else if auth.user && !cryptoStore.profileLoading && !cryptoStore.isVaultUnlocked}
  <WalletUnlock
    userEmail={auth.user.email}
    storedWalletAddress={cryptoStore.getStoredWalletAddress() || ''}
  />

{:else if auth.user && !cryptoStore.profileLoading && cryptoStore.isVaultUnlocked}
  {@render children()}
{/if}
