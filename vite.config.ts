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
    // Babylon is huge; split it into its own chunk so the app shell loads
    // independently and the warning threshold matches realistic chunk sizes.
    chunkSizeWarningLimit: 6000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@babylonjs/')) return 'babylonjs';
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) {
            return 'react-vendor';
          }
          return undefined;
        },
      },
    },
  },
});