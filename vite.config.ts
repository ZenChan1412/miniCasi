import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  envPrefix: ['VITE_', 'GOOGLE_'],
  server: {
    // ส่งต่อ /api ไปที่ Worker (wrangler dev) เพื่อให้โหมดพัฒนาใช้ Cloudflare D1 ได้จริง
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: true,
  },
});
