<script lang="ts">
  import { ITEM_TYPE_META, getDefaultData, type ItemType, type ItemData } from '$lib/types';
  import { generatePassword, DEFAULT_OPTIONS } from '$lib/utils/password';
  import Icon from './Icon.svelte';

  interface Props {
    editItem?: any;
    defaultType?: ItemType;
    onSave: (title: string, type: ItemType, data: ItemData) => void;
    onCancel: () => void;
  }

  let { editItem, defaultType, onSave, onCancel }: Props = $props();

  const initialType = editItem?.type || defaultType || 'login';
  let title = $state(editItem?.title || '');
  let type = $state<ItemType>(initialType);
  let data = $state<Record<string, any>>(editItem?.data ? { ...editItem.data } : { ...getDefaultData(initialType) });
  let isSaving = $state(false);

  function handleTypeChange(e: Event) {
    const newType = (e.target as HTMLSelectElement).value as ItemType;
    type = newType;
    if (!editItem) {
      data = { ...getDefaultData(newType) };
    }
  }

  function handleFieldChange(key: string, value: string) {
    data = { ...data, [key]: value };
  }

  function handleGeneratePassword() {
    const password = generatePassword(DEFAULT_OPTIONS);
    data = { ...data, password };
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    isSaving = true;
    try {
      onSave(title, type, data as ItemData);
    } finally {
      isSaving = false;
    }
  }

  function getFieldConfig(type: ItemType): Array<{ key: string; label: string; inputType: string; multiline?: boolean }> {
    switch (type) {
      case 'login':
        return [
          { key: 'username', label: 'Username', inputType: 'text' },
          { key: 'password', label: 'Password', inputType: 'password' },
          { key: 'url', label: 'Website URL', inputType: 'url' },
          { key: 'notes', label: 'Notes', inputType: 'text', multiline: true },
        ];
      case 'card':
        return [
          { key: 'cardholderName', label: 'Cardholder Name', inputType: 'text' },
          { key: 'number', label: 'Card Number', inputType: 'text' },
          { key: 'expiry', label: 'Expiry Date', inputType: 'text' },
          { key: 'cvv', label: 'CVV', inputType: 'password' },
          { key: 'notes', label: 'Notes', inputType: 'text', multiline: true },
        ];
      case 'note':
        return [
          { key: 'content', label: 'Content', inputType: 'text', multiline: true },
        ];
      case 'identity':
        return [
          { key: 'firstName', label: 'First Name', inputType: 'text' },
          { key: 'lastName', label: 'Last Name', inputType: 'text' },
          { key: 'email', label: 'Email', inputType: 'email' },
          { key: 'phone', label: 'Phone', inputType: 'tel' },
          { key: 'address', label: 'Address', inputType: 'text', multiline: true },
          { key: 'notes', label: 'Notes', inputType: 'text', multiline: true },
        ];
    }
  }
</script>

<div class="item-form fade-in">
  <div class="form-header">
    <h2>{editItem ? 'Edit Item' : `New ${ITEM_TYPE_META[type]?.label || 'Item'}`}</h2>
    <button class="btn btn-ghost" onclick={onCancel}>
      <Icon name="x" size={18} />
    </button>
  </div>

  <form onsubmit={handleSubmit}>
    <div class="form-fields">
      <div class="input-group">
        <label for="item-title">Title</label>
        <input
          id="item-title"
          type="text"
          class="input"
          placeholder="e.g. Gmail, Visa Card..."
          bind:value={title}
          required
          autofocus
        />
      </div>

      {#if !editItem}
        <div class="input-group">
          <label for="item-type">Type</label>
          <select id="item-type" class="select" value={type} onchange={handleTypeChange}>
            {#each Object.entries(ITEM_TYPE_META) as [value, meta]}
              <option {value}>{meta.label}</option>
            {/each}
          </select>
        </div>
      {/if}

      <div class="form-divider"></div>

      {#each getFieldConfig(type) as field (field.key)}
        <div class="input-group">
          <label for="field-{field.key}">{field.label}</label>
          <div class="field-input-row">
            {#if field.multiline}
              <textarea
                id="field-{field.key}"
                class="input"
                placeholder={field.label}
                value={data[field.key] || ''}
                oninput={(e) => handleFieldChange(field.key, (e.target as HTMLTextAreaElement).value)}
              ></textarea>
            {:else}
              <input
                id="field-{field.key}"
                type={field.inputType}
                class="input"
                placeholder={field.label}
                value={data[field.key] || ''}
                oninput={(e) => handleFieldChange(field.key, (e.target as HTMLInputElement).value)}
              />
            {/if}
            {#if field.key === 'password'}
              <button
                type="button"
                class="btn btn-secondary generate-btn"
                onclick={handleGeneratePassword}
                title="Generate password"
              >
                <Icon name="dice" size={18} />
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-secondary" onclick={onCancel}>Cancel</button>
      <button type="submit" class="btn btn-primary" disabled={isSaving || !title.trim()}>
        {#if isSaving}
          Saving...
        {:else}
          {editItem ? 'Save Changes' : 'Create Item'}
        {/if}
      </button>
    </div>
  </form>
</div>

<style>
  .item-form {
    padding: var(--space-lg);
  }

  .form-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-xl);
  }

  .form-header h2 {
    font-size: var(--font-xl);
    font-weight: 600;
  }

  .form-fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    margin-bottom: var(--space-xl);
  }

  .form-divider {
    height: 1px;
    background: var(--glass-border);
    margin: var(--space-sm) 0;
  }

  .field-input-row {
    display: flex;
    gap: var(--space-sm);
  }

  .field-input-row .input {
    flex: 1;
  }

  .generate-btn {
    flex-shrink: 0;
    padding: 12px;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
    padding-top: var(--space-md);
    border-top: 1px solid var(--glass-border);
  }
</style>
