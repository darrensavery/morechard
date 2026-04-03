import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Assets prefixed with /register/ so they don't clash with root index.html
  base: '/register/',
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:8787',
      '/api':  'http://localhost:8787',
    },
  },
})
