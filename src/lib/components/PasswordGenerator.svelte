<script lang="ts">
  import { generatePassword, getPasswordStrength, DEFAULT_OPTIONS, type PasswordOptions } from '$lib/utils/password';
  import { copyToClipboard } from '$lib/utils/helpers';
  import Icon from './Icon.svelte';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  let options = $state<PasswordOptions>({ ...DEFAULT_OPTIONS });
  let password = $state(generatePassword(DEFAULT_OPTIONS));
  let copied = $state(false);

  let strength = $derived(getPasswordStrength(password));

  function regenerate() {
    password = generatePassword(options);
    copied = false;
  }

  async function handleCopy() {
    const ok = await copyToClipboard(password);
    if (ok) {
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    }
  }

  function handleLengthChange(e: Event) {
    options = { ...options, length: parseInt((e.target as HTMLInputElement).value) };
    regenerate();
  }

  function toggleOption(key: keyof Omit<PasswordOptions, 'length'>) {
    options = { ...options, [key]: !options[key] };
    regenerate();
  }
</script>

<div class="generator fade-in">
  <div class="generator-header">
    <h2>Password Generator</h2>
    <button class="btn btn-ghost" onclick={onClose}>
      <Icon name="x" size={18} />
    </button>
  </div>

  <div class="password-display">
    <div class="password-text">{password}</div>
    <div class="password-actions">
      <button class="btn btn-icon" onclick={handleCopy} title="Copy">
        <Icon name={copied ? 'check' : 'copy'} size={18} />
      </button>
      <button class="btn btn-icon" onclick={regenerate} title="Regenerate">
        <Icon name="refresh" size={18} />
      </button>
    </div>
  </div>

  <div class="strength-bar">
    <div
      class="strength-fill"
      style="width: {(strength.score / 6) * 100}%; background: {strength.color}"
    ></div>
  </div>
  <div class="strength-label" style="color: {strength.color}">
    {strength.label}
  </div>

  <div class="options">
    <div class="option-row">
      <label for="password-length">Length: <strong>{options.length}</strong></label>
      <input
        id="password-length"
        type="range"
        min="8"
        max="64"
        value={options.length}
        oninput={handleLengthChange}
        class="range-input"
      />
    </div>

    <div class="option-toggles">
      <button class="toggle-btn" class:active={options.uppercase} onclick={() => toggleOption('uppercase')}>
        <span class="toggle-indicator">{options.uppercase ? '✓' : ''}</span>
        ABC
      </button>
      <button class="toggle-btn" class:active={options.lowercase} onclick={() => toggleOption('lowercase')}>
        <span class="toggle-indicator">{options.lowercase ? '✓' : ''}</span>
        abc
      </button>
      <button class="toggle-btn" class:active={options.numbers} onclick={() => toggleOption('numbers')}>
        <span class="toggle-indicator">{options.numbers ? '✓' : ''}</span>
        123
      </button>
      <button class="toggle-btn" class:active={options.symbols} onclick={() => toggleOption('symbols')}>
        <span class="toggle-indicator">{options.symbols ? '✓' : ''}</span>
        @#$
      </button>
    </div>
  </div>
</div>

<style>
  .generator {
    padding: var(--space-lg);
  }

  .generator-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-xl);
  }

  .generator-header h2 {
    font-size: var(--font-xl);
    font-weight: 600;
  }

  .password-display {
    background: var(--color-accent);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    display: flex;
    align-items: center;
    gap: var(--space-md);
    margin-bottom: var(--space-md);
  }

  .password-text {
    flex: 1;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: var(--font-base);
    color: white;
    word-break: break-all;
    line-height: 1.6;
  }

  .password-actions {
    display: flex;
    gap: var(--space-xs);
    flex-shrink: 0;
  }

  .password-actions .btn-icon {
    color: white;
    opacity: 0.7;
  }

  .password-actions .btn-icon:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
  }

  .strength-bar {
    height: 4px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: var(--space-xs);
  }

  .strength-fill {
    height: 100%;
    border-radius: 2px;
    transition: all var(--transition-base);
  }

  .strength-label {
    font-size: var(--font-xs);
    font-weight: 600;
    margin-bottom: var(--space-xl);
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .option-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .option-row label {
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
  }

  .range-input {
    width: 100%;
    -webkit-appearance: none;
    appearance: none;
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    outline: none;
  }

  .range-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--color-accent);
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  }

  .option-toggles {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-sm);
  }

  .toggle-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: var(--space-md) var(--space-sm);
    border-radius: var(--radius-md);
    font-size: var(--font-sm);
    font-weight: 500;
    color: var(--color-text-muted);
    background: rgba(255, 255, 255, 0.04);
    transition: all var(--transition-fast);
  }

  .toggle-btn:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .toggle-btn.active {
    background: var(--color-primary-subtle);
    color: var(--color-primary-dark);
    border: 1px solid var(--color-primary-light);
  }

  .toggle-indicator {
    font-size: var(--font-xs);
    height: 14px;
  }
</style>
