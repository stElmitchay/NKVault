<script lang="ts">
  import type { ItemType } from '$lib/types';
  import { ITEM_TYPE_META } from '$lib/types';
  import { getSettings } from '$lib/stores/settings.svelte';
  import Icon from './Icon.svelte';

  interface Props {
    activeVaultType: 'personal' | 'shared';
    activeFilter: ItemType | 'all' | 'favorites';
    userEmail: string;
    onVaultChange: (type: 'personal' | 'shared') => void;
    onFilterChange: (filter: ItemType | 'all' | 'favorites') => void;
    onSignOut: () => void;
    onOpenGenerator: () => void;
    onOpenImport: () => void;
    onOpenSettings: () => void;
  }

  let {
    activeVaultType,
    activeFilter,
    userEmail,
    onVaultChange,
    onFilterChange,
    onSignOut,
    onOpenGenerator,
    onOpenImport,
    onOpenSettings,
  }: Props = $props();

  const settings = getSettings();

  let mobileMenuOpen = $state(false);

  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }

  function handleNavClick(fn: () => void) {
    fn();
    mobileMenuOpen = false;
  }
</script>

<!-- Mobile hamburger -->
<button class="mobile-menu-toggle" onclick={toggleMobileMenu} aria-label="Toggle menu">
  <Icon name={mobileMenuOpen ? 'x' : 'menu'} size={22} />
</button>

