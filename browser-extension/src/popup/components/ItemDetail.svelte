<script lang="ts">
  import Icon from './Icon.svelte';
  import { ITEM_TYPE_META, maskValue, formatDate, getFaviconUrl, type ItemType } from '$ext/shared/types';

  interface Props {
    item: any;
    onBack: () => void;
    onCopy: (text: string, label: string) => void;
    onAutofill: (item: any) => void;
  }

  let { item, onBack, onCopy, onAutofill }: Props = $props();

  let revealedFields = $state<Set<string>>(new Set());
  let copiedField = $state<string | null>(null);

  function toggleReveal(field: string) {
    const next = new Set(revealedFields);
    if (next.has(field)) {
      next.delete(field);
    } else {
      next.add(field);
    }
    revealedFields = next;
  }

  function handleCopy(value: string, field: string) {
    onCopy(value, getFieldLabel(field));
    copiedField = field;
    setTimeout(() => { copiedField = null; }, 2000);
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
      cardholderName: 'Cardholder',
      number: 'Card Number',
      expiry: 'Expiry',
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
</script>

<div class="detail-view">
  <!-- Header -->
  <div class="detail-header">
    <button class="back-btn" onclick={onBack}>
      <Icon name="arrow-left" size={16} />
    </button>
    <div class="detail-icon">
      {#if item.type === 'login' && item.data?.url}
        <img src={getFaviconUrl(item.data.url)} alt="" class="detail-favicon" />
      {:else}
        <Icon name={ITEM_TYPE_META[item.type as ItemType]?.icon || 'key'} size={20} />
      {/if}
    </div>
    <div class="detail-title-info">
      <h2>{item.title}</h2>
      <span class="detail-type">{ITEM_TYPE_META[item.type as ItemType]?.label || item.type}</span>
    </div>
    {#if item.favorite}
      <span class="fav-badge"><Icon name="star" size={14} /></span>
    {/if}
  </div>

  <!-- Autofill button for logins -->
  {#if item.type === 'login'}
    <button class="autofill-btn" onclick={() => onAutofill(item)}>
      <Icon name="key" size={14} />
      Autofill on this page
    </button>
  {/if}

  <!-- Fields -->
  <div class="detail-fields">
    {#each Object.entries(item.data || {}) as [key, value]}
      {#if value !== undefined && value !== null && value !== '' && key !== '__encrypted'}
        <div class="field-row">
          <div class="field-label">{getFieldLabel(key)}</div>
          <div class="field-value-row">
            {#if key === 'url'}
              <a href={String(value).startsWith('http') ? String(value) : `https://${value}`} target="_blank" rel="noopener" class="field-link">
                {value}
                <Icon name="external-link" size={11} />
              </a>
            {:else if key === 'notes' || key === 'content'}
              <div class="field-long-value">{value}</div>
            {:else}
              <span class="field-value" class:mono={isSensitive(key)}>
                {getDisplayValue(key, String(value))}
              </span>
            {/if}
            <div class="field-actions">
              {#if isSensitive(key)}
                <button
                  class="field-btn"
                  onclick={() => toggleReveal(key)}
                  title={revealedFields.has(key) ? 'Hide' : 'Reveal'}
                >
                  <Icon name={revealedFields.has(key) ? 'eye-off' : 'eye'} size={13} />
                </button>
              {/if}
              {#if key !== 'notes' && key !== 'content'}
                <button
                  class="field-btn"
                  class:copied={copiedField === key}
                  onclick={() => handleCopy(String(value), key)}
                  title="Copy"
                >
                  <Icon name={copiedField === key ? 'check' : 'copy'} size={13} />
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    {/each}
  </div>

  <!-- Meta -->
  <div class="detail-meta">
    <span>Created {formatDate(item.createdAt)}</span>
    <span>·</span>
    <span>Updated {formatDate(item.updatedAt)}</span>
  </div>
</div>

<style>
  .detail-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    animation: slideIn 0.15s ease;
  }

  .detail-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--glass-border);
    flex-shrink: 0;
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
    flex-shrink: 0;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text);
  }

  .detail-icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: var(--color-primary-subtle);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--color-primary-dark);
    overflow: hidden;
  }

  .detail-favicon {
    width: 22px;
    height: 22px;
    border-radius: 4px;
  }

  .detail-title-info {
    flex: 1;
    min-width: 0;
  }

  .detail-title-info h2 {
    font-size: var(--font-base);
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .detail-type {
    font-size: 10px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .fav-badge {
    color: var(--color-warning);
    flex-shrink: 0;
  }

  /* Autofill Button */
  .autofill-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin: 12px 16px 4px;
    padding: 10px;
    border-radius: var(--radius-md);
    background: var(--color-primary);
    color: #0A0A0A;
    font-weight: 600;
    font-size: var(--font-sm);
    transition: all var(--transition-fast);
    flex-shrink: 0;
  }

  .autofill-btn:hover {
    background: var(--color-primary-dark);
    box-shadow: 0 4px 16px rgba(184, 255, 0, 0.3);
    transform: translateY(-1px);
  }

  /* Fields */
  .detail-fields {
    flex: 1;
    padding: 4px 16px;
  }

  .field-row {
    padding: 12px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .field-row:last-child {
    border-bottom: none;
  }

  .field-label {
    font-size: 10px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 3px;
  }

  .field-value-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .field-value {
    flex: 1;
    font-size: var(--font-sm);
    color: var(--color-text);
    word-break: break-all;
  }

  .field-value.mono {
    font-family: 'SF Mono', 'Fira Code', monospace;
    letter-spacing: 1px;
    font-size: var(--font-xs);
  }

  .field-link {
    flex: 1;
    font-size: var(--font-sm);
    color: var(--color-primary-dark);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .field-long-value {
    flex: 1;
    font-size: var(--font-sm);
    color: var(--color-text);
    white-space: pre-wrap;
    line-height: 1.5;
  }

  .field-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .field-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    color: var(--color-text-muted);
    transition: all var(--transition-fast);
  }

  .field-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text);
  }

  .field-btn.copied {
    color: var(--color-success);
  }

  /* Meta */
  .detail-meta {
    display: flex;
    gap: 6px;
    padding: 10px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    font-size: 10px;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }
</style>
