import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Must match the GitHub Pages base path. If it drifts, assets, the manifest
// and the service worker scope all break on the deployed site.
const REPO_NAME = 'paintball-game-start-buzzer-v2';

export default defineConfig({
  base: `/${REPO_NAME}/`,
  server: {
    // Listen on all interfaces so the Codespaces port forwarding (and a phone
    // on the same network when developing locally) can reach the dev server.
    host: true,
    // Codespaces forwards ports through *.app.github.dev. Vite rejects unknown
    // Host headers by default, so that domain has to be allowed explicitly.
    allowedHosts: ['.app.github.dev'],
  },
  preview: {
    host: true,
    allowedHosts: ['.app.github.dev'],
  },
  plugins: [
    VitePWA({
      // 'prompt' instead of 'autoUpdate': an automatic reload would silently
      // drop the armed media session in the middle of a game. The app shows a
      // banner and the user reloads when it suits them.
      registerType: 'prompt',
      manifest: {
        name: 'Paintball Buzzer',
        short_name: 'Buzzer',
        description:
          'Bluetooth-Medienfernbedienung löst eigene Sounds auf einem Bluetooth-Lautsprecher aus.',
        lang: 'de',
        theme_color: '#161826',
        background_color: '#161826',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Fonts only as woff2: every browser with service workers picks that
        // format first, so the woff/ttf/svg fallbacks would be dead weight.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: [
          // The docs are built into dist/docs and share this origin, but they
          // are not part of the app and must not end up in the offline install.
          'docs/**',
          // Phosphor's legacy SVG font (3 MB), see the woff2 note above.
          'assets/Phosphor-*.svg',
        ],
        // Otherwise the SW answers navigations to /docs/ with the app shell.
        navigateFallbackDenylist: [/\/docs(\/|$)/],
      },
    }),
  ],
});
