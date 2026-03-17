<script lang="ts">
  import '../app.css';
  import { getAuth } from '$lib/stores/auth.svelte';
  import { getCryptoStore } from '$lib/stores/crypto.svelte';
  import { getSettings } from '$lib/stores/settings.svelte';
  import { getVaultKey } from '$lib/crypto/session';
  import { exportKey } from '$lib/crypto/keys';
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

  // ---- Browser Extension Auth Sync Bridge ----
  // Broadcasts auth state and vault key to the NKVault extension
  // via window.postMessage. The content script listens for these
  // messages and forwards them to the background service worker.
  $effect(() => {
    const user = auth.user;
    const unlocked = cryptoStore.isVaultUnlocked;

    if (user && unlocked) {
      // Export vault key and broadcast to the extension
      const key = getVaultKey();
      if (key) {
        exportKey(key).then((rawBytes) => {
          // Convert to base64
          let binary = '';
          for (let i = 0; i < rawBytes.length; i++) {
            binary += String.fromCharCode(rawBytes[i]);
          }
          const keyBase64 = btoa(binary);

          // Send auth info
          window.postMessage({
            type: 'NKVAULT_AUTH_SYNC',
            token: 'session-active',
            refreshToken: '',
            user: { id: user.id, email: user.email },
          }, '*');

          // Send vault key
          window.postMessage({
            type: 'NKVAULT_VAULT_KEY_SYNC',
            keyBase64,
          }, '*');
        });
      }
    } else if (user && !unlocked) {
      // Vault was locked — notify extension
      window.postMessage({
        type: 'NKVAULT_VAULT_LOCKED',
      }, '*');
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
