<script lang="ts">
  import { ITEM_TYPE_META, type ItemType } from '$lib/types';
  import { maskValue, formatDate, getFaviconUrl } from '$lib/utils/helpers';
  import { secureCopy } from '$lib/crypto/clipboard';
  import Icon from './Icon.svelte';

  interface Props {
    item: any;
    onEdit: () => void;
    onDelete: () => void;
    onToggleFavorite: () => void;
  }

  let { item, onEdit, onDelete, onToggleFavorite }: Props = $props();

  let revealedFields = $state<Set<string>>(new Set());
  let copiedField = $state<string | null>(null);
  let clipboardTimer = $state<string | null>(null);

  function toggleReveal(field: string) {
    const next = new Set(revealedFields);
    if (next.has(field)) {
      next.delete(field);
    } else {
      next.add(field);
    }
    revealedFields = next;
  }

  async function handleCopy(value: string, field: string) {
    const ok = await secureCopy(value);
    if (ok) {
      copiedField = field;
      clipboardTimer = field;
      setTimeout(() => { copiedField = null; }, 2000);
      // Show clipboard clear countdown hint
      setTimeout(() => { clipboardTimer = null; }, 5000);
    }
  }

  const sensitiveFields = ['password', 'cvv', 'number'];

  function isSensitive(fieldName: string): boolean {
    return sensitiveFields.includes(fieldName);
  }

  function getDisplayValue(fieldName: string, value: string): string {
    if (!value) return '—';
    if (isSensitive(fieldName) && !revealedFields.has(fieldName)) {
      return maskValue(value);
    }
    return value;
  }

  function getFieldLabel(key: string): string {
    const labels: Record<string, string> = {
      username: 'Username',
      password: 'Password',
      url: 'Website',
      notes: 'Notes',
      cardholderName: 'Cardholder Name',
      number: 'Card Number',
      expiry: 'Expiry Date',
      cvv: 'CVV',
      content: 'Content',
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email',
      phone: 'Phone',
      address: 'Address',
    };
    return labels[key] || key;
  }

  let showDeleteConfirm = $state(false);
</script>

