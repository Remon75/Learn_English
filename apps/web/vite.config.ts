import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Vite configuration.
 *
 * The PWA plugin generates a service worker that precaches the app shell so
 * the whole product works with no network. The runtime cache stores lesson
 * media (audio and images) on demand, keeping the first-run download small
 * while allowing full offline play after a lesson has been opened once.
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Sparkle English',
        short_name: 'Sparkle',
        description: 'A private, offline-first English learning adventure for young children.',
        theme_color: '#FFB300',
        background_color: '#FFF8E1',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['education', 'kids'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Only the app shell is precached. The animation engine is heavy
        // and is loaded on demand; lesson media is cached per lesson as it
        // is played. This keeps the first download small enough for a
        // child on a slow connection.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/pixi-*.js', '**/pixi-*.js.map', '**/media/**'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Lesson media: cache-first so a played lesson is instantly
            // replayable offline.
            urlPattern: ({ url }) => url.pathname.startsWith('/media/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'sparkle-media-v1',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // API reads: network-first with an offline fallback, so the
            // child can still open the map when the server is unreachable.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            method: 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sparkle-api-v1',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/media': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ['pixi.js'],
          animation: ['lottie-web', '@rive-app/canvas'],
        },
      },
    },
  },
});
