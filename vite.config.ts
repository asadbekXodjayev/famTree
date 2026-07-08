import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev, if VITE_API_URL is not set, proxy /api to the local backend so the
// app "just works" without CORS. In prod, set VITE_API_URL=https://treeapi.xodjayev.uz.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
});
