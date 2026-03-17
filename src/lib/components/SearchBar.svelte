<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    value: string;
    onInput: (value: string) => void;
  }

  let { value, onInput }: Props = $props();

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    onInput(target.value);
  }
</script>

<div class="search-bar">
  <span class="search-icon"><Icon name="search" size={15} /></span>
  <input
    type="text"
    class="search-input"
    placeholder="Search vault items..."
    {value}
    oninput={handleInput}
    id="search-input"
  />
  {#if value}
    <button class="search-clear" onclick={() => onInput('')}>
      <Icon name="x" size={10} />
    </button>
  {/if}
</div>

<style>
  .search-bar {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(20px) saturate(1.4);
    -webkit-backdrop-filter: blur(20px) saturate(1.4);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-full);
    transition: all var(--transition-fast);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  .search-bar:focus-within {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(184, 255, 0, 0.3);
    box-shadow: 0 0 0 3px rgba(184, 255, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  .search-icon {
    display: flex;
    align-items: center;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    border: none;
    background: none;
    outline: none;
    font-size: var(--font-sm);
    color: var(--color-text);
    min-width: 0;
  }

  .search-input::placeholder {
    color: var(--color-text-muted);
  }

  .search-clear {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    flex-shrink: 0;
    transition: all var(--transition-fast);
  }

  .search-clear:hover {
    background: rgba(255, 255, 255, 0.15);
    color: var(--color-text);
  }

  /* Light mode */
  :global([data-theme="light"]) .search-bar {
    background: rgba(255, 255, 255, 0.5);
    border-color: rgba(0, 0, 0, 0.06);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
  }

  :global([data-theme="light"]) .search-bar:focus-within {
    background: rgba(255, 255, 255, 0.8);
    border-color: rgba(255, 107, 107, 0.35);
    box-shadow: 0 0 0 3px rgba(255, 107, 107, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.7);
  }

  :global([data-theme="light"]) .search-input {
    color: #1a1a1a;
  }

  :global([data-theme="light"]) .search-clear {
    background: rgba(0, 0, 0, 0.06);
  }

  :global([data-theme="light"]) .search-clear:hover {
    background: rgba(0, 0, 0, 0.1);
  }
</style>