<!-- Overlay for mobile -->
{#if mobileMenuOpen}
  <div class="mobile-overlay" role="button" tabindex="-1" onclick={() => mobileMenuOpen = false} onkeydown={(e) => e.key === 'Escape' && (mobileMenuOpen = false)}></div>
{/if}

<aside class="sidebar glass" class:mobile-open={mobileMenuOpen}>
  <div class="sidebar-header">
    <div class="sidebar-logo">
      <img src="/logo-green.png" alt="NKVault" class="logo-icon logo-dark" />
      <img src="/logo-coral.png" alt="NKVault" class="logo-icon logo-light" />
    </div>
  </div>

  <nav class="sidebar-nav">
    <div class="nav-section">
      <span class="nav-section-label">Vaults</span>
      <button
        class="nav-item"
        class:active={activeVaultType === 'personal'}
        onclick={() => handleNavClick(() => onVaultChange('personal'))}
      >
        <span class="nav-icon"><Icon name="lock" size={16} /></span>
        <span>Personal</span>
      </button>
      <button
        class="nav-item"
        class:active={activeVaultType === 'shared'}
        onclick={() => handleNavClick(() => onVaultChange('shared'))}
      >
        <span class="nav-icon"><Icon name="users" size={16} /></span>
        <span>Shared</span>
      </button>
    </div>

    <div class="nav-section">
      <span class="nav-section-label">Categories</span>
      <button
        class="nav-item"
        class:active={activeFilter === 'all'}
        onclick={() => handleNavClick(() => onFilterChange('all'))}
      >
        <span class="nav-icon"><Icon name="clipboard-list" size={16} /></span>
        <span>All Items</span>
      </button>
      {#each Object.entries(ITEM_TYPE_META) as [type, meta]}
        <button
          class="nav-item"
          class:active={activeFilter === type}
          onclick={() => handleNavClick(() => onFilterChange(type as ItemType))}
        >
          <span class="nav-icon"><Icon name={meta.icon} size={16} /></span>
          <span>{meta.label}s</span>
        </button>
      {/each}
      <button
        class="nav-item"
        class:active={activeFilter === 'favorites'}
        onclick={() => handleNavClick(() => onFilterChange('favorites'))}
      >
        <span class="nav-icon"><Icon name="star" size={16} /></span>
        <span>Favorites</span>
      </button>
    </div>

    <div class="nav-section">
      <span class="nav-section-label">Tools</span>
      <button class="nav-item" onclick={() => handleNavClick(onOpenGenerator)}>
        <span class="nav-icon"><Icon name="dice" size={16} /></span>
        <span>Password Generator</span>
      </button>
      <button class="nav-item" onclick={() => handleNavClick(onOpenImport)}>
        <span class="nav-icon"><Icon name="upload" size={16} /></span>
        <span>Import</span>
      </button>
      <button class="nav-item" onclick={() => handleNavClick(onOpenSettings)}>
        <span class="nav-icon"><Icon name="settings" size={16} /></span>
        <span>Settings</span>
      </button>
    </div>
  </nav>

  <div class="sidebar-footer">
    <div class="sidebar-footer-row">
      <button
        class="dark-mode-btn"
        onclick={settings.toggleDarkMode}
        title={settings.darkMode ? 'Light mode' : 'Dark mode'}
      >
        <Icon name={settings.darkMode ? 'sun' : 'moon'} size={16} />
      </button>
    </div>
    <div class="user-info">
      <div class="user-avatar">
        {userEmail.charAt(0).toUpperCase()}
      </div>
      <div class="user-details">
        <span class="user-email" title={userEmail}>{userEmail.split('@')[0]}</span>
        <span class="user-domain">@christex.foundation</span>
      </div>
    </div>
    <button class="btn btn-ghost sign-out-btn" onclick={onSignOut}>
      <Icon name="log-out" size={14} />
      Sign Out
    </button>
  </div>
</aside>

<style>
  .sidebar {
    width: var(--sidebar-width);
    height: 100vh;
    display: flex;
    flex-direction: column;
    border-radius: 0;
    border: none;
    border-right: 1px solid var(--glass-border);
    position: fixed;
    left: 0;
    top: 0;
    z-index: 10;
    background: rgba(14, 14, 14, 0.85);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
  }

  .sidebar-header {
    padding: var(--space-lg) var(--space-lg) var(--space-sm);
  }

  .sidebar-logo {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo-icon {
    height: 64px;
    width: 64px;
    object-fit: contain;
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


  .sidebar-nav {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-sm) var(--space-sm);
  }

  .nav-section {
    margin-bottom: var(--space-lg);
  }

  .nav-section-label {
    display: block;
    font-size: var(--font-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: var(--color-text-muted);
    padding: 0 var(--space-sm);
    margin-bottom: var(--space-xs);
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: 10px var(--space-sm);
    border-radius: var(--radius-md);
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
    transition: all var(--transition-fast);
    text-align: left;
    border: 1px solid transparent;
  }

  .nav-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text);
  }

  .nav-item.active {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(184, 255, 0, 0.25);
    color: var(--color-primary);
    font-weight: 500;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 0 20px rgba(184, 255, 0, 0.05);
  }

  .nav-icon {
    width: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sidebar-footer {
    padding: var(--space-md) var(--space-lg);
    border-top: 1px solid var(--glass-border);
  }

  .sidebar-footer-row {
    display: flex;
    justify-content: flex-end;
    margin-bottom: var(--space-sm);
  }

  .dark-mode-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    transition: all var(--transition-fast);
    cursor: pointer;
    border: 1px solid var(--glass-border);
    background: rgba(255, 255, 255, 0.03);
  }

  .dark-mode-btn:hover {
    background: rgba(184, 255, 0, 0.1);
    color: var(--color-primary);
    border-color: rgba(184, 255, 0, 0.25);
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-sm);
  }

  .user-avatar {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-full);
    background: var(--color-primary);
    color: #0A0A0A;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: var(--font-sm);
    flex-shrink: 0;
  }

  .user-details {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .user-email {
    font-size: var(--font-sm);
    font-weight: 500;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-domain {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
  }

  .sign-out-btn {
    width: 100%;
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .sign-out-btn:hover {
    color: var(--color-danger);
  }

  .mobile-menu-toggle {
    display: none;
    position: fixed;
    top: var(--space-md);
    left: var(--space-md);
    z-index: 60;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    background: var(--color-surface-solid);
    border: 1px solid var(--glass-border);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--color-text);
  }

  .mobile-overlay {
    display: none;
  }

  @media (max-width: 1024px) {
    .sidebar {
      transform: translateX(-100%);
      transition: transform var(--transition-base);
      z-index: 55;
    }

    .sidebar.mobile-open {
      transform: translateX(0);
    }

    .mobile-menu-toggle {
      display: flex;
    }

    .mobile-overlay {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 50;
      backdrop-filter: blur(4px);
    }
  }

  /* Light mode sidebar */
  :global([data-theme="light"]) .sidebar {
    background: rgba(255, 255, 255, 0.7);
    border-right-color: rgba(0, 0, 0, 0.06);
  }

  :global([data-theme="light"]) .nav-item {
    color: #666;
  }

  :global([data-theme="light"]) .nav-item:hover {
    background: rgba(0, 0, 0, 0.04);
    color: #1a1a1a;
  }

  :global([data-theme="light"]) .nav-item.active {
    background: rgba(255, 107, 107, 0.1);
    border-color: rgba(255, 107, 107, 0.3);
    color: #E85D5D;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 0 20px rgba(255, 107, 107, 0.06);
  }

  :global([data-theme="light"]) .sidebar-footer {
    border-top-color: rgba(0, 0, 0, 0.06);
  }

  :global([data-theme="light"]) .dark-mode-btn {
    border-color: rgba(0, 0, 0, 0.08);
    background: rgba(0, 0, 0, 0.03);
    color: #666;
  }

  :global([data-theme="light"]) .dark-mode-btn:hover {
    background: rgba(255, 107, 107, 0.1);
    color: #E85D5D;
    border-color: rgba(255, 107, 107, 0.3);
  }

  :global([data-theme="light"]) .user-avatar {
    background: #FF6B6B;
    color: white;
  }



  :global([data-theme="light"]) .user-email {
    color: #1a1a1a;
  }

  :global([data-theme="light"]) .nav-section-label {
    color: #999;
  }
</style>
