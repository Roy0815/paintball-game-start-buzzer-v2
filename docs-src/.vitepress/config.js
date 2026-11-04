import { defineConfig } from 'vitepress';

// The app is deployed to /paintball-game-start-buzzer-v2/ and these docs to
// /paintball-game-start-buzzer-v2/docs/. Both live in the same GitHub Pages
// artifact, so the docs build writes into the app's dist/ tree. Vite empties
// dist/ first, then this build appends, which is why the order in the root
// build script matters.
const REPO = 'paintball-game-start-buzzer-v2';
const BASE = `/${REPO}/docs/`;

export default defineConfig({
  title: 'Paintball Buzzer',
  description:
    'Bluetooth-Medienfernbedienung löst eigene Sounds auf einem Bluetooth-Lautsprecher aus.',
  lang: 'de-DE',
  base: BASE,
  outDir: '../dist/docs',
  lastUpdated: true,
  head: [['link', { rel: 'icon', href: `${BASE}logo.png` }]],
  themeConfig: {
    logo: '/logo.png',
    nav: [
      { text: 'Anleitung', link: '/guide/', activeMatch: '^/guide/' },
      { text: 'Technik', link: '/technical/', activeMatch: '^/technical/' },
      // Absolute on purpose: the app is not part of the VitePress site.
      {
        text: 'Zur App',
        link: `https://roy0815.github.io/${REPO}/`,
        target: '_self',
      },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Anleitung',
          items: [
            { text: 'Installation & Einrichtung', link: '/guide/' },
            { text: 'Fernbedienung & Tasten', link: '/guide/fernbedienung' },
            { text: 'Fehlerbehebung', link: '/guide/troubleshooting' },
          ],
        },
      ],
      '/technical/': [
        {
          text: 'Technik',
          items: [
            { text: 'Architektur', link: '/technical/' },
            { text: 'Entwicklung', link: '/technical/development' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: `https://github.com/Roy0815/${REPO}` },
    ],
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: 'Suchen', buttonAriaLabel: 'Suchen' },
          modal: {
            displayDetails: 'Details anzeigen',
            resetButtonTitle: 'Suche zurücksetzen',
            backButtonTitle: 'Suche schließen',
            noResultsText: 'Keine Ergebnisse für',
            footer: {
              selectText: 'auswählen',
              navigateText: 'wechseln',
              closeText: 'schließen',
            },
          },
        },
      },
    },
    outline: { label: 'Auf dieser Seite' },
    docFooter: { prev: 'Zurück', next: 'Weiter' },
    darkModeSwitchLabel: 'Erscheinungsbild',
    returnToTopLabel: 'Nach oben',
    sidebarMenuLabel: 'Menü',
    lastUpdated: { text: 'Zuletzt aktualisiert' },
  },
});
