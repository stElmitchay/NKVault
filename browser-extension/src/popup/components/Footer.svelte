<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    onOpenGenerator: () => void;
    onOpenWebApp: () => void;
  }

  let { onOpenGenerator, onOpenWebApp }: Props = $props();
</script>

<footer class="footer">
  <button class="footer-btn" onclick={onOpenGenerator} title="Password Generator">
    <Icon name="dice" size={16} />
    <span>Generator</span>
  </button>
  <div class="footer-divider"></div>
  <button class="footer-btn" onclick={onOpenWebApp} title="Open NKVault">
    <Icon name="external-link" size={16} />
    <span>Full Vault</span>
  </button>
</footer>

<style>
  .footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 8px 16px;
    border-top: 1px solid var(--glass-border);
    flex-shrink: 0;
  }

  .footer-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-muted);
    transition: all var(--transition-fast);
    flex: 1;
    justify-content: center;
  }

  .footer-btn:hover {
    background: rgba(255, 255, 255, 0.04);
    color: var(--color-text);
  }

  .footer-divider {
    width: 1px;
    height: 20px;
    background: var(--glass-border);
  }
</style>
