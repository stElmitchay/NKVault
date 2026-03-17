<script lang="ts">
  import { getAuth } from '$lib/stores/auth.svelte';

  const auth = getAuth();

  let email = $state('');
  let code = $state('');
  let sentEmail = $state('');
  let isSending = $state(false);
  let isVerifying = $state(false);
  let localError = $state('');

  async function handleSendCode(e: Event) {
    e.preventDefault();
    localError = '';
    isSending = true;

    try {
      await auth.sendMagicCode(email);
      sentEmail = email;
    } catch (err: any) {
      localError = auth.error || 'Failed to send code.';
    } finally {
      isSending = false;
    }
  }

  async function handleVerifyCode(e: Event) {
    e.preventDefault();
    localError = '';
    isVerifying = true;

    try {
      await auth.signInWithMagicCode(sentEmail, code);
    } catch (err: any) {
      localError = auth.error || 'Invalid code.';
      code = '';
    } finally {
      isVerifying = false;
    }
  }

  function handleBack() {
    sentEmail = '';
    code = '';
    localError = '';
  }
</script>

<div class="login-page">
  <div class="login-orb login-orb-1"></div>
  <div class="login-orb login-orb-2"></div>
  <div class="login-orb login-orb-3"></div>

  <div class="login-card glass fade-in">
    <div class="login-header">
      <img src="/logo-green.png" alt="NKVault" class="login-logo logo-dark" />
      <img src="/logo-coral.png" alt="NKVault" class="login-logo logo-light" />
      <p class="login-subtitle">NO-Knowledge Vault</p>
    </div>

    {#if localError || auth.error}
      <div class="login-error fade-in">
        {localError || auth.error}
      </div>
    {/if}

    {#if !sentEmail}
      <form onsubmit={handleSendCode} class="login-form">
        <div class="input-group">
          <label for="email-input">Email address</label>
          <input
            id="email-input"
            type="email"
            class="input"
            placeholder="name@christex.foundation"
            bind:value={email}
            required
            autofocus
          />
        </div>
        <p class="login-hint">Only @christex.foundation emails are accepted</p>
        <button type="submit" class="btn btn-primary login-btn" disabled={isSending}>
          {#if isSending}
            <span class="spinner"></span> Sending...
          {:else}
            Send Magic Code →
          {/if}
        </button>
      </form>
    {:else}
      <form onsubmit={handleVerifyCode} class="login-form fade-in">
        <p class="login-sent-msg">
          We sent a code to <strong>{sentEmail}</strong>
        </p>
        <div class="input-group">
          <label for="code-input">Verification code</label>
          <input
            id="code-input"
            type="text"
            class="input code-input"
            placeholder="Enter 6-digit code"
            bind:value={code}
            required
            autofocus
            maxlength="6"
          />
        </div>
        <button type="submit" class="btn btn-primary login-btn" disabled={isVerifying}>
          {#if isVerifying}
            <span class="spinner"></span> Verifying...
          {:else}
            Verify & Sign In
          {/if}
        </button>
        <button type="button" class="btn btn-ghost" onclick={handleBack}>
          ← Use a different email
        </button>
      </form>
    {/if}
  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-lg);
    position: relative;
    overflow: hidden;
  }

  .login-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.6;
    pointer-events: none;
  }

  .login-orb-1 {
    width: 400px;
    height: 400px;
    background: var(--color-primary-light);
    top: -80px;
    right: -60px;
    animation: float1 8s ease-in-out infinite;
  }

  .login-orb-2 {
    width: 300px;
    height: 300px;
    background: hsl(340, 90%, 82%);
    bottom: -40px;
    left: -40px;
    animation: float2 10s ease-in-out infinite;
  }

  .login-orb-3 {
    width: 200px;
    height: 200px;
    background: hsl(20, 80%, 88%);
    top: 40%;
    left: 20%;
    animation: float3 12s ease-in-out infinite;
  }

  @keyframes float1 {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(-30px, 20px); }
  }

  @keyframes float2 {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(20px, -30px); }
  }

  @keyframes float3 {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(-15px, -20px); }
  }

  .login-card {
    width: 100%;
    max-width: 420px;
    padding: var(--space-2xl);
    position: relative;
    z-index: 1;
  }

  .login-header {
    text-align: center;
    margin-bottom: var(--space-xl);
  }

  .login-logo {
    height: 80px;
    width: 80px;
    object-fit: contain;
    margin-bottom: var(--space-sm);
    filter: drop-shadow(0 4px 12px rgba(184, 255, 0, 0.3));
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

  :global([data-theme="light"]) .login-logo {
    filter: drop-shadow(0 4px 12px rgba(255, 107, 107, 0.3));
  }



  .login-subtitle {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    margin-top: 2px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .login-hint {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    margin-top: -8px;
  }

  .login-btn {
    width: 100%;
    padding: 14px 20px;
    font-size: var(--font-base);
    margin-top: var(--space-sm);
  }

  .login-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .login-error {
    background: rgba(255, 59, 48, 0.1);
    color: var(--color-danger);
    padding: 10px 14px;
    border-radius: var(--radius-md);
    font-size: var(--font-sm);
    border: 1px solid rgba(255, 59, 48, 0.2);
  }

  .login-sent-msg {
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
    text-align: center;
  }

  .login-sent-msg strong {
    color: var(--color-text);
  }

  .code-input {
    text-align: center;
    letter-spacing: 8px;
    font-size: var(--font-xl);
    font-weight: 600;
  }

  .spinner {
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
</style>
