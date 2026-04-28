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
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/ui/main.html')
      }
    }
  }
});
