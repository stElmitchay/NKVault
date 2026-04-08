<p align="center">
  <img src="static/logo-green.png" alt="NKVault" width="80" />
</p>

<h1 align="center">NKVault</h1>
<p align="center">
  <strong>NO-Knowledge Vault — Zero-knowledge password manager</strong>
</p>
<p align="center">
  <a href="#features">Features</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#recovery-model">Recovery model</a> •
  <a href="#security">Security</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#browser-extension">Browser Extension</a> •
  <a href="#contributing">Contributing</a>
</p>
<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-B8FF00?style=flat-square" alt="MIT License" />
  <img src="https://img.shields.io/badge/svelte-5-FF3E00?style=flat-square&logo=svelte&logoColor=white" alt="Svelte 5" />
  <img src="https://img.shields.io/badge/encryption-AES--256--GCM-00D68F?style=flat-square" alt="AES-256-GCM" />
  <img src="https://img.shields.io/badge/auth-Solana_Wallet-9945FF?style=flat-square&logo=solana&logoColor=white" alt="Solana Wallet" />
</p>

---

## What is NKVault?

NKVault is a **zero-knowledge password manager** where your data is encrypted client-side before it ever touches a server. No one — not even the server — can read your passwords.

Your vault key is derived from your **Solana wallet signature**, meaning only your physical wallet can unlock your data. No master password to remember, no server-side secrets to leak, **no recovery codes**.

> **Read this before you use NKVault.** Your wallet *is* your personal vault. If you lose it, your personal items are gone forever — there is no recovery. This is the trade NKVault makes to keep your personal vault genuinely zero-knowledge. Your organization's **shared vault** is the recovery story for everything that needs to survive a lost wallet: re-authenticate with your company email, set up a new wallet, and another member re-grants you access. See [Recovery model](#recovery-model) below.

## Features

### 🔐 Zero-Knowledge Architecture
- All encryption/decryption happens **in your browser** using the Web Crypto API
- AES-256-GCM encryption with unique IVs per operation
- Vault key never leaves the client, never stored on any server

