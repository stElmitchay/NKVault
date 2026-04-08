# NKVault Threat Model

This document is the source of truth for what NKVault protects against,
what it does not, and where each defense lives in the codebase. If a
claim in marketing copy or in the README is not backed by something in
this document, the claim is wrong.

Last updated: docs/threat-model-correction (companion to PR #3).

---

## 0. Design principle: wallet-as-personal-key, org-as-recovery

NKVault makes one product decision that everything else flows from:

> **Your wallet IS your personal vault key. There is no recovery for
> personal items. Your organization (the shared vault) is the recovery
> story for everything that needs to survive a lost wallet.**

Concretely, for a `@christex.foundation` user:

1. **Personal items** (passwords, notes, cards, identities saved to
   "Personal Vault") are encrypted under a key derived from a Solana
   wallet signature. If the user loses that wallet, those items are
   gone forever. There is no recovery code, no master password, no
   secret-question fallback, no admin override. **By design.** The
   moment a recovery channel exists, the server-side adversary
   (§2 #4) gains a path to plaintext.

2. **Shared items** (passwords stored in "Shared Vault") belong to
   the organization, not the individual. If a user loses their wallet
   they re-authenticate via InstantDB magic-code (their company email
   still works), set up a new wallet, and another existing member of
   the shared vault re-grants them access by re-wrapping the shared
   key under the new wallet's membership public key. They lose their
   personal items but the organization's institutional knowledge
   survives.

This is a deliberate trade — NKVault is *less recoverable* than a
typical password manager and *more confidential*. Anyone who finds
this trade unacceptable should not use NKVault.

> **Current build gap (tracked, not resolved here):** Pass-1 of the
> security hardening removed the original shared-vault escrow flow
> because it derived its wrap key from a constant in the JS bundle,
> which broke the zero-knowledge claim for shared data. The
> replacement — per-user wrap with each member's wallet-derived
> membership key — is the subject of PR #4. Until #4 lands, the
> shared vault is non-functional after a wallet change, which means
> the recovery story above is **promised but not yet delivered**.
> The README and the WalletSetup screen must not claim shared-vault
> recovery works until #4 ships.

---

## 1. Assets

| Asset | What it is | Where it lives |
|-------|------------|----------------|
| **Vault key** | Random AES-256-GCM key that encrypts every item in a user's personal vault. | In memory only, while the vault is unlocked. Persisted only as a wrapped blob (`profiles.encryptedVaultKey`) in InstantDB. |
| **Wrap key** | Derived from a Solana wallet signature via HKDF-SHA256 + per-profile salt. Used solely to wrap/unwrap the vault key. | Never persisted. Re-derived on every unlock. |
| **Item ciphertext** | AES-256-GCM blob containing a JSON-serialized item (`title` and `data` are encrypted separately). | InstantDB `items` table. |
| **Item plaintext** | Decrypted title + data of an item (passwords, notes, card numbers, etc.). | In memory only. List view holds non-secret display fields; full plaintext exists only for the currently selected item. See §6. |
| **Profile metadata** | `email`, `walletAddress`, `kdfSalt`, `hasCompletedSetup`, and (after PR #4) `membershipPubKey` — the X25519 public key derived from the user's wallet signature, used by other members to wrap the shared key for them. Not secret on its own, but `walletAddress` + `kdfSalt` + `encryptedVaultKey` together enable an offline attack against a stolen wallet. | InstantDB `profiles` table. Read/write restricted to `auth.id == clerkId` — see `instant.perms.ts`. |
| **Shared vault membership wrap** | The shared vault's symmetric AES-256 key, encrypted *to a single member's wallet-derived X25519 public key* using XChaCha20-Poly1305. One row per (vault, member). Added in PR #4. | InstantDB `sharedVaultMembers` table. Read restricted to `data.userId == auth.id`. |

## 2. Adversaries

NKVault is designed against the following adversaries, in increasing
order of capability:

1. **Curious peer.** Another authenticated user of the same NKVault
   instance who wants to read or modify someone else's vault.
2. **Passive network observer.** Someone who can see TLS traffic between
   the client and InstantDB.
3. **Hostile website.** A page the user happens to be visiting in the
   same browser, which may try to phish, exfiltrate, or trick the
   browser extension into auto-filling.
4. **InstantDB-side observer.** The database operator, or anyone who
   gains read access to the database.
5. **Lost device (locked).** A user's laptop is stolen while the screen
   is locked and the vault is locked.
6. **Lost device (unlocked).** A user's laptop is stolen while the
   vault is unlocked.

## 3. Out of scope

The following are explicitly **not** defended against. Any user who is
in one of these scenarios should treat their vault as compromised.

- **Compromised endpoint.** Malware on the user's machine, a malicious
  browser extension with `<all_urls>` access, or a keylogger. NKVault
  cannot defend against code running with the user's privileges.
- **Compromised wallet.** If the user's Solana wallet seed is stolen,
  the attacker can sign the vault-derivation message and unwrap the
  vault key. The HKDF salt and the per-user `info` string raise the
  cost of a phishing-style replay (the attacker must also obtain the
  victim's `kdfSalt` from the database, which now requires authenticating
  as the victim — see §5.1) but they cannot stop a full wallet compromise.
- **Loss of the personal vault.** If the user loses their wallet and
  cannot sign with it again, every item in their personal vault is
  permanently inaccessible. This is **by design** (§0). NKVault has
  no recovery codes, no Shamir splits, no admin override. The user
  retains access to the *shared* vault via the re-auth flow (§5.10),
  but their personal items are gone. This is the explicit trade
  NKVault makes to keep the personal vault genuinely zero-knowledge.
- **Cryptanalysis of AES-256-GCM, HKDF-SHA256, or Ed25519.** If any
  of those primitives is broken, NKVault is broken.
- **Side channels** (timing, power, EM, microarchitectural) on
  WebCrypto operations. Mitigation depends on browser implementations.
- **Server-side denial of service.** InstantDB outages, rate limiting,
  or quota issues are an availability concern, not a confidentiality
  one.
- **Coercion.** "Rubber-hose" attacks where the user is forced to
  unlock the vault.

## 4. Trust boundaries

```
+--------------------------+    HTTPS / WSS     +-------------------+
|      Browser (user)      |  <==============>  |    InstantDB      |
|                          |                    |                   |
|  +--------------------+  |                    |  - profiles       |
|  |  NKVault web app   |  |                    |  - vaults         |
|  |  (zero-knowledge)  |  |                    |  - items (cipher) |
|  +---------+----------+  |                    |  - sharedVault*   |
|            |             |                    +-------------------+
|     postMessage          |                    Sees: ciphertexts, IVs,
|     (origin-scoped,      |                          metadata, perms
|      lock signal only)   |
|            v             |
|  +--------------------+  |
|  | NKVault extension  |  |
|  | (own DB session)   |  |
|  +--------------------+  |
+--------------------------+
```

Trust crosses these boundaries:

- **Browser ↔ InstantDB:** TLS protects in-flight; permissions
  (`instant.perms.ts`) protect at-rest. The server sees ciphertexts and
  metadata only — never plaintext or wrap keys.
- **Web app ↔ extension:** The two contexts share *no* secrets via
  postMessage. The web app only emits a `NKVAULT_VAULT_LOCKED` signal,
  scoped to `window.location.origin`. The extension authenticates and
  derives its own vault key independently via the wallet path.
- **Web app ↔ third-party iframes:** None trusted. CSP blocks
  `frame-ancestors`, and there are no postMessage broadcasts to `*`.
- **Content script ↔ web page DOM:** Content script never injects
  vault data into a page's DOM via `innerHTML`. Vault data flows
  through escaped attributes only, with URL validation on favicons.

## 5. Defenses, mapped to code

### 5.1 Authorization (defense against adversary 1, 4)

InstantDB permissions are data-bound:

- `instant.perms.ts:vaults` — `view/update/delete` require
  `data.ownerId == auth.id` (or `type == 'shared'` for view).
- `instant.perms.ts:profiles` — all operations require
  `data.clerkId == auth.id`.
- `instant.perms.ts:items` — scoped via the linked vault.
- `instant.perms.ts:sharedVaultEscrow` — fully locked (`false`) until
  the per-user-wrap redesign lands.

A second authenticated `@christex.foundation` user **cannot** read
another user's profile, vault, items, or `kdfSalt`.

### 5.2 Confidentiality at rest (defense against 2, 4)

- `src/lib/crypto/aes.ts` — AES-256-GCM with a fresh random 12-byte IV
  per operation. Authenticated, so tampered ciphertexts are rejected.
- `src/lib/crypto/keys.ts` — vault key is a randomly generated AES-256
  key, wrapped with `crypto.subtle.wrapKey`.
- The InstantDB server only ever sees `EncryptedBlob` JSON, never
  plaintext.

### 5.3 Key derivation (defense against 4, partially against 5)

- `src/lib/crypto/wallet.ts:deriveKeyFromWallet` — HKDF-SHA256
  - **IKM:** the 64-byte Ed25519 signature over a deterministic
    message that includes the user's email.
  - **Salt:** 32 bytes of `crypto.getRandomValues`, generated on first
    setup, persisted in `profiles.kdfSalt`.
  - **Info:** `"NKVault v2 wrapKey:" + userId` — domain separation
    binds the derived key to a specific user.
- Legacy v1 path (`SHA-256(signature)`) is retained as a fallback so
  pre-pass-1 profiles still unlock; they auto-migrate to v2 on next
  unlock — see `src/lib/stores/crypto.svelte.ts:unlockWithWallet`.

### 5.4 Key distribution (defense against 3)

- `src/routes/+layout.svelte` — vault key is **never** exported or
  sent over `window.postMessage`. The lock-state signal uses
  `window.location.origin` as the target origin.
- `browser-extension/src/content/content.ts` — listens only for
  `NKVAULT_VAULT_LOCKED` and only from production NKVault origins.
  Ignores any `*_VAULT_KEY_SYNC` or `*_AUTH_SYNC` traffic.
- `browser-extension/src/background/service-worker.ts` — auth state
  comes exclusively from `db.subscribeAuth`. The legacy `SAVE_AUTH`
  message is stubbed.

### 5.5 Extension DOM safety (defense against 3)

- `escapeHtml` escapes `<>&"'` (all five entities).
- `safeFaviconUrl` validates protocol + hostname before constructing
  any URL string. Favicon `<img>` tags are omitted entirely if the URL
  fails validation.
- `<all_urls>` content script no longer auto-fills signup forms
  without an explicit user gesture.

### 5.6 Session lifetime (defense against 5, 6)

- `src/lib/crypto/session.ts` — vault key is cleared on:
  - `pagehide` (covers tab discard, bfcache eviction, navigation away)
  - `beforeunload`
  - 10 minutes of no user input (idle timeout)
- Browser extension service worker auto-locks after 15 minutes of
  user-gesture-free time.

### 5.7 Plaintext lifetime in memory (defense against 3, 6)

- `src/lib/stores/vault.svelte.ts` — list view stores only
  non-secret display fields (title, type, username/url for logins,
  card last-4, note preview, identity name). The full plaintext of an
  item exists only when the user has selected it for viewing or editing.
  Deselecting clears it.
- This is enforced by `decryptItemsForList` (strips secret fields)
  and `decryptItemFull` (returns full plaintext for one item only).
- Caveat: JavaScript strings cannot be reliably zeroized. This
  reduces the *window* during which plaintext is in memory but does
  not eliminate it. Anyone with full access to the renderer process
  (adversary out-of-scope) can recover plaintext.

### 5.8 Transport (defense against 2)

- Content-Security-Policy in `src/app.html` restricts `connect-src`
  to `'self' https://*.instantdb.com wss://*.instantdb.com`. No
  third-party origins can be reached from the page.
- `frame-ancestors 'none'` prevents the app from being embedded.

### 5.9 Generated passwords (defense against weak randomness)

- `src/lib/utils/password.ts` — uses `crypto.getRandomValues` with
  rejection sampling on the 32-bit RNG, eliminating modulo bias.
  Required-class inclusion is deterministic to ensure user options
  are honored.

### 5.10 Re-auth recovery for the shared vault (planned, PR #4)

This is the *only* recovery channel NKVault supports, and it
deliberately recovers the *organization's* shared knowledge — never
the individual's personal items.

The flow, once PR #4 ships:

1. User loses their wallet.
2. User signs in to NKVault via InstantDB magic-code using their
   `@christex.foundation` email. This proves possession of the email
   account but does **not** unlock anything yet.
3. The app detects an existing profile with a wallet address that
   no longer matches any wallet the user can sign with, and offers
   a "Set up new wallet" flow.
4. User connects a new Solana wallet and signs the deterministic
   message. The app generates a new `kdfSalt`, derives a new HKDF
   wrap key, generates a *new* random vault key, and writes a fresh
   `encryptedVaultKey` and a fresh `membershipPubKey` to the user's
   profile. The personal vault is now empty (the old `encryptedVaultKey`
   was wrapped with a key the user can no longer derive — it stays
   in the database as inert ciphertext). **The user's old personal
   items are gone, by design.**
5. The user's old `sharedVaultMembers` rows reference an X25519
   private key the user can no longer derive. They are stale.
6. Any existing member of the shared vault can re-grant access by
   fetching the user's new `membershipPubKey` from their profile
   and writing a fresh `sharedVaultMembers` row containing the
   shared key wrapped to the new public key.
7. On next unlock, the user derives the new membership X25519 keypair
   from their new wallet signature, finds the new row, and decrypts
   the shared key. They now see every item in the shared vault, just
   as before — including any items they themselves had stored there
   under their *old* wallet, because shared items were always
   encrypted under the (unchanged) shared key, not the user's
   personal vault key.

What this flow protects:
- Confidentiality of personal items, even against the user themselves
  after wallet loss.
- Integrity of organizational knowledge across personnel transitions
  (lost laptop, new device, etc.).

What this flow does **not** protect:
- A user who loses their wallet *and* whose `@christex.foundation`
  email account is also compromised — that attacker can re-auth and
  receive a re-grant from any well-meaning existing member. Defense:
  the existing member should verify the request out-of-band (Slack,
  in person) before granting. This is documented in the WalletSetup
  copy in PR #4.
- A user who is the *only* member of a shared vault and loses their
  wallet. There is no one to re-grant them. Their shared vault is
  inaccessible. Defense: shared vaults should always have at least
  two members. The grant UI in PR #4 will warn on single-member
  vaults.

## 6. Plaintext-in-memory model

For each item in the user's vault, plaintext exists in memory only in
the following cases:

| State | What plaintext is in memory |
|-------|-----------------------------|
| Vault locked | Nothing. |
| Vault unlocked, no item selected | For each item in the *currently visible filtered list*: title, type, favorite flag, vault id, plus pre-rendered list metadata (login `username`/`url`, card last-4 string, note preview ≤50 chars, identity first/last name). **No** passwords, no card numbers, no notes, no CVVs, no secret fields. |
| Vault unlocked, item selected | The above, plus the *full* decrypted `data` of the single selected item. |
| Vault unlocked, item being edited | Same as "selected" — the form binds to the same `decryptedData`. |
| Vault locked again (manual or idle) | Everything cleared. |

## 7. Known gaps and follow-ups

These are not bugs — they are conscious limitations being tracked.
(Personal-vault recovery is **not** in this list. It is intentionally
absent — see §0.)

1. **Shared vault per-user wrap (PR #4, in progress).** The recovery
   story in §0 depends on the shared vault working: a user with a
   new wallet must be able to be re-granted access by an existing
   member. The escrow flow that previously did this was insecure
   (the wrap key was derived from a constant in the JS bundle) and
   has been removed. The replacement is a per-member wrap where
   every member publishes a wallet-derived X25519 membership public
   key in their profile, and an existing member re-wraps the shared
   key to that public key when granting access. Until PR #4 ships,
   the shared vault is non-functional and the recovery story is a
   promise, not a delivered feature.
2. **Memory zeroization.** JavaScript strings can't be wiped. The
   only mitigation is reducing the *time* plaintext spends in memory,
   which §5.7 does.
3. **Server-side email allow-list.** The `@christex.foundation`
   allow-list is enforced only client-side; should be configured in
   the InstantDB dashboard as well.
4. **Self-hosted favicon proxy.** Favicons are fetched from
   `google.com/s2/favicons`, which leaks saved hostnames.
5. **Adapter pin.** `svelte.config.js` uses `adapter-auto`. Should
   be pinned to `adapter-static` to prevent accidental Node functions.
6. **Third-party security audit.** Has not been performed. Should
   happen after PR #4 ships, since the shared-vault crypto is the
   most novel piece of the design.

## 8. Reporting a vulnerability

If you believe you have found a security issue in NKVault, please
do not open a public GitHub issue. Email the maintainers (see
`README.md` for contact) with a description and reproduction steps.
We will acknowledge within 72 hours.
