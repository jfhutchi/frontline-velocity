import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages base path. The repo is hosted at:
// https://jfhutchi.github.io/steel-command-frontline-velocity/
export default defineConfig({
  base: '/steel-command-frontline-velocity/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    chunkSizeWarningLimit: 2048,
  },
});
