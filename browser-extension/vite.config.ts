import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import { cpSync, mkdirSync, existsSync, rmSync, readFileSync, writeFileSync } from 'fs';

// Custom plugin to copy static files and fix HTML output path
function extensionPlugin() {
  return {
    name: 'extension-plugin',
    writeBundle() {
      const dist = resolve(__dirname, 'dist');

      // Copy manifest.json
      cpSync(resolve(__dirname, 'manifest.json'), resolve(dist, 'manifest.json'));

      // Copy icons
      const iconsSrc = resolve(__dirname, 'icons');
      const iconsDist = resolve(dist, 'icons');
      if (existsSync(iconsSrc)) {
        mkdirSync(iconsDist, { recursive: true });
        cpSync(iconsSrc, iconsDist, { recursive: true });
      }

      // Fix HTML output path: Vite puts it at dist/src/popup/index.html
      // but the manifest expects it at dist/popup/index.html
      const wrongPath = resolve(dist, 'src', 'popup', 'index.html');
      const correctPath = resolve(dist, 'popup', 'index.html');
      if (existsSync(wrongPath)) {
        mkdirSync(resolve(dist, 'popup'), { recursive: true });
        // Read, fix paths, and write
        let html = readFileSync(wrongPath, 'utf-8');
        // Fix relative paths: ../../popup/ → ./  (since we're now in popup/)
        html = html.replace(/\.\.\/\.\.\/popup\//g, './');
        // Also fix any other ../.. references
        html = html.replace(/\.\.\/\.\.\//g, '../');
        writeFileSync(correctPath, html);
        // Clean up
        rmSync(resolve(dist, 'src'), { recursive: true, force: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [
    svelte(),
    extensionPlugin(),
  ],
  resolve: {
    alias: {
      '$ext': resolve(__dirname, 'src'),
    },
  },
  // Use relative paths — required for Chrome extension pages
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        content: resolve(__dirname, 'src/content/content.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') return 'background/service-worker.js';
          if (chunkInfo.name === 'content') return 'content/content.js';
          return 'popup/[name].js';
        },
        chunkFileNames: 'shared/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return 'popup/[name][extname]';
          return 'assets/[name][extname]';
        },
      },
    },
    target: 'esnext',
    minify: false, // Easier debugging during development
  },
});
