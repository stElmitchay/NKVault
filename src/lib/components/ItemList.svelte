<script lang="ts">
  import { ITEM_TYPE_META } from '$lib/types';
  import Icon from './Icon.svelte';

  // List items are list-safe projections produced by
  // `vault.decryptItemsForList`: they expose `_subtitle` and
  // `_faviconHost` instead of secret-bearing `data` fields.
  function faviconFor(host: string | null | undefined): string {
    if (!host) return '';
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
  }

  interface Props {
    items: any[];
    selectedId: string | null;
    onSelect: (item: any) => void;
    onToggleFavorite: (id: string, current: boolean) => void;
  }

  let { items, selectedId, onSelect, onToggleFavorite }: Props = $props();
</script>

<div class="item-list">
  {#if items.length === 0}
    <div class="empty-state fade-in">
      <div class="empty-icon"><Icon name="inbox" size={48} /></div>
      <p class="empty-title">No items found</p>
      <p class="empty-desc">Create a new item to get started</p>
    </div>
  {:else}
    {#each items as item, i (item.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="item-row"
        class:active={selectedId === item.id}
        onclick={() => onSelect(item)}
        onkeydown={(e) => { if (e.key === 'Enter') onSelect(item); }}
        role="button"
        tabindex="0"
        style="animation-delay: {i * 30}ms"
      >
        <div class="item-icon">
          {#if item.type === 'login' && item._faviconHost}
            <img
              src={faviconFor(item._faviconHost)}
              alt=""
              class="favicon"
              onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
            />
            <span class="favicon-fallback hidden">
              <Icon name={ITEM_TYPE_META[item.type as keyof typeof ITEM_TYPE_META]?.icon || 'document'} size={18} />
            </span>
          {:else}
            <Icon name={ITEM_TYPE_META[item.type as keyof typeof ITEM_TYPE_META]?.icon || 'document'} size={18} />
          {/if}
        </div>
        <div class="item-info">
          <span class="item-title">{item.title}</span>
          <span class="item-subtitle">{item._subtitle ?? ''}</span>
        </div>
        <button
          class="favorite-btn"
          class:is-favorite={item.favorite}
          onclick={(e) => { e.stopPropagation(); onToggleFavorite(item.id, item.favorite); }}
          aria-label="Toggle favorite"
        >
          <Icon name={item.favorite ? 'star' : 'star-outline'} size={16} />
        </button>
      </div>
    {/each}
  {/if}
</div>

<style>
  .item-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: 14px var(--space-md);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
    animation: fadeIn var(--transition-base) ease-out both;
    text-align: left;
    width: 100%;
  }

  .item-row:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .item-row.active {
    background: rgba(255, 255, 255, 0.08);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    border: 1px solid var(--glass-border);
  }

  .item-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    background: var(--color-primary-subtle);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--color-primary-dark);
  }

  .favicon {
    width: 20px;
    height: 20px;
    border-radius: 4px;
  }

  .hidden {
    display: none !important;
  }

  .item-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item-title {
    font-size: var(--font-sm);
    font-weight: 500;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-subtitle {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .favorite-btn {
    color: var(--color-text-muted);
    transition: all var(--transition-fast);
    flex-shrink: 0;
    padding: 4px;
    display: flex;
    align-items: center;
  }

  .favorite-btn:hover {
    transform: scale(1.2);
  }

  .favorite-btn.is-favorite {
    color: var(--color-warning);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-2xl) var(--space-lg);
  }

  .empty-icon {
    margin-bottom: var(--space-md);
    opacity: 0.3;
    color: var(--color-text-muted);
    display: flex;
    justify-content: center;
  }

  .empty-title {
    font-size: var(--font-lg);
    font-weight: 500;
    color: var(--color-text-secondary);
    margin-bottom: var(--space-xs);
  }

  .empty-desc {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
  }

  :global([data-theme="light"]) .item-row:hover {
    background: rgba(0, 0, 0, 0.03);
  }

  :global([data-theme="light"]) .item-row.active {
    background: rgba(255, 255, 255, 0.7);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
    border-color: rgba(0, 0, 0, 0.06);
  }
</style>
