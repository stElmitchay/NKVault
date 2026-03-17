// NKVault Helper Utilities

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function maskValue(value: string, visibleChars: number = 4): string {
  if (value.length <= visibleChars) return '•'.repeat(value.length);
  return '•'.repeat(value.length - visibleChars) + value.slice(-visibleChars);
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getItemSubtitle(item: any): string {
  switch (item.type) {
    case 'login':
      return item.data?.username || item.data?.url || 'No username';
    case 'card':
      return item.data?.number ? `•••• ${item.data.number.slice(-4)}` : 'No card number';
    case 'note':
      return item.data?.content?.substring(0, 50) || 'Empty note';
    case 'identity':
      return [item.data?.firstName, item.data?.lastName].filter(Boolean).join(' ') || 'No name';
    default:
      return '';
  }
}

export function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return '';
  }
}
