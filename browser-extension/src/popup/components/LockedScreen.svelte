<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    onOpenWebApp: () => void;
    mode: 'unauthenticated' | 'locked';
  }

  let { onOpenWebApp, mode }: Props = $props();
</script>

<div class="locked-screen">
  <div class="locked-bg-orb orb-1"></div>
  <div class="locked-bg-orb orb-2"></div>

  <div class="locked-content">
    <div class="lock-icon-wrapper">
      <div class="lock-icon">
        <Icon name={mode === 'locked' ? 'lock' : 'shield'} size={36} />
      </div>
      <div class="lock-ring"></div>
    </div>

    {#if mode === 'unauthenticated'}
      <h2>Welcome to NKVault</h2>
      <p class="locked-desc">Sign in to the NKVault web app to connect your vault to this extension.</p>
    {:else}
      <h2>Vault Locked</h2>
      <p class="locked-desc">Open NKVault and unlock your vault with your Solana wallet to access credentials here.</p>
    {/if}

    <button class="open-btn" onclick={onOpenWebApp}>
      <Icon name="external-link" size={15} />
      {mode === 'unauthenticated' ? 'Open NKVault' : 'Unlock in NKVault'}
    </button>

    <div class="locked-footer">
      <Icon name="shield" size={12} />
      <span>Zero-knowledge encryption</span>
    </div>
  </div>
</div>

<style>
  .locked-screen {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    padding: 32px 24px;
  }

  .locked-bg-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(60px);
    pointer-events: none;
  }

  .orb-1 {
    width: 200px;
    height: 200px;
    background: rgba(184, 255, 0, 0.06);
    top: -60px;
    right: -40px;
    animation: float1 8s ease-in-out infinite;
  }

  .orb-2 {
    width: 150px;
    height: 150px;
    background: rgba(184, 255, 0, 0.04);
    bottom: -30px;
    left: -30px;
    animation: float2 10s ease-in-out infinite;
  }

  @keyframes float1 {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(-15px, 10px); }
  }

  @keyframes float2 {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(10px, -15px); }
  }

  .locked-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 14px;
    position: relative;
    z-index: 1;
    animation: fadeIn 0.3s ease;
  }

  .lock-icon-wrapper {
    position: relative;
    margin-bottom: 8px;
  }

  .lock-icon {
    width: 72px;
    height: 72px;
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(184, 255, 0, 0.1), rgba(184, 255, 0, 0.03));
    border: 1px solid rgba(184, 255, 0, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #B8FF00;
    animation: glowPulse 3s ease-in-out infinite;
  }

  .lock-ring {
    position: absolute;
    inset: -8px;
    border-radius: 24px;
    border: 1px solid rgba(184, 255, 0, 0.06);
    animation: pulse 3s ease-in-out infinite;
  }

  h2 {
    font-size: var(--font-lg);
    font-weight: 700;
    color: var(--color-text);
  }

  .locked-desc {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    line-height: 1.5;
    max-width: 260px;
  }

  .open-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border-radius: var(--radius-full);
    background: var(--color-primary);
    color: #0A0A0A;
    font-weight: 600;
    font-size: var(--font-sm);
    transition: all var(--transition-fast);
    margin-top: 4px;
  }

  .open-btn:hover {
    background: var(--color-primary-dark);
    transform: translateY(-1px);
    box-shadow: 0 4px 20px rgba(184, 255, 0, 0.3);
  }

  .locked-footer {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: var(--color-text-muted);
    margin-top: 16px;
  }
</style>
