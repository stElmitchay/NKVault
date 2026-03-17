<script lang="ts">
  import Icon from './Icon.svelte';
  import { generatePassword, getPasswordStrength, DEFAULT_PASSWORD_OPTIONS, type PasswordOptions } from '$ext/shared/types';

  interface Props {
    onBack: () => void;
    onCopy: (text: string, label: string) => void;
  }

  let { onBack, onCopy }: Props = $props();

  let options = $state<PasswordOptions>({ ...DEFAULT_PASSWORD_OPTIONS });
  let password = $state(generatePassword(DEFAULT_PASSWORD_OPTIONS));
  let copied = $state(false);

  let strength = $derived(getPasswordStrength(password));

  function regenerate() {
    password = generatePassword(options);
    copied = false;
  }

  function handleCopy() {
    onCopy(password, 'Password');
    copied = true;
    setTimeout(() => { copied = false; }, 2000);
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

<div class="generator">
  <div class="gen-header">
    <button class="back-btn" onclick={onBack}>
      <Icon name="arrow-left" size={16} />
    </button>
    <h2>Password Generator</h2>
  </div>

  <!-- Generated Password -->
  <div class="password-display">
    <div class="password-text">{password}</div>
    <div class="password-actions">
      <button class="action-btn" onclick={handleCopy} title="Copy">
        <Icon name={copied ? 'check' : 'copy'} size={15} />
      </button>
      <button class="action-btn" onclick={regenerate} title="Regenerate">
        <Icon name="refresh" size={15} />
      </button>
    </div>
  </div>

  <!-- Strength -->
  <div class="strength-bar">
    <div class="strength-fill" style="width: {(strength.score / 6) * 100}%; background: {strength.color}"></div>
  </div>
  <div class="strength-label" style="color: {strength.color}">{strength.label}</div>

  <!-- Options -->
  <div class="options">
    <div class="length-row">
      <label>Length: <strong>{options.length}</strong></label>
      <input
        type="range"
        min="8"
        max="64"
        value={options.length}
        oninput={handleLengthChange}
        class="range-input"
      />
    </div>

    <div class="toggle-grid">
      <button class="toggle-btn" class:active={options.uppercase} onclick={() => toggleOption('uppercase')}>
        <span class="toggle-check">{options.uppercase ? '✓' : ''}</span>
        ABC
      </button>
      <button class="toggle-btn" class:active={options.lowercase} onclick={() => toggleOption('lowercase')}>
        <span class="toggle-check">{options.lowercase ? '✓' : ''}</span>
        abc
      </button>
      <button class="toggle-btn" class:active={options.numbers} onclick={() => toggleOption('numbers')}>
        <span class="toggle-check">{options.numbers ? '✓' : ''}</span>
        123
      </button>
      <button class="toggle-btn" class:active={options.symbols} onclick={() => toggleOption('symbols')}>
        <span class="toggle-check">{options.symbols ? '✓' : ''}</span>
        @#$
      </button>
    </div>
  </div>
</div>

<style>
  .generator {
    flex: 1;
    padding: 0 16px 16px;
    animation: fadeIn 0.2s ease;
    overflow-y: auto;
  }

  .gen-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 0;
  }

  .gen-header h2 {
    font-size: var(--font-base);
    font-weight: 600;
  }

  .back-btn {
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    transition: all var(--transition-fast);
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text);
  }

  .password-display {
    background: #1a1a1a;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .password-text {
    flex: 1;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
    color: var(--color-primary);
    word-break: break-all;
    line-height: 1.5;
  }

  .password-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .action-btn {
    width: 30px;
    height: 30px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    transition: all var(--transition-fast);
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-text);
  }

  .strength-bar {
    height: 3px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 4px;
  }

  .strength-fill {
    height: 100%;
    border-radius: 2px;
    transition: all var(--transition-base);
  }

  .strength-label {
    font-size: 10px;
    font-weight: 600;
    margin-bottom: 16px;
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .length-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .length-row label {
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
  }

  .range-input {
    width: 100%;
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    outline: none;
  }

  .range-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--color-primary);
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  }

  .toggle-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .toggle-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 10px 6px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-muted);
    background: rgba(255, 255, 255, 0.03);
    transition: all var(--transition-fast);
  }

  .toggle-btn:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .toggle-btn.active {
    background: var(--color-primary-subtle);
    color: var(--color-primary);
    border: 1px solid rgba(184, 255, 0, 0.15);
  }

  .toggle-check {
    font-size: 10px;
    height: 12px;
    color: var(--color-primary);
  }
</style>
