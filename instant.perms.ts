export default {
  vaults: {
    allow: {
      view: "auth.id != null",
      create: "auth.id != null",
      update: "auth.id != null",
      delete: "data.ownerId == auth.id",
    },
  },
  items: {
    allow: {
      view: "auth.id != null",
      create: "auth.id != null",
      update: "auth.id != null",
      delete: "auth.id != null",
    },
  },
  profiles: {
    allow: {
      view: "auth.id != null",
      create: "auth.id != null",
      update: "auth.id != null",
      delete: "false",
    },
  },
  sharedVaultKeys: {
    allow: {
      view: "auth.id != null",
      create: "auth.id != null",
      update: "auth.id != null",
      delete: "false",
    },
  },
  sharedVaultEscrow: {
    allow: {
      view: "auth.id != null",
      create: "auth.id != null",
      update: "auth.id != null",
      delete: "false",
    },
  },
};
