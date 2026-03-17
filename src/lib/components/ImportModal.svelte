<script lang="ts">
  import Icon from './Icon.svelte';
  import type { ItemType, ItemData } from '$lib/types';

  interface Props {
    onImport: (items: Array<{ title: string; type: ItemType; data: ItemData }>) => Promise<void>;
    onClose: () => void;
  }

  let { onImport, onClose }: Props = $props();

  let dragOver = $state(false);
  let parsedItems = $state<Array<{ title: string; type: ItemType; data: ItemData }>>([]);
  let parseError = $state('');
  let isImporting = $state(false);
  let importComplete = $state(false);
  let importedCount = $state(0);
  let fileName = $state('');

  // 1Password CSV columns:
  // Title, Website, Username, Password, Notes, Type, ...
  // The exact format can vary, but the common export is:
  // Title,Url,Username,Password,Notes,OTPAuth,Tags

  function parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    let current = '';
    let inQuotes = false;
    let row: string[] = [];

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (char === '"' && next === '"') {
          current += '"';
          i++; // skip escaped quote
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          row.push(current.trim());
          current = '';
        } else if (char === '\n' || (char === '\r' && next === '\n')) {
          row.push(current.trim());
          current = '';
          if (row.length > 1 || row[0] !== '') {
            rows.push(row);
          }
          row = [];
          if (char === '\r') i++; // skip \n after \r
        } else {
          current += char;
        }
      }
    }

    // Last row
    if (current || row.length > 0) {
      row.push(current.trim());
      rows.push(row);
    }

    return rows;
  }

  function detect1PasswordFormat(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    const lower = headers.map(h => h.toLowerCase().trim());

    // 1Password standard CSV export columns
    const fieldMap: Record<string, string[]> = {
      title: ['title', 'name', 'item title'],
      url: ['url', 'website', 'urls', 'login_uri', 'login uri'],
      username: ['username', 'login_username', 'login username', 'user name', 'email'],
      password: ['password', 'login_password', 'login password'],
      notes: ['notes', 'notesplain', 'extra', 'comments'],
      type: ['type', 'category', 'vault'],
      totp: ['otp', 'otpauth', 'totp', 'one-time password'],
    };

    for (const [key, aliases] of Object.entries(fieldMap)) {
      const idx = lower.findIndex(h => aliases.includes(h));
      if (idx !== -1) map[key] = idx;
    }

    return map;
  }

  function determineItemType(row: string[], colMap: Record<string, number>): ItemType {
    const typeCol = colMap.type !== undefined ? row[colMap.type]?.toLowerCase() : '';
    
    if (typeCol.includes('credit card') || typeCol.includes('card') || typeCol.includes('payment')) {
      return 'card';
    }
    if (typeCol.includes('note') || typeCol.includes('secure note')) {
      return 'note';
    }
    if (typeCol.includes('identity') || typeCol.includes('address')) {
      return 'identity';
    }

    // Default: if it has username/password fields, it's a login
    const hasUsername = colMap.username !== undefined && row[colMap.username];
    const hasPassword = colMap.password !== undefined && row[colMap.password];
    const hasUrl = colMap.url !== undefined && row[colMap.url];

    if (hasUsername || hasPassword || hasUrl) return 'login';
    if (row[colMap.notes]) return 'note';

    return 'login';
  }

  function buildItemData(row: string[], colMap: Record<string, number>, type: ItemType): ItemData {
    const get = (key: string) => (colMap[key] !== undefined ? row[colMap[key]] || '' : '');

    switch (type) {
      case 'login':
        return {
          username: get('username'),
          password: get('password'),
          url: get('url'),
          notes: get('notes'),
        };
      case 'card':
        return {
          cardholderName: get('username') || get('title'),
          number: '',
          expiry: '',
          cvv: '',
          notes: get('notes'),
        };
      case 'note':
        return {
          content: get('notes') || get('password'), // 1Password sometimes puts secure note content in notes or password field
        };
      case 'identity':
        return {
          firstName: '',
          lastName: '',
          email: get('username'),
          phone: '',
          address: '',
          notes: get('notes'),
        };
    }
  }

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      parseError = 'Please upload a CSV file. Export your 1Password data as CSV first.';
      return;
    }

    fileName = file.name;
    parseError = '';

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseCSV(text);

        if (rows.length < 2) {
          parseError = 'CSV file appears to be empty or invalid.';
          return;
        }

        const headers = rows[0];
        const colMap = detect1PasswordFormat(headers);

        if (colMap.title === undefined) {
          parseError = 'Could not detect a "Title" column. Make sure this is a 1Password CSV export.';
          return;
        }

        const dataRows = rows.slice(1);
        const items: Array<{ title: string; type: ItemType; data: ItemData }> = [];

        for (const row of dataRows) {
          const title = row[colMap.title];
          if (!title) continue; // skip empty rows

          const type = determineItemType(row, colMap);
          const data = buildItemData(row, colMap, type);

          items.push({ title, type, data });
        }

        if (items.length === 0) {
          parseError = 'No items found in the CSV file.';
          return;
        }

        parsedItems = items;
      } catch (err) {
        parseError = 'Failed to parse CSV file. Please check the format.';
        console.error('CSV parse error:', err);
      }
    };

    reader.readAsText(file);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const file = e.dataTransfer?.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver = true;
  }

  function handleDragLeave() {
    dragOver = false;
  }

  function handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) handleFile(file);
  }

  async function handleImport() {
    if (parsedItems.length === 0) return;
    isImporting = true;

    try {
      await onImport(parsedItems);
      importedCount = parsedItems.length;
      importComplete = true;
    } catch (err) {
      parseError = 'Import failed. Please try again.';
      console.error('Import error:', err);
    } finally {
      isImporting = false;
    }
  }

  function handleReset() {
    parsedItems = [];
    parseError = '';
    importComplete = false;
    importedCount = 0;
    fileName = '';
  }

  const typeLabels: Record<string, string> = {
    login: 'Login',
    card: 'Card',
    note: 'Note',
    identity: 'Identity',
  };

  let typeCounts = $derived(() => {
    const counts: Record<string, number> = {};
    for (const item of parsedItems) {
      counts[item.type] = (counts[item.type] || 0) + 1;
    }
    return counts;
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay fade-in" onclick={onClose} onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal glass" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
    <div class="modal-header">
      <div class="modal-title-row">
        <Icon name="upload" size={22} />
        <h2>Import from 1Password</h2>
      </div>
      <button class="btn btn-ghost" onclick={onClose}>
        <Icon name="x" size={18} />
      </button>
    </div>

    {#if importComplete}
      <!-- Success State -->
      <div class="import-success fade-in">
        <div class="success-icon">
          <Icon name="check-circle" size={48} />
        </div>
        <h3>Import Complete!</h3>
        <p>{importedCount} item{importedCount !== 1 ? 's' : ''} imported successfully</p>
        <button class="btn btn-primary" onclick={onClose}>Done</button>
      </div>

    {:else if parsedItems.length > 0}
      <!-- Preview State -->
      <div class="import-preview fade-in">
        <div class="preview-header">
          <div class="preview-file">
            <Icon name="document" size={16} />
            <span>{fileName}</span>
          </div>
          <button class="btn btn-ghost btn-sm" onclick={handleReset}>
            <Icon name="x" size={14} /> Clear
          </button>
        </div>

        <div class="preview-summary">
          <div class="summary-total">
            <strong>{parsedItems.length}</strong> items found
          </div>
          <div class="summary-types">
            {#each Object.entries(typeCounts()) as [type, count]}
              <span class="type-badge">
                <Icon name={type === 'login' ? 'key' : type === 'card' ? 'credit-card' : type === 'note' ? 'file-text' : 'user'} size={12} />
                {count} {typeLabels[type] || type}{count !== 1 ? 's' : ''}
              </span>
            {/each}
          </div>
        </div>

        <div class="preview-list">
          {#each parsedItems.slice(0, 10) as item, i}
            <div class="preview-item">
              <Icon name={item.type === 'login' ? 'key' : item.type === 'card' ? 'credit-card' : item.type === 'note' ? 'file-text' : 'user'} size={16} />
              <span class="preview-item-title">{item.title}</span>
              <span class="preview-item-type">{typeLabels[item.type]}</span>
            </div>
          {/each}
          {#if parsedItems.length > 10}
            <div class="preview-more">
              +{parsedItems.length - 10} more items...
            </div>
          {/if}
        </div>

        {#if parseError}
          <div class="import-error fade-in">
            <Icon name="alert-circle" size={16} />
            {parseError}
          </div>
        {/if}

        <div class="import-actions">
          <button class="btn btn-secondary" onclick={handleReset}>Cancel</button>
          <button class="btn btn-primary" onclick={handleImport} disabled={isImporting}>
            {#if isImporting}
              <span class="spinner"></span> Importing...
            {:else}
              <Icon name="download" size={16} /> Import {parsedItems.length} Items
            {/if}
          </button>
        </div>
      </div>

    {:else}
      <!-- Upload State -->
      <div class="import-instructions">
        <div class="steps">
          <div class="step">
            <span class="step-number">1</span>
            <div class="step-content">
              <strong>Export from 1Password</strong>
              <p>Open 1Password → File → Export → choose <strong>CSV</strong> format</p>
            </div>
          </div>
          <div class="step">
            <span class="step-number">2</span>
            <div class="step-content">
              <strong>Upload the CSV file</strong>
              <p>Drag it below or click to browse</p>
            </div>
          </div>
          <div class="step">
            <span class="step-number">3</span>
            <div class="step-content">
              <strong>Review & Import</strong>
              <p>Preview your items before importing them</p>
            </div>
          </div>
        </div>
      </div>

      <div
        class="drop-zone"
        class:drag-over={dragOver}
        ondrop={handleDrop}
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        role="button"
        tabindex="0"
        onkeydown={(e) => { if (e.key === 'Enter') document.getElementById('csv-file-input')?.click(); }}
      >
        <Icon name="upload" size={32} />
        <p class="drop-text">Drag your CSV file here</p>
        <p class="drop-hint">or click to browse</p>
        <input
          id="csv-file-input"
          type="file"
          accept=".csv"
          class="file-input"
          onchange={handleFileInput}
        />
      </div>

      {#if parseError}
        <div class="import-error fade-in">
          <Icon name="alert-circle" size={16} />
          {parseError}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: var(--space-lg);
  }

  .modal {
    width: 100%;
    max-width: 560px;
    max-height: 85vh;
    overflow-y: auto;
    padding: var(--space-xl);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-lg);
  }

  .modal-title-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .modal-title-row h2 {
    font-size: var(--font-xl);
    font-weight: 600;
  }

  /* Instructions */
  .import-instructions {
    margin-bottom: var(--space-lg);
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .step {
    display: flex;
    align-items: flex-start;
    gap: var(--space-md);
  }

  .step-number {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--color-primary-subtle);
    color: var(--color-primary-dark);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-sm);
    font-weight: 700;
    flex-shrink: 0;
  }

  .step-content strong {
    font-size: var(--font-sm);
    display: block;
    margin-bottom: 2px;
  }

  .step-content p {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  /* Drop zone */
  .drop-zone {
    position: relative;
    border: 2px dashed var(--glass-border);
    border-radius: var(--radius-lg);
    padding: var(--space-2xl) var(--space-lg);
    text-align: center;
    cursor: pointer;
    transition: all var(--transition-fast);
    color: var(--color-text-muted);
  }

  .drop-zone:hover, .drop-zone.drag-over {
    border-color: var(--color-primary);
    background: var(--color-primary-subtle);
    color: var(--color-primary-dark);
  }

  .drop-text {
    font-size: var(--font-base);
    font-weight: 500;
    margin-top: var(--space-sm);
    color: var(--color-text-secondary);
  }

  .drop-hint {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    margin-top: 2px;
  }

  .file-input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  /* Error */
  .import-error {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-top: var(--space-md);
    padding: 10px 14px;
    background: rgba(255, 59, 48, 0.1);
    color: var(--color-danger);
    border-radius: var(--radius-md);
    font-size: var(--font-sm);
    border: 1px solid rgba(255, 59, 48, 0.2);
  }

  /* Preview */
  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-md);
  }

  .preview-file {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
  }

  .preview-summary {
    margin-bottom: var(--space-md);
    padding: var(--space-md);
    background: var(--color-primary-subtle);
    border-radius: var(--radius-md);
  }

  .summary-total {
    font-size: var(--font-base);
    margin-bottom: var(--space-sm);
  }

  .summary-total strong {
    font-size: var(--font-lg);
    color: var(--color-primary-dark);
  }

  .summary-types {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }

  .type-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: var(--radius-full);
    font-size: var(--font-xs);
    color: var(--color-text-secondary);
  }

  .preview-list {
    max-height: 300px;
    overflow-y: auto;
    margin-bottom: var(--space-lg);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
  }

  .preview-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 10px var(--space-md);
    border-bottom: 1px solid var(--glass-border);
    font-size: var(--font-sm);
    color: var(--color-text-muted);
  }

  .preview-item:last-child {
    border-bottom: none;
  }

  .preview-item-title {
    flex: 1;
    color: var(--color-text);
    font-weight: 500;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .preview-item-type {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .preview-more {
    padding: 10px var(--space-md);
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    text-align: center;
    font-style: italic;
  }

  .import-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
  }

  .btn-sm {
    padding: 6px 12px;
    font-size: var(--font-xs);
  }

  /* Success */
  .import-success {
    text-align: center;
    padding: var(--space-xl) 0;
  }

  .success-icon {
    color: var(--color-success);
    margin-bottom: var(--space-md);
  }

  .import-success h3 {
    font-size: var(--font-xl);
    font-weight: 600;
    margin-bottom: var(--space-xs);
  }

  .import-success p {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    margin-bottom: var(--space-lg);
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
