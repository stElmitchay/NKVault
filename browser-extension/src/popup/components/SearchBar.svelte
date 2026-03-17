<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    value: string;
  }

  let { value = $bindable() }: Props = $props();

  function handleInput(e: Event) {
    value = (e.target as HTMLInputElement).value;
  }
</script>

<div class="search-bar">
  <span class="search-icon"><Icon name="search" size={14} /></span>
  <input
    type="text"
    class="search-input"
    placeholder="Search vault..."
    {value}
    oninput={handleInput}
  />
  {#if value}
    <button class="search-clear" onclick={() => value = ''}>
      <Icon name="x" size={9} />
    </button>
  {/if}
</div>

<style>
  .search-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    margin: 8px 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-full);
    transition: all var(--transition-fast);
    flex-shrink: 0;
  }

  .search-bar:focus-within {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(184, 255, 0, 0.3);
    box-shadow: 0 0 0 2px rgba(184, 255, 0, 0.06);
  }

  .search-icon {
    display: flex;
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
    width: 18px;
    height: 18px;
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
</style>
