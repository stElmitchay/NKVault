import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure crypto and utility tests run under Node, which on v20+ ships
    // a native WebCrypto implementation as `globalThis.crypto`. We do
    // NOT need jsdom for these tests; component tests would, but those
    // are scoped to a follow-up.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', '.svelte-kit/**', 'browser-extension/**'],
    // Crypto tests are CPU-bound and small; default reporter is fine.
  },
  resolve: {
    // Mirror the SvelteKit `$lib` alias for tests so import paths match
    // production source.
    alias: {
      $lib: new URL('./src/lib/', import.meta.url).pathname,
    },
  },
});