<div class="item-detail fade-in">
  <div class="detail-header">
    <div class="detail-title-row">
      <div class="detail-icon">
        {#if item.type === 'login' && item.data?.url}
          <img src={getFaviconUrl(item.data.url)} alt="" class="detail-favicon" />
        {:else}
          <Icon name={ITEM_TYPE_META[item.type as ItemType]?.icon || 'document'} size={24} />
        {/if}
      </div>
      <div class="detail-title-info">
        <h2>{item.title}</h2>
        <span class="detail-type">{ITEM_TYPE_META[item.type as ItemType]?.label || item.type}</span>
      </div>
      <button
        class="favorite-toggle"
        class:is-favorite={item.favorite}
        onclick={onToggleFavorite}
      >
        <Icon name={item.favorite ? 'star' : 'star-outline'} size={22} />
      </button>
    </div>
    <div class="detail-actions">
      <button class="btn btn-secondary btn-sm" onclick={onEdit}>
        <Icon name="edit" size={14} /> Edit
      </button>
      {#if !showDeleteConfirm}
        <button class="btn btn-ghost btn-sm" onclick={() => showDeleteConfirm = true}>
          <Icon name="trash" size={14} /> Delete
        </button>
      {:else}
        <div class="delete-confirm fade-in">
          <span class="delete-confirm-text">Delete this item?</span>
          <button class="btn btn-danger btn-sm" onclick={onDelete}>Yes, Delete</button>
          <button class="btn btn-ghost btn-sm" onclick={() => showDeleteConfirm = false}>Cancel</button>
        </div>
      {/if}
    </div>
  </div>

  <div class="detail-fields">
    {#if item.data?.__encrypted === true}
      <div class="encrypted-notice">
        <Icon name="lock" size={20} />
        <div>
          <p class="encrypted-title">Cannot decrypt this item</p>
          <p class="encrypted-desc">This item was encrypted with a key that is no longer available. Delete and re-create it to fix.</p>
        </div>
      </div>
    {:else}
    {#each Object.entries(item.data || {}) as [key, value]}
      {#if value !== undefined && value !== null && value !== ''}
        <div class="field-row">
          <div class="field-label">{getFieldLabel(key)}</div>
          <div class="field-value-row">
            {#if key === 'url'}
              <a href={String(value).startsWith('http') ? String(value) : `https://${value}`} target="_blank" rel="noopener noreferrer" class="field-link">
                {value}
              </a>
            {:else if key === 'notes' || key === 'content'}
              <div class="field-long-value">{value}</div>
            {:else}
              <span class="field-value" class:monospace={isSensitive(key)}>
                {getDisplayValue(key, String(value))}
              </span>
            {/if}
            <div class="field-actions">
              {#if isSensitive(key)}
                <button
                  class="field-action-btn"
                  onclick={() => toggleReveal(key)}
                  title={revealedFields.has(key) ? 'Hide' : 'Reveal'}
                >
                  <Icon name={revealedFields.has(key) ? 'eye-off' : 'eye'} size={15} />
                </button>
              {/if}
              {#if key !== 'notes' && key !== 'content'}
                <button
                  class="field-action-btn"
                  class:copied={copiedField === key}
                  onclick={() => handleCopy(String(value), key)}
                  title="Copy (auto-clears in 30s)"
                >
                  <Icon name={copiedField === key ? 'check' : 'copy'} size={15} />
                </button>
              {/if}
            </div>
          </div>
          {#if clipboardTimer === key}
            <div class="clipboard-hint fade-in">
              <Icon name="shield" size={10} /> Clipboard auto-clears in 30s
            </div>
          {/if}
        </div>
      {/if}
    {/each}
    {/if}
  </div>

  <div class="detail-meta">
    <span>Created {formatDate(item.createdAt)}</span>
    <span>·</span>
    <span>Updated {formatDate(item.updatedAt)}</span>
  </div>
</div>

<style>
  .item-detail {
    padding: var(--space-lg);
  }

  .detail-header {
    margin-bottom: var(--space-xl);
  }

  .detail-title-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    margin-bottom: var(--space-md);
  }

  .detail-icon {
    width: 52px;
    height: 52px;
    border-radius: var(--radius-lg);
    background: var(--color-primary-subtle);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    flex-shrink: 0;
    color: var(--color-primary-dark);
  }

  .detail-favicon {
    width: 28px;
    height: 28px;
    border-radius: 6px;
  }

  .detail-title-info {
    flex: 1;
    min-width: 0;
  }

  .detail-title-info h2 {
    font-size: var(--font-xl);
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
  }

  .detail-type {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .favorite-toggle {
    padding: 4px;
    color: var(--color-text-muted);
    transition: all var(--transition-fast);
  }

  .favorite-toggle:hover {
    transform: scale(1.2);
  }

  .favorite-toggle.is-favorite {
    color: var(--color-warning);
  }

  .detail-actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .btn-sm {
    padding: 6px 14px;
    font-size: var(--font-xs);
  }

  .delete-confirm {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .delete-confirm-text {
    font-size: var(--font-sm);
    color: var(--color-danger);
  }

  .detail-fields {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .encrypted-notice {
    display: flex;
    align-items: flex-start;
    gap: var(--space-md);
    padding: 20px;
    border-radius: var(--radius-md);
    background: rgba(255, 193, 7, 0.08);
    border: 1px solid rgba(255, 193, 7, 0.2);
    color: var(--color-text-secondary);
  }

  .encrypted-title {
    font-weight: 600;
    font-size: var(--font-sm);
    color: var(--color-text);
    margin-bottom: 4px;
  }

  .encrypted-desc {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    line-height: 1.5;
  }

  .field-row {
    padding: 16px 0;
    border-bottom: 1px solid var(--glass-border);
  }

  .field-row:last-child {
    border-bottom: none;
  }

  .field-label {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .field-value-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .field-value {
    flex: 1;
    font-size: var(--font-base);
    color: var(--color-text);
    word-break: break-all;
  }

  .field-value.monospace {
    font-family: 'SF Mono', 'Fira Code', monospace;
    letter-spacing: 1px;
  }

  .field-link {
    flex: 1;
    font-size: var(--font-base);
    color: var(--color-primary-dark);
    text-decoration: underline;
    text-decoration-color: rgba(184, 255, 0, 0.3);
  }

  .field-link:hover {
    text-decoration-color: var(--color-primary-dark);
  }

  .field-long-value {
    flex: 1;
    font-size: var(--font-base);
    color: var(--color-text);
    white-space: pre-wrap;
    line-height: 1.6;
  }

  .field-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .field-action-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    transition: all var(--transition-fast);
  }

  .field-action-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text);
  }

  .field-action-btn.copied {
    color: var(--color-success);
  }

  .clipboard-hint {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--color-text-muted);
    margin-top: 4px;
    opacity: 0.7;
  }

  .detail-meta {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-xl);
    padding-top: var(--space-md);
    border-top: 1px solid var(--glass-border);
    font-size: var(--font-xs);
    color: var(--color-text-muted);
  }
</style>
