import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

async function ensureHalfSpeedWinterGif() {
  const source = resolve(process.cwd(), 'public/routine/winter.gif');
  const target = resolve(process.cwd(), 'public/routine/winter-half.gif');
  const data = await readFile(source);
  if (data.toString('ascii', 0, 3) !== 'GIF') throw new Error('Routine winter asset is not a GIF.');
  let offset = 13;
  const packed = data[10];
  if (packed & 0x80) offset += 3 * (2 ** ((packed & 7) + 1));
  let frames = 0;
  while (offset < data.length) {
    const marker = data[offset++];
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      const label = data[offset++];
      if (label === 0xf9) {
        const size = data[offset++];
        if (size !== 4) throw new Error('Unexpected winter GIF frame control block.');
        const delayAt = offset + 1;
        const delay = data[delayAt] | (data[delayAt + 1] << 8);
        const doubled = Math.min(65535, delay * 2);
        data[delayAt] = doubled & 255;
        data[delayAt + 1] = doubled >> 8;
        frames++;
        offset += size + 1;
      } else {
        while (true) {
          const size = data[offset++];
          if (size === 0) break;
          offset += size;
        }
      }
    } else if (marker === 0x2c) {
      const descriptor = data[offset + 8];
      offset += 9;
      if (descriptor & 0x80) offset += 3 * (2 ** ((descriptor & 7) + 1));
      offset++;
      while (true) {
        const size = data[offset++];
        if (size === 0) break;
        offset += size;
      }
    } else throw new Error('Unexpected block in routine winter GIF.');
  }
  if (!frames) throw new Error('Routine winter GIF has no animated frames.');
  await writeFile(target, data);
}

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = repository
  ? repository.endsWith('.github.io') ? '/' : `/` + repository + `/`
  : process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    { name: 'routine-half-speed-winter', configureServer: ensureHalfSpeedWinterGif, buildStart: ensureHalfSpeedWinterGif },
    VitePWA({
      registerType: 'prompt', injectRegister: null,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: base, name: 'aiden.', short_name: 'aiden',
        description: 'Agenda, dinero personal, tareas y ahorros sin conexión.',
        start_url: base, scope: base, display: 'standalone',
        background_color: '#0D0E10', theme_color: '#0D0E10', lang: 'es-CO',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        importScripts: ['routine/push.js'],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,gif,webp}'],
        cleanupOutdatedCaches: true, clientsClaim: true, skipWaiting: false
      },
      devOptions: { enabled: false }
    })
  ]
});
