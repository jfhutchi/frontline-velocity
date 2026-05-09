import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages base path.
// Repo URL:
// https://github.com/jfhutchi/frontline-velocity
//
// Deployed URL:
// https://jfhutchi.github.io/frontline-velocity/
export default defineConfig({
  base: '/frontline-velocity/',

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