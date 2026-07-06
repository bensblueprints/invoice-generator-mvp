import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'client',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5304,
    proxy: {
      '/api': 'http://localhost:5303',
      '^/inv/.*/pdf$': 'http://localhost:5303',
    },
  },
});
