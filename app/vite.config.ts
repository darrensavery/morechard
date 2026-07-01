import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { execSync } from 'child_process'

const gitSha = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim() }
  catch { return 'dev' }
})()

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Write SW into dist/ directly (same outDir as the rest of the build)
      outDir: path.resolve(__dirname, '../dist'),
      // Precache all assets emitted by Vite — hashed filenames are safe to cache forever
      workbox: {
        globDirectory: path.resolve(__dirname, '../dist'),
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2,otf}'],
        // The main HTML entry is a SPA shell — serve it for all navigation misses
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/auth(?!\/verify)/],
        // Immutable hashed assets — cache-first, no expiry
        runtimeCaching: [
          {
            urlPattern: /\/assets\/.+\.[a-f0-9]{8}\.(js|css)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'immutable-assets', expiration: { maxAgeSeconds: 365 * 24 * 60 * 60 } },
          },
          {
            urlPattern: /\/fonts\/.+\.(otf|woff2?)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxAgeSeconds: 365 * 24 * 60 * 60 } },
          },
          // Google Fonts CSS (stylesheet) — stale-while-revalidate
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          // Google Fonts files — cache forever
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-webfonts', expiration: { maxAgeSeconds: 365 * 24 * 60 * 60 } },
          },
          // DiceBear avatar CDN — cache forever (content changes only when seed/style changes)
          {
            urlPattern: /^https:\/\/api\.dicebear\.com/,
            handler: 'CacheFirst',
            options: { cacheName: 'dicebear-avatars', expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 } },
          },
        ],
      },
      // Reuse the existing manifest.webmanifest — don't generate a new one
      manifest: false,
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(gitSha),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: '/',
  build: {
    // Output to repo root /dist so Cloudflare Pages finds it
    outDir: path.resolve(__dirname, '../dist'),
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core — tiny chunk, loaded immediately
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react'
          }
          // Router
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router'
          }
          // Sentry — deferred via requestIdleCallback, so it can be a separate chunk
          if (id.includes('node_modules/@sentry/')) {
            return 'vendor-sentry'
          }
          // Capacitor
          if (id.includes('node_modules/@capacitor/')) {
            return 'vendor-capacitor'
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // /auth/verify and /auth/callback are React SPA routes — must NOT be proxied to the worker
      '/auth': {
        target: 'http://localhost:8787',
        bypass: (req) => {
          const url = req.url ?? ''
          if (url.startsWith('/auth/verify') || url.startsWith('/auth/callback')) return url
          return undefined
        },
      },
      '/api': 'http://localhost:8787',
    },
  },
})