### 🪙 Wallet-Based Authentication
- Sign in with your Solana wallet (Phantom, Solflare, etc.)
- HKDF-SHA256 key derivation from a wallet signature, with a fresh per-profile random salt and a userId-bound domain-separation context
- No master password required — your wallet IS your key
- **No recovery for personal items.** This is intentional. See [Recovery model](#recovery-model).

### 📦 Store Everything
- **Logins** — username, password, URL with favicon
- **Credit Cards** — card number, expiry, CVV
- **Secure Notes** — free-form encrypted text
- **Identities** — name, email, phone, address

### 🌐 Browser Extension (Chrome & Opera)
- **Autofill** — detects login forms and fills credentials on user click
- **Autosave** — prompts to save new logins or update changed passwords
- **Password generator** — create strong passwords instantly
- **URL matching** — suggests relevant credentials per site

> **Note on autofill safety.** Earlier versions of the extension auto-filled signup forms with identity data + a generated password without an explicit user gesture. That was removed in security/hardening-pass-1: a heuristic running on `<all_urls>` could be triggered by any page that looked like a signup form, and the resulting plaintext password was readable from the page DOM. **Filling now always requires a user click on the badge.**

### 🔄 Real-Time Sync
- Powered by [InstantDB](https://instantdb.com) — changes sync across devices instantly
- Personal vault per user, plus an organization-wide shared vault
- Works offline, syncs when reconnected

### 🎨 Premium UI
- Dark-mode-first design with lime green accents (`#B8FF00`)
- Space Grotesk typography
- Smooth animations and micro-interactions
- Responsive layout (desktop + tablet)

## How It Works

```
┌──────────────┐    ┌─────────────────────┐    ┌──────────────┐
│  Your Wallet │───▶│  HKDF-SHA256        │───▶│  Wrap Key    │
│  (Phantom)   │sig │  salt = profile     │    │  (AES-256)   │
│              │    │  info = userId      │    │              │
└──────────────┘    └─────────────────────┘    └──────┬───────┘
                                                      │ unwrap
                                                      ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Your Data   │───▶│   Encrypt    │───▶│  InstantDB   │
│  (plaintext) │    │  (AES-GCM)   │    │  (encrypted) │
└──────────────┘    └──────────────┘    └──────────────┘
        ▲ vault key
        │
┌──────────────┐
│ Random AES   │
│   vault key  │
└──────────────┘
```

1. **Connect** your Solana wallet.
2. **Sign** a deterministic message — Ed25519 signatures are deterministic, so the same wallet always produces the same signature for the same message.
3. **Derive** a wrap key with HKDF-SHA256, using a fresh random salt stored in your profile and a domain-separation `info` string of `"NKVault v2 wrapKey:" + userId`.
4. **Generate** a random vault key (AES-256-GCM) on first setup, and wrap it under the HKDF-derived wrap key.
5. **Encrypt** every item's title and data under the vault key with a fresh 12-byte IV per operation before syncing.

The server only ever sees encrypted blobs and a salt. Your plaintext data never leaves your device. Your wrap key is re-derived in memory on every unlock and cleared on lock, page hide, or after 10 minutes of idle.

## Recovery model

NKVault has exactly one recovery channel, and it deliberately recovers the **organization's** shared knowledge — never an individual's personal items.

### What happens if you lose your wallet

| Vault | What happens |
|-------|--------------|
| **Personal vault** | **Gone. Permanently.** Your personal items were encrypted under a key derived from your wallet signature. With no wallet, the signature can't be reproduced and the wrap key can't be re-derived. NKVault has no recovery codes, no Shamir splits, no admin override. This is by design — the moment a recovery channel exists, the database operator gains a path to your plaintext. |
| **Shared vault** | **Recoverable.** Your `@christex.foundation` email still authenticates you via InstantDB magic-code. You set up a new wallet, and another existing member of the shared vault re-grants you access by re-wrapping the shared key under your new wallet's membership public key. You see every item in the shared vault again — including items you yourself stored there under your old wallet, because shared items were always encrypted under the (unchanged) shared key. |

### Why we made this trade

A typical password manager has a master password and a server-side hash. If you forget the password, you lose your vault. The server can offer "reset via email" because it holds enough state to do so — which means the server holds enough state to read your vault if it wants to (or is compelled to).

NKVault holds no such state. The only thing on the server is ciphertext, a wallet address, and a salt. The cost is that there is no fallback if you lose the only thing that can produce the signature. We think that cost is worth paying for a tool used by people who store sensitive credentials.

### Practical advice

- **Treat your wallet seed like the real master password it is.** Back it up the way wallet users normally back up seeds.
- **Don't be the only member of your shared vault.** A single-member shared vault has no one to re-grant access. The grant UI will warn you about this.
- **For credentials your team needs even if you vanish, save them to the shared vault.** Personal vault is for things only you need.
- **When granting access to a returning member, verify the request out-of-band** (Slack, in person). Their email being authenticated proves only that they hold the email account, not that they are who you think they are.

> **Status:** The shared-vault re-grant flow was insecure in earlier builds (the wrap key was derived from a constant in the JS bundle) and was removed in security/hardening-pass-1. The replacement — per-member wrap with each member's wallet-derived X25519 membership public key — is the subject of PR #4. Until that ships, the shared vault is non-functional after a wallet change. See `docs/THREAT_MODEL.md` §0 and §5.10 for the full design.

## Security

| Aspect | Detail |
|--------|--------|
| **Encryption** | AES-256-GCM with a fresh random 12-byte IV per operation |
| **Key Derivation** | Solana wallet signature → HKDF-SHA256 with a per-profile random salt and a `userId`-bound `info` string. Legacy SHA-256 path retained for one-time auto-migration of pre-pass-1 profiles. |
| **Key Storage** | Vault key is randomly generated, wrapped with the HKDF-derived wrap key, and stored as ciphertext in InstantDB. The wrap key is never persisted. |
| **Session Key** | Held in memory only. Cleared on page hide, page unload, manual lock, or 10 minutes of idle. |
| **Auto-Lock** | Web app: 10-minute idle timer. Browser extension: 15 minutes of no user-gesture messages. |
| **Clipboard** | Copied passwords auto-clear after a user-configurable interval (default 30s). The clear path blindly overwrites rather than reading first, so it works even when the popup loses focus. |
| **Extension** | The web app **never** broadcasts the vault key to the extension. The extension authenticates via its own InstantDB session and derives its own vault key from the same wallet signature path. The web app only emits an origin-scoped lock signal. |
| **Plaintext in memory** | The list view holds only non-secret display fields. Full plaintext exists only for the currently selected item and is cleared on navigation. See `docs/THREAT_MODEL.md` §6. |
| **Zero Knowledge** | Server stores ciphertext, wallet addresses, and salts. No plaintext, no master password hash, no recovery codes. |
| **Authorization** | Data-bound InstantDB permissions: profiles are self-only, personal vaults are owner-only, items are scoped via the linked vault. See `instant.perms.ts`. |
| **Generated passwords** | `crypto.getRandomValues` with rejection sampling on the 32-bit RNG to eliminate modulo bias. |
| **Tests** | 30 unit tests covering AES, key wrap/unwrap, wallet KDF (v1 + v2), and the password generator. CI gates merges on `npm run check` + `npm test` + production-deps audit. |
| **No Tracking** | No analytics, no telemetry, no third-party scripts. CSP restricts `connect-src` to `'self' https://*.instantdb.com wss://*.instantdb.com`. |
| **Threat model** | Published in `docs/THREAT_MODEL.md`. Read it before you trust this with anything important. |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [pnpm](https://pnpm.io) or npm
- An [InstantDB](https://instantdb.com) account (free tier works)
- A Solana wallet browser extension (e.g., [Phantom](https://phantom.app))

### Setup

```bash
# Clone the repo
git clone https://github.com/AyoCodess/NKVault.git
cd NKVault

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env and add your InstantDB App ID and Admin Token

# Push the database schema
npx instant-cli push-schema

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PUBLIC_INSTANT_APP_ID` | Your InstantDB public app ID | Yes |
| `INSTANT_ADMIN_TOKEN` | InstantDB admin token (for schema push only) | For setup |

> **Note:** The `PUBLIC_INSTANT_APP_ID` is a client-side identifier and is safe to include in code. The `INSTANT_ADMIN_TOKEN` is sensitive and must **never** be committed.

## Browser Extension

The browser extension brings NKVault to every website. Works on **Chrome** and **Opera**.

### Build & Install

```bash
cd browser-extension
npm install
npm run build
```

**Chrome:** `chrome://extensions` → Developer mode → Load unpacked → select `browser-extension/dist/`

**Opera:** `opera://extensions` → Developer mode → Load unpacked → select `browser-extension/dist/`

### How Auth Sync Works

The extension is an **independent NKVault client** that talks to InstantDB on its own. It does not receive any secrets from the web app.

1. Sign in to NKVault in the extension popup (the same magic-code email flow as the web app).
2. The extension's service worker connects to InstantDB via its own session and derives its own vault key from your wallet signature — same HKDF v2 derivation as the web app.
3. The web app, when it locks, sends an origin-scoped `NKVAULT_VAULT_LOCKED` message to the extension as a courtesy so the extension can mirror the lock. **No keys, no auth tokens, no session blobs are transmitted between contexts.**
4. Autofill works on any website on user click.

This is a deliberate change from earlier builds, which used `window.postMessage(..., '*')` to broadcast the vault key to the content script. That allowed any iframe on the page to capture the key. See `docs/THREAT_MODEL.md` §5.4 for the current key-distribution model.

### Extension Features

| Feature | Description |
|---------|-------------|
| **Autofill badge** | Lime green lock icon appears in password fields |
| **Credential dropdown** | Click the badge → see matching logins with favicons |
| **Click-to-fill** | Filling always requires an explicit user click. The extension never auto-pastes secrets into a page on its own. |
| **Autosave** | Detects form submissions → offers to save or update credentials |
| **Password generator** | Generate strong passwords from the popup |
| **Auto-lock** | Vault key cleared after 15 minutes of inactivity |
| **Never save** | Per-domain opt-out persisted in browser storage |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | [SvelteKit](https://svelte.dev) (Svelte 5 runes) |
| **Database** | [InstantDB](https://instantdb.com) (real-time sync) |
| **Encryption** | Web Crypto API (AES-256-GCM) |
| **Auth** | [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter) + InstantDB Magic Codes |
| **Extension** | Manifest V3, Svelte 5, Vite |
| **Styling** | Vanilla CSS with custom design system |

## Project Structure

```
NKVault/
├── src/
│   ├── routes/                 # SvelteKit pages
│   ├── lib/
│   │   ├── components/         # UI components
│   │   ├── crypto/             # AES, keys, wallet, session, clipboard
│   │   ├── stores/             # Svelte 5 reactive stores
│   │   └── types.ts            # TypeScript types
│   └── app.css                 # Design system
├── browser-extension/
│   ├── src/
│   │   ├── popup/              # Svelte 5 popup app
│   │   ├── background/         # Service worker (crypto, DB, auth)
│   │   ├── content/            # Autofill, autosave, auth sync
│   │   └── shared/             # Shared types, crypto, messages
│   ├── manifest.json           # MV3 manifest
│   └── vite.config.ts          # Multi-entry Vite build
├── instant.schema.ts           # InstantDB schema
├── .env.example                # Environment template
└── LICENSE                     # MIT
```

## Contributing

Contributions are welcome! Please:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Reporting a security issue

**Please do not open a public GitHub issue for security vulnerabilities.** Email the maintainers with a description and reproduction steps. We will acknowledge within 72 hours. See `docs/THREAT_MODEL.md` §8.

### Development Tips

- The web app runs on `http://localhost:5173`
- The extension builds to `browser-extension/dist/` — reload in Chrome after changes
- All crypto operations use the Web Crypto API — no external crypto libraries
- Svelte 5 runes (`$state`, `$derived`, `$effect`) are used throughout
- Run `npm run check` and `npm test` before opening a PR. CI runs both.
- **Read `docs/THREAT_MODEL.md` before touching anything in `src/lib/crypto/`, `instant.perms.ts`, `src/lib/stores/vault.svelte.ts`, or `browser-extension/manifest.json`.** Changes to those paths are security-relevant by definition.

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with 🔐 by the NKVault team
</p>
