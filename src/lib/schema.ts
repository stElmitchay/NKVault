import { i } from '@instantdb/core';

const schema = i.schema({
  entities: {
    vaults: i.entity({
      name: i.string(),
      type: i.string(),     // 'personal' | 'shared'
      ownerId: i.string(),
    }),
    items: i.entity({
      title: i.string(),
      type: i.string(),     // 'login' | 'card' | 'note' | 'identity'
      data: i.json(),       // JSON blob — plaintext or EncryptedBlob { __encrypted, iv, ciphertext }
      favorite: i.boolean(),
      createdAt: i.number(),
      updatedAt: i.number(),
      createdBy: i.string(),
      vaultId: i.string(),  // Reference to parent vault
    }),
    profiles: i.entity({
      clerkId: i.string(),
      email: i.string(),
      walletAddress: i.string(),
      encryptedVaultKey: i.string(),
      // Per-profile random salt (base64) for HKDF wallet key derivation.
      // Optional for backwards-compat with profiles created before
      // security/hardening-pass-1.
      kdfSalt: i.string().optional(),
      hasCompletedSetup: i.boolean(),
      createdAt: i.number(),
    }),
    sharedVaultKeys: i.entity({
      userId: i.string(),
      encryptedSharedKey: i.string(),
      createdAt: i.number(),
    }),
    sharedVaultEscrow: i.entity({
      encryptedSharedKey: i.string(),
      createdAt: i.number(),
    }),
  },
  links: {
    vaultItems: {
      forward: { on: 'vaults', has: 'many', label: 'items' },
      reverse: { on: 'items', has: 'one', label: 'vault' },
    },
  },
});

export default schema;
export type Schema = typeof schema;
