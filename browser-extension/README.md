# NKVault Browser Extension

MV3 browser extension for NKVault password manager — works on **Chrome** and **Opera**.

## Features

- 🔐 **Zero-knowledge encryption** — all decryption happens client-side
- 🔍 **Smart autofill** — detects login forms and suggests matching credentials
- 🎯 **URL matching** — auto-suggests credentials for the current website
- 🎲 **Password generator** — generate strong passwords right in the extension
- 🔒 **Auto-lock** — vault auto-locks after 15 minutes of inactivity
- 🎨 **Dark premium UI** — matches the NKVault web app design (Space Grotesk + lime green)

## Tech Stack

- **Svelte 5** — popup UI with reactive components
- **TypeScript** — type-safe codebase
- **Vite** — fast builds with multi-entry bundling
- **InstantDB** — real-time vault data sync
- **Web Crypto API** — AES-256-GCM encryption/decryption

## Structure

```
browser-extension/
├── manifest.json           # MV3 manifest
├── package.json            # Dependencies
├── vite.config.ts          # Multi-entry Vite build
├── svelte.config.js        # Svelte preprocess config
├── icons/                  # Extension icons (16/48/128)
├── src/
│   ├── popup/              # Svelte 5 popup app
│   │   ├── index.html      # Entry HTML
│   │   ├── main.ts         # Svelte mount
│   │   ├── App.svelte      # Root component
│   │   ├── popup.css       # Design tokens
│   │   └── components/
│   │       ├── Header.svelte
│   │       ├── SearchBar.svelte
│   │       ├── VaultList.svelte
│   │       ├── ItemDetail.svelte
│   │       ├── PasswordGenerator.svelte
│   │       ├── LockedScreen.svelte
│   │       ├── Footer.svelte
│   │       └── Icon.svelte
│   ├── background/
│   │   └── service-worker.ts   # Auth, crypto, DB, URL matching
│   ├── content/
│   │   └── content.ts          # Login detection, autofill, auth sync
│   └── shared/
│       ├── crypto.ts           # AES-GCM + key utilities
│       ├── types.ts            # Types, helpers, password gen
│       └── messages.ts         # Chrome message type definitions
└── dist/                       # Build output → load in Chrome/Opera
```

## Development

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Watch mode (rebuild on changes)
npm run dev
```

## Loading in Chrome

1. Run `npm run build`
2. Open `chrome://extensions`
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked"
5. Select the `dist/` folder

## Loading in Opera

1. Run `npm run build`
2. Open `opera://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/` folder

## Auth Sync

The extension syncs authentication with the NKVault web app:

1. **Open the web app** → sign in & unlock your vault
2. **The extension detects auth** via `chrome.storage` and `postMessage`
3. **Vault items appear** in the extension popup
4. **Autofill works** on any website with saved credentials

## Security

- Vault key is held in the service worker's memory — never written to disk
- Auto-clears after 15 minutes of inactivity
- Copied passwords auto-clear from clipboard after 30 seconds
- Content scripts never see encryption keys
- HTTPS-aware autofill
