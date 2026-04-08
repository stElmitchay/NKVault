<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getAuth } from '$lib/stores/auth.svelte';
  import { getVaultStore } from '$lib/stores/vault.svelte';
  import { getCryptoStore } from '$lib/stores/crypto.svelte';
  import type { ItemType, ItemData } from '$lib/types';
  import { ITEM_TYPE_META } from '$lib/types';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import SearchBar from '$lib/components/SearchBar.svelte';
  import ItemList from '$lib/components/ItemList.svelte';
  import ItemDetail from '$lib/components/ItemDetail.svelte';
  import ItemForm from '$lib/components/ItemForm.svelte';
  import PasswordGenerator from '$lib/components/PasswordGenerator.svelte';
  import ImportModal from '$lib/components/ImportModal.svelte';
  import SettingsPanel from '$lib/components/SettingsPanel.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { isEncrypted } from '$lib/crypto/aes';

  const auth = getAuth();
  const vault = getVaultStore();
  const cryptoStore = getCryptoStore();

  // UI state
  let selectedItem = $state<any | null>(null);
  let decryptedData = $state<any | null>(null);
  let showForm = $state(false);
  let editingItem = $state<any | null>(null);
  let showGenerator = $state(false);
  let showImport = $state(false);
  let showSettings = $state(false);
  let toast = $state<string | null>(null);
  let mobileShowDetail = $state(false);

  let filteredItems = $derived(
    auth.user ? vault.getFilteredItems(auth.user.id) : []
  );

  // Decrypted items for display (titles + data decrypted)
  let displayItems = $state<any[]>([]);

  // Decrypt items whenever the raw filtered list changes
  $effect(() => {
    const raw = filteredItems;
    const q = vault.searchQuery?.trim().toLowerCase() || '';
    vault.decryptItems(raw).then((decrypted) => {
      if (q) {
        displayItems = decrypted.filter((item: any) =>
          item.title.toLowerCase().includes(q)
        );
      } else {
        displayItems = decrypted;
      }
    });
  });

  onMount(async () => {
    vault.init();
    if (auth.user) {
      await vault.ensurePersonalVault(auth.user.id);
      await vault.ensureSharedVault(auth.user.id);
    }
  });

  onDestroy(() => {
    vault.destroy();
  });

  function showToast(msg: string) {
    toast = msg;
    setTimeout(() => { toast = null; }, 2500);
  }

  function handleVaultChange(type: 'personal' | 'shared') {
    vault.activeVaultType = type;
    selectedItem = null;
    decryptedData = null;
    showForm = false;
    editingItem = null;
    showGenerator = false;
    showSettings = false;
    mobileShowDetail = false;
  }

  function handleFilterChange(filter: ItemType | 'all' | 'favorites') {
    vault.activeFilter = filter;
    selectedItem = null;
    decryptedData = null;
  }

  function handleSearchInput(value: string) {
    vault.searchQuery = value;
  }

  async function handleSelectItem(item: any) {
    selectedItem = item;
    showForm = false;
    editingItem = null;
    showGenerator = false;
    showSettings = false;
    mobileShowDetail = true;

    // displayItems are already decrypted — use data directly
    decryptedData = item.data;
  }

  async function handleToggleFavorite(itemId: string, current: boolean) {
    await vault.toggleFavorite(itemId, current);
    if (selectedItem && selectedItem.id === itemId) {
      selectedItem = { ...selectedItem, favorite: !current };
    }
  }

  function handleNewItem() {
    showForm = true;
    editingItem = null;
    selectedItem = null;
    decryptedData = null;
    showGenerator = false;
    showSettings = false;
    mobileShowDetail = true;
  }

  async function handleEditItem() {
    if (!selectedItem) return;
    // displayItems are already decrypted — data is ready for editing
    editingItem = { ...selectedItem, data: decryptedData || selectedItem.data };
    showForm = true;
    mobileShowDetail = true;
  }

  async function handleSaveItem(title: string, type: ItemType, data: ItemData) {
    if (!auth.user) return;

    if (editingItem) {
      await vault.updateItem(editingItem.id, { title, type, data });
      showToast('Item updated');
    } else {
      const vaultId = vault.activeVaultType === 'personal'
        ? await vault.ensurePersonalVault(auth.user.id)
        : await vault.ensureSharedVault(auth.user.id);
      await vault.createItem(title, type, data, vaultId, auth.user.id);
      showToast('Item created');
    }

    showForm = false;
    editingItem = null;
    selectedItem = null;
    decryptedData = null;
    mobileShowDetail = false;
  }

  async function handleDeleteItem() {
    if (!selectedItem) return;
    await vault.deleteItem(selectedItem.id);
    showToast('Item deleted');
    selectedItem = null;
    decryptedData = null;
    mobileShowDetail = false;
  }

  function handleCancelForm() {
    showForm = false;
    editingItem = null;
    mobileShowDetail = false;
  }

  function handleOpenGenerator() {
    showGenerator = true;
    showForm = false;
    showSettings = false;
    selectedItem = null;
    editingItem = null;
    decryptedData = null;
    mobileShowDetail = true;
  }

  function handleCloseGenerator() {
    showGenerator = false;
    mobileShowDetail = false;
  }

  function handleOpenImport() {
    showImport = true;
  }

  function handleCloseImport() {
    showImport = false;
  }

  function handleOpenSettings() {
    showSettings = true;
    showForm = false;
    showGenerator = false;
    selectedItem = null;
    editingItem = null;
    decryptedData = null;
    mobileShowDetail = true;
  }

  function handleCloseSettings() {
    showSettings = false;
    mobileShowDetail = false;
  }

  function handleMobileBack() {
    mobileShowDetail = false;
    selectedItem = null;
    decryptedData = null;
    showForm = false;
    editingItem = null;
    showGenerator = false;
    showSettings = false;
  }

  async function handleImportItems(items: Array<{ title: string; type: ItemType; data: ItemData }>) {
    if (!auth.user) return;
    const vaultId = await vault.ensurePersonalVault(auth.user.id);

    // Import items in batches to avoid overwhelming the DB
    const BATCH_SIZE = 10;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(item =>
          vault.createItem(item.title, item.type, item.data, vaultId, auth.user!.id)
        )
      );
    }

    showToast(`${items.length} items imported & encrypted`);
  }

  // Keyboard shortcuts
  function handleKeydown(e: KeyboardEvent) {
    // Cmd/Ctrl + N = New item
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      handleNewItem();
    }
    // Cmd/Ctrl + , = Settings
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      handleOpenSettings();
    }
    // Escape = close detail/form
    if (e.key === 'Escape') {
      if (showForm) handleCancelForm();
      else if (showGenerator) handleCloseGenerator();
      else if (showSettings) handleCloseSettings();
      else if (mobileShowDetail) handleMobileBack();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="app-shell">
  <Sidebar
    activeVaultType={vault.activeVaultType}
    activeFilter={vault.activeFilter}
    userEmail={auth.user?.email || ''}
    onVaultChange={handleVaultChange}
    onFilterChange={handleFilterChange}
    onSignOut={auth.signOut}
    onOpenGenerator={handleOpenGenerator}
    onOpenImport={handleOpenImport}
    onOpenSettings={handleOpenSettings}
  />

  <main class="main-content" class:mobile-detail-open={mobileShowDetail}>
    <div class="content-header">
      <div class="header-top">
        <div class="header-title-section">
          <h1>
            <Icon name={vault.activeVaultType === 'personal' ? 'lock' : 'users'} size={22} />
            {vault.activeVaultType === 'personal' ? 'Personal Vault' : 'Shared Vault'}
          </h1>
          <span class="item-count">{displayItems.length} items</span>
        </div>
        <button class="btn btn-primary" onclick={handleNewItem} id="new-item-btn">
          <Icon name="plus" size={16} />
          {#if vault.activeFilter !== 'all' && vault.activeFilter !== 'favorites' && ITEM_TYPE_META[vault.activeFilter]}
            New {ITEM_TYPE_META[vault.activeFilter].label}
          {:else}
            New Item
          {/if}
        </button>
      </div>
      <SearchBar value={vault.searchQuery} onInput={handleSearchInput} />
    </div>

    <div class="content-body">
      <div class="list-panel glass-solid" class:mobile-hidden={mobileShowDetail}>
        <ItemList
          items={displayItems}
          selectedId={selectedItem?.id ?? null}
          onSelect={handleSelectItem}
          onToggleFavorite={handleToggleFavorite}
        />
      </div>

      <div class="detail-panel" class:mobile-visible={mobileShowDetail}>
        {#if mobileShowDetail}
          <button class="mobile-back-btn btn btn-ghost" onclick={handleMobileBack}>
            <Icon name="arrow-left" size={16} /> Back
          </button>
        {/if}

        {#if showSettings}
          <div class="glass-solid detail-card slide-in-right">
            <SettingsPanel onClose={handleCloseSettings} />
          </div>
        {:else if showGenerator}
          <div class="glass-solid detail-card slide-in-right">
            <PasswordGenerator onClose={handleCloseGenerator} />
          </div>
        {:else if showForm}
          <div class="glass-solid detail-card slide-in-right">
            <ItemForm
              editItem={editingItem}
              defaultType={vault.activeFilter !== 'all' && vault.activeFilter !== 'favorites' ? vault.activeFilter : undefined}
              onSave={handleSaveItem}
              onCancel={handleCancelForm}
            />
          </div>
        {:else if selectedItem && decryptedData}
          <div class="glass-solid detail-card slide-in-right">
            <ItemDetail
              item={{ ...selectedItem, data: decryptedData }}
              onEdit={handleEditItem}
              onDelete={handleDeleteItem}
              onToggleFavorite={() => handleToggleFavorite(selectedItem.id, selectedItem.favorite)}
            />
          </div>
        {:else if selectedItem}
          <div class="glass-solid detail-card slide-in-right">
            <div class="decrypting-placeholder">
              <div class="spinner-lg"></div>
              <p>Decrypting...</p>
            </div>
          </div>
        {:else}
          <div class="empty-detail fade-in">
            <img src="/logo-green.png" alt="" class="empty-detail-icon logo-dark" />
            <img src="/logo-coral.png" alt="" class="empty-detail-icon logo-light" />
            <p class="empty-detail-title">Select an item</p>
            <p class="empty-detail-desc">Choose an item from the list or create a new one</p>
            <div class="shortcuts-hint">
              <span><kbd>⌘N</kbd> New Item</span>
              <span><kbd>⌘K</kbd> Search</span>
              <span><kbd>⌘,</kbd> Settings</span>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </main>
</div>

{#if toast}
  <div class="toast">{toast}</div>
{/if}

{#if showImport}
  <ImportModal
    onImport={handleImportItems}
    onClose={handleCloseImport}
  />
{/if}

<style>
  .app-shell {
    display: flex;
    min-height: 100vh;
  }

  .main-content {
    flex: 1;
    margin-left: var(--sidebar-width);
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .content-header {
    padding: var(--space-lg) var(--space-xl) var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-title-section {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .header-title-section h1 {
    font-size: var(--font-xl);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .item-count {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    background: rgba(255, 255, 255, 0.06);
    padding: 4px 12px;
    border-radius: var(--radius-full);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .content-body {
    flex: 1;
    display: grid;
    grid-template-columns: 380px 1fr;
    gap: var(--space-lg);
    padding: 0 var(--space-xl) var(--space-xl);
    min-height: 0;
  }

  .list-panel {
    overflow-y: auto;
    max-height: calc(100vh - 160px);
    padding: var(--space-sm);
  }

  .detail-panel {
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 160px);
    overflow-y: auto;
  }

  .detail-card {
    flex: 1;
  }

  .empty-detail {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    opacity: 0.6;
  }

  .empty-detail-icon {
    width: 64px;
    height: 64px;
    object-fit: contain;
    margin-bottom: var(--space-md);
    opacity: 0.3;
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

  .empty-detail-title {
    font-size: var(--font-lg);
    font-weight: 500;
    color: var(--color-text-secondary);
    margin-bottom: var(--space-xs);
  }

  .empty-detail-desc {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    margin-bottom: var(--space-lg);
  }

  .shortcuts-hint {
    display: flex;
    gap: var(--space-lg);
    font-size: var(--font-xs);
    color: var(--color-text-muted);
  }

  .shortcuts-hint kbd {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-family: inherit;
    font-size: 10px;
    margin-right: 4px;
    color: var(--color-text-secondary);
  }

  .decrypting-placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    color: var(--color-text-muted);
    font-size: var(--font-sm);
  }

  .spinner-lg {
    width: 24px;
    height: 24px;
    border: 2px solid rgba(255, 255, 255, 0.08);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .mobile-back-btn {
    display: none;
  }

  /* ======== Responsive / Mobile ======== */
  @media (max-width: 1024px) {
    .main-content {
      margin-left: 0;
    }

    .content-body {
      grid-template-columns: 1fr;
    }

    .detail-panel {
      display: none;
    }

    .detail-panel.mobile-visible {
      display: flex;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--color-bg);
      z-index: 50;
      max-height: none;
      padding: var(--space-md);
      overflow-y: auto;
    }

    .mobile-back-btn {
      display: flex;
      margin-bottom: var(--space-md);
    }

    .list-panel.mobile-hidden {
      display: none;
    }
  }

  @media (max-width: 768px) {
    .content-header {
      padding: var(--space-md);
    }

    .content-body {
      padding: 0 var(--space-md) var(--space-md);
    }

    .header-title-section h1 {
      font-size: var(--font-lg);
    }
  }

  /* Light mode */
  :global([data-theme="light"]) .item-count {
    background: rgba(0, 0, 0, 0.04);
    border-color: rgba(0, 0, 0, 0.06);
    color: #666;
  }

  :global([data-theme="light"]) .header-title-section h1 {
    color: #1a1a1a;
  }

  :global([data-theme="light"]) .shortcuts-hint kbd {
    background: rgba(0, 0, 0, 0.04);
    border-color: rgba(0, 0, 0, 0.08);
    color: #666;
  }

  :global([data-theme="light"]) .spinner-lg {
    border-color: rgba(0, 0, 0, 0.08);
    border-top-color: #FF6B6B;
  }
</style>
