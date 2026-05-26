import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 3921,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3920', changeOrigin: true },
    },
  },
});
