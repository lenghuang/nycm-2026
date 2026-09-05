import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'NYC Marathon Race Day',
        short_name: 'Race Day',
        description: 'A simple, offline companion for executing your NYC Marathon plan.',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#07151c',
        theme_color: '#08161e',
        orientation: 'portrait',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,png,json,mp3}'],
        // The bundled race mix is intentionally available after the first online load.
        maximumFileSizeToCacheInBytes: 100 * 1024 * 1024,
      },
    }),
  ],
});
