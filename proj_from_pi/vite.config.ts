import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:9000',
      '/ingest': 'http://localhost:9000',
      '/ws': { target: 'ws://localhost:9000', ws: true },
      '/stream': 'http://localhost:8000',
      '/admin-api': { target: 'http://localhost:8000', rewrite: (p) => p.replace(/^\/admin-api/, '/api') },
    },
  }
});