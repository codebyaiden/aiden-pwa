import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = repository
  ? repository.endsWith('.github.io') ? '/' : `/${repository}/`
  : process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'aiden.',
        short_name: 'aiden',
        description: 'Agenda, dinero personal, tareas y ahorros sin conexión.',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#0D0E10',
        theme_color: '#0D0E10',
        lang: 'es-CO',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false
      },
      devOptions: { enabled: false }
    })
  ]
});
