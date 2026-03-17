<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    userEmail: string;
    onLock: () => void;
    onOpenWebApp: () => void;
  }

  let { userEmail, onLock, onOpenWebApp }: Props = $props();
</script>

<header class="header">
  <div class="header-left">
    <div class="logo-mark">
      <Icon name="shield" size={18} />
    </div>
    <div class="header-info">
      <span class="header-title">NKVault</span>
      <span class="header-email">{userEmail}</span>
    </div>
  </div>
  <div class="header-actions">
    <button class="header-btn" onclick={onOpenWebApp} title="Open NKVault">
      <Icon name="link" size={15} />
    </button>
    <button class="header-btn" onclick={onLock} title="Lock Vault">
      <Icon name="lock" size={15} />
    </button>
  </div>
</header>

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 10px;
    border-bottom: 1px solid var(--glass-border);
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .logo-mark {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(184, 255, 0, 0.15), rgba(184, 255, 0, 0.05));
    border: 1px solid rgba(184, 255, 0, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #B8FF00;
  }

  .header-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .header-title {
    font-size: var(--font-base);
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.3px;
  }

  .header-email {
    font-size: 10px;
    color: var(--color-text-muted);
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-actions {
    display: flex;
    gap: 4px;
  }

  .header-btn {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    transition: all var(--transition-fast);
  }

  .header-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text);
  }
</style>
