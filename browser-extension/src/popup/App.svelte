<script lang="ts">
  import { onMount } from 'svelte';
  import Header from './components/Header.svelte';
  import SearchBar from './components/SearchBar.svelte';
  import VaultList from './components/VaultList.svelte';
  import ItemDetail from './components/ItemDetail.svelte';
  import PasswordGenerator from './components/PasswordGenerator.svelte';
  import LockedScreen from './components/LockedScreen.svelte';
  import Footer from './components/Footer.svelte';
  import type { AuthStatusResponse } from '$ext/shared/messages';

  // State
  let isLoading = $state(true);
  let authStatus = $state<AuthStatusResponse | null>(null);
  let items = $state<any[]>([]);
  let searchQuery = $state('');
  let activeFilter = $state<string>('all');
  let selectedItem = $state<any | null>(null);
  let showGenerator = $state(false);
  let currentUrl = $state('');
  let toast = $state<string | null>(null);

  let filteredItems = $derived(() => {
    let result = items;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.title?.toLowerCase().includes(q) ||
        item.data?.username?.toLowerCase().includes(q) ||
        item.data?.url?.toLowerCase().includes(q)
      );
    }
    return result;
  });

  // Items that match the current tab URL (shown first)
  let matchingItems = $derived(() => {
    if (!currentUrl) return [];
    try {
      const host = new URL(currentUrl).hostname.replace(/^www\./, '');
      return items.filter(item => {
        if (item.type !== 'login' || !item.data?.url) return false;
        try {
          const itemHost = new URL(
            item.data.url.startsWith('http') ? item.data.url : `https://${item.data.url}`
          ).hostname.replace(/^www\./, '');
          return host === itemHost;
        } catch { return false; }
      });
    } catch { return []; }
  });

  onMount(async () => {
    // Get auth status
    chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' }, (response: AuthStatusResponse) => {
      authStatus = response;
      isLoading = false;

      if (response?.authenticated && response?.vaultUnlocked) {
        loadItems();
      }
    });

    // Get current tab URL
    chrome.runtime.sendMessage({ type: 'GET_CURRENT_URL' }, (response) => {
      if (response?.url) currentUrl = response.url;
    });
  });

  function loadItems(filter?: string) {
    chrome.runtime.sendMessage(
      { type: 'GET_VAULT_ITEMS', filter: filter || activeFilter },
      (response) => {
        if (response?.items) {
          items = response.items;
        }
      }
    );
  }

  function handleFilterChange(filter: string) {
    activeFilter = filter;
    selectedItem = null;
    showGenerator = false;
    loadItems(filter);
  }

  function handleSelectItem(item: any) {
    selectedItem = item;
    showGenerator = false;
  }

  function handleBack() {
    selectedItem = null;
    showGenerator = false;
  }

  function handleOpenGenerator() {
    showGenerator = true;
    selectedItem = null;
  }

  function handleLock() {
    chrome.runtime.sendMessage({ type: 'LOCK_VAULT' }, () => {
      authStatus = { ...authStatus!, vaultUnlocked: false };
      items = [];
      selectedItem = null;
    });
  }

  function handleOpenWebApp() {
    chrome.tabs.create({ url: 'http://localhost:5173' });
    window.close();
  }

  function showToast(msg: string) {
    toast = msg;
    setTimeout(() => { toast = null; }, 2000);
  }

  async function handleAutofill(item: any) {
    // Send autofill to the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'NKVAULT_AUTOFILL',
        username: item.data?.username || '',
        password: item.data?.password || '',
      });
      showToast('Credentials filled!');
      setTimeout(() => window.close(), 800);
    }
  }

  async function handleCopy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied`);
      // Auto-clear after 30s
      setTimeout(async () => {
        try {
          const current = await navigator.clipboard.readText();
          if (current === text) await navigator.clipboard.writeText('');
        } catch {}
      }, 30000);
    } catch {}
  }
</script>

<div class="popup-app">
  {#if isLoading}
    <div class="loading-screen">
      <div class="loading-logo">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#B8FF00" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          <circle cx="12" cy="16.5" r="1.5" fill="#B8FF00" stroke="none"/>
        </svg>
      </div>
      <div class="loading-spinner"></div>
    </div>
  {:else if !authStatus?.authenticated}
    <LockedScreen onOpenWebApp={handleOpenWebApp} mode="unauthenticated" />
  {:else if !authStatus?.vaultUnlocked}
    <LockedScreen onOpenWebApp={handleOpenWebApp} mode="locked" />
  {:else}
    <!-- Authenticated & Unlocked -->
    {#if selectedItem}
      <ItemDetail
        item={selectedItem}
        onBack={handleBack}
        onCopy={handleCopy}
        onAutofill={handleAutofill}
      />
    {:else if showGenerator}
      <Header
        userEmail={authStatus.user?.email || ''}
        onLock={handleLock}
        onOpenWebApp={handleOpenWebApp}
      />
      <PasswordGenerator onBack={handleBack} onCopy={handleCopy} />
    {:else}
      <Header
        userEmail={authStatus.user?.email || ''}
        onLock={handleLock}
        onOpenWebApp={handleOpenWebApp}
      />

      <SearchBar bind:value={searchQuery} />

      {#if matchingItems().length > 0 && !searchQuery}
        <div class="url-matches">
          <div class="section-label">
            <span class="dot"></span>
            Suggested for this site
          </div>
          {#each matchingItems() as item (item.id)}
            <button class="suggestion-row" onclick={() => handleAutofill(item)}>
              <div class="suggestion-icon">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${new URL(currentUrl).hostname}&sz=32`}
                  alt=""
                  onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <div class="suggestion-info">
                <span class="suggestion-title">{item.title}</span>
                <span class="suggestion-sub">{item.data?.username || ''}</span>
              </div>
              <span class="autofill-tag">Autofill</span>
            </button>
          {/each}
        </div>
      {/if}

      <VaultList
        items={filteredItems()}
        activeFilter={activeFilter}
        onSelect={handleSelectItem}
        onFilterChange={handleFilterChange}
      />

      <Footer
        onOpenGenerator={handleOpenGenerator}
        onOpenWebApp={handleOpenWebApp}
      />
    {/if}
  {/if}

  {#if toast}
    <div class="toast">{toast}</div>
  {/if}
</div>

<style>
  .popup-app {
    display: flex;
    flex-direction: column;
    height: 520px;
    max-height: 580px;
    overflow: hidden;
    position: relative;
  }

  .loading-screen {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
  }

  .loading-logo {
    animation: glowPulse 2s ease-in-out infinite;
    padding: 16px;
    border-radius: 16px;
    background: rgba(184, 255, 0, 0.04);
    border: 1px solid rgba(184, 255, 0, 0.1);
  }

  .loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.06);
    border-top-color: #B8FF00;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  /* URL Matches / Suggestions */
  .url-matches {
    padding: 0 12px;
    animation: fadeIn 0.2s ease;
  }

  .section-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 8px 8px 6px;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-primary);
    animation: pulse 2s ease-in-out infinite;
  }

  .suggestion-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 8px;
    border-radius: var(--radius-md);
    width: 100%;
    text-align: left;
    transition: background var(--transition-fast);
    background: rgba(184, 255, 0, 0.04);
    border: 1px solid rgba(184, 255, 0, 0.1);
    margin-bottom: 6px;
  }

  .suggestion-row:hover {
    background: rgba(184, 255, 0, 0.08);
    border-color: rgba(184, 255, 0, 0.2);
  }

  .suggestion-icon {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
  }

  .suggestion-icon img {
    width: 18px;
    height: 18px;
  }

  .suggestion-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .suggestion-title {
    font-size: var(--font-sm);
    font-weight: 500;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .suggestion-sub {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .autofill-tag {
    font-size: 10px;
    font-weight: 600;
    color: #0A0A0A;
    background: var(--color-primary);
    padding: 3px 8px;
    border-radius: var(--radius-full);
    flex-shrink: 0;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  /* Toast */
  .toast {
    position: fixed;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 16px;
    background: var(--color-primary);
    color: #0A0A0A;
    border-radius: var(--radius-full);
    font-size: var(--font-xs);
    font-weight: 600;
    z-index: 100;
    animation: fadeIn 0.2s ease;
    box-shadow: 0 4px 16px rgba(184, 255, 0, 0.3);
  }
</style>
