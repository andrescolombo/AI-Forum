import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'node:path';
import manifest from './src/manifest';

export default defineConfig({
  plugins: [crx({ manifest })],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5174
    }
  },
  build: {
    target: 'esnext',
    minify: false,
    sourcemap: true,
    // Don't wipe dist/ before each build — Chrome locks _metadata/generated_indexed_rulesets/
    // while the extension is loaded, causing EPERM on Windows. Vite overwrites its own
    // output files cleanly without needing to delete the whole folder.
    emptyOutDir: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/ui/main.html')
      }
    }
  }
});
