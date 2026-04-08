// NKVault — InstantDB Permissions
// Data-bound rules. Each user can only see/modify their own data.
// Shared vaults are readable by any authenticated user (by design); shared
// items are scoped via the linked vault. The escrow table is fully locked
// — see security/hardening-pass-1 PR for the redesign rationale.

export default {
  vaults: {
    allow: {
      view:   "auth.id != null && (data.ownerId == auth.id || data.type == 'shared')",
      create: "auth.id != null && data.ownerId == auth.id",
      update: "auth.id != null && data.ownerId == auth.id",
      delete: "auth.id != null && data.ownerId == auth.id",
    },
  },
  items: {
    allow: {
      // Item access flows through the parent vault link.
      view:   "auth.id != null && (auth.id in data.ref('vault.ownerId') || 'shared' in data.ref('vault.type'))",
      create: "auth.id != null && data.createdBy == auth.id",
      update: "auth.id != null && (auth.id in data.ref('vault.ownerId') || 'shared' in data.ref('vault.type'))",
      delete: "auth.id != null && (auth.id == data.createdBy || auth.id in data.ref('vault.ownerId'))",
    },
  },
  profiles: {
    allow: {
      view:   "auth.id != null && data.clerkId == auth.id",
      create: "auth.id != null && data.clerkId == auth.id",
      update: "auth.id != null && data.clerkId == auth.id",
      delete: "false",
    },
  },
  sharedVaultKeys: {
    allow: {
      view:   "auth.id != null && data.userId == auth.id",
      create: "auth.id != null && data.userId == auth.id",
      update: "auth.id != null && data.userId == auth.id",
      delete: "false",
    },
  },
  // Locked: the previous escrow design wrapped the shared key with a
  // hardcoded constant, which made the wrap key reproducible by anyone
  // with the JS bundle. The escrow flow is disabled until shared-vault
  // distribution is redesigned to use per-user wraps initiated by the
  // shared vault owner.
  sharedVaultEscrow: {
    allow: {
      view:   "false",
      create: "false",
      update: "false",
      delete: "false",
    },
  },
};
