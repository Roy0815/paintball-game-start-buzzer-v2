// Prints a scannable QR code of the dev server URL after Vite has printed its
// own URLs, so the app can be opened on a phone without typing the address.
//
// In a Codespace the dev server is only reachable from outside through the
// forwarded https://<codespace>-<port>.app.github.dev URL, so that one is
// encoded. Locally the first network (LAN) URL is used instead.
import qrcode from 'qrcode-terminal';

function codespaceUrl(port, base) {
  const name = process.env.CODESPACE_NAME;
  const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  if (!name || !domain) return null;
  return `https://${name}-${port}.${domain}${base}`;
}

export default function qrCodePlugin() {
  return {
    name: 'dev-url-qr-code',
    apply: 'serve',
    configureServer(server) {
      const printUrls = server.printUrls.bind(server);
      server.printUrls = () => {
        printUrls();

        // The actual port can differ from the configured one when it is taken.
        const port =
          server.httpServer?.address()?.port ?? server.config.server.port;
        const url =
          codespaceUrl(port, server.config.base) ??
          server.resolvedUrls?.network[0];
        if (!url) return;

        console.log(`\n  Auf dem Handy öffnen: ${url}\n`);
        qrcode.generate(url, { small: true });
      };
    },
  };
}
