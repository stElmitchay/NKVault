<script lang="ts">
  import Icon from './Icon.svelte';
  import { ITEM_TYPE_META, getItemSubtitle, getFaviconUrl } from '$ext/shared/types';

  interface Props {
    items: any[];
    activeFilter: string;
    onSelect: (item: any) => void;
    onFilterChange: (filter: string) => void;
  }

  let { items, activeFilter, onSelect, onFilterChange }: Props = $props();

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'login', label: 'Logins' },
    { key: 'card', label: 'Cards' },
    { key: 'note', label: 'Notes' },
    { key: 'identity', label: 'IDs' },
    { key: 'favorites', label: '★' },
  ];
</script>

<div class="vault-list">
  <!-- Filter Tabs -->
  <div class="filter-tabs">
    {#each filters as f}
      <button
        class="filter-tab"
        class:active={activeFilter === f.key}
        onclick={() => onFilterChange(f.key)}
      >
        {f.label}
      </button>
    {/each}
  </div>

  <!-- Items -->
  <div class="items-scroll">
    {#if items.length === 0}
      <div class="empty-state">
        <Icon name="inbox" size={32} />
        <p>No items found</p>
      </div>
    {:else}
      {#each items as item, i (item.id)}
        <button
          class="item-row"
          onclick={() => onSelect(item)}
          style="animation-delay: {i * 25}ms"
        >
          <div class="item-icon">
            {#if item.type === 'login' && item.data?.url}
              <img
                src={getFaviconUrl(item.data.url)}
                alt=""
                class="favicon"
                onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            {:else}
              <Icon name={ITEM_TYPE_META[item.type as keyof typeof ITEM_TYPE_META]?.icon || 'key'} size={16} />
            {/if}
          </div>
          <div class="item-info">
            <span class="item-title">{item.title}</span>
            <span class="item-subtitle">{getItemSubtitle(item)}</span>
          </div>
          {#if item.favorite}
            <span class="fav-indicator">
              <Icon name="star" size={12} />
            </span>
          {/if}
          <Icon name="chevron-right" size={14} class="chevron" />
        </button>
      {/each}
    {/if}
  </div>
</div>

<style>
  .vault-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  /* Filter Tabs */
  .filter-tabs {
    display: flex;
    gap: 2px;
    padding: 6px 12px;
    flex-shrink: 0;
    overflow-x: auto;
  }

  .filter-tabs::-webkit-scrollbar { display: none; }

  .filter-tab {
    padding: 5px 10px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-muted);
    white-space: nowrap;
    transition: all var(--transition-fast);
    flex-shrink: 0;
  }

  .filter-tab:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text-secondary);
  }

  .filter-tab.active {
    background: var(--color-primary);
    color: #0A0A0A;
    font-weight: 600;
  }

  /* Items */
  .items-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 4px 12px;
  }

  .item-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 8px;
    border-radius: var(--radius-md);
    width: 100%;
    text-align: left;
    transition: background var(--transition-fast);
    animation: fadeIn 0.2s ease both;
  }

  .item-row:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .item-icon {
    width: 34px;
    height: 34px;
    border-radius: var(--radius-sm);
    background: var(--color-primary-subtle);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--color-primary-dark);
    overflow: hidden;
  }

  .favicon {
    width: 18px;
    height: 18px;
    border-radius: 3px;
  }

  .item-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
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

  .fav-indicator {
    color: var(--color-warning);
    flex-shrink: 0;
    display: flex;
  }

  :global(.chevron) {
    color: var(--color-text-muted);
    opacity: 0.4;
    flex-shrink: 0;
  }

  /* Empty */
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 40px 20px;
    color: var(--color-text-muted);
  }

  .empty-state p {
    font-size: var(--font-sm);
  }
</style>
