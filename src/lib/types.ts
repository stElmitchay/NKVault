// NKVault Type Definitions

export type VaultType = 'personal' | 'shared';

export type ItemType = 'login' | 'card' | 'note' | 'identity';

export interface LoginData {
  username: string;
  password: string;
  url: string;
  notes: string;
}

export interface CardData {
  cardholderName: string;
  number: string;
  expiry: string;
  cvv: string;
  notes: string;
}

export interface NoteData {
  content: string;
}

export interface IdentityData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
}

export type ItemData = LoginData | CardData | NoteData | IdentityData;

export interface VaultItem {
  id: string;
  title: string;
  type: ItemType;
  data: ItemData;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface Vault {
  id: string;
  name: string;
  type: VaultType;
  ownerId: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

// Item type display metadata
export const ITEM_TYPE_META: Record<ItemType, { label: string; icon: string }> = {
  login: { label: 'Login', icon: 'key' },
  card: { label: 'Card', icon: 'credit-card' },
  note: { label: 'Note', icon: 'file-text' },
  identity: { label: 'Identity', icon: 'user' },
};

// Default empty data for each item type
export function getDefaultData(type: ItemType): ItemData {
  switch (type) {
    case 'login':
      return { username: '', password: '', url: '', notes: '' };
    case 'card':
      return { cardholderName: '', number: '', expiry: '', cvv: '', notes: '' };
    case 'note':
      return { content: '' };
    case 'identity':
      return { firstName: '', lastName: '', email: '', phone: '', address: '', notes: '' };
  }
}
