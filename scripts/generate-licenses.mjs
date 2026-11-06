// Collects the licenses of everything that ends up in the shipped app into
// public/third-party-licenses.txt. Runs as part of `npm run build`, so a new or
// updated dependency cannot be deployed without its notice.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = ROOT + 'public/third-party-licenses.txt';

// Runtime dependencies are bundled into the app. workbox-window comes in
// through `virtual:pwa-register` of vite-plugin-pwa, a dev dependency.
const { dependencies } = JSON.parse(
  readFileSync(ROOT + 'package.json', 'utf8'),
);
const PACKAGES = [...Object.keys(dependencies), 'workbox-window'].sort();

function licenseText(dir) {
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)/i.test(f));
  if (!file) throw new Error(`No license file in ${dir}`);
  return readFileSync(`${dir}/${file}`, 'utf8').trim();
}

const RULE = '='.repeat(78);
const sections = PACKAGES.map((name) => {
  const dir = `${ROOT}node_modules/${name}`;
  const pkg = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8'));
  const home = pkg.homepage ?? pkg.repository?.url ?? pkg.repository ?? '';
  return [
    RULE,
    `${name} ${pkg.version} (${pkg.license})`,
    home,
    RULE,
    '',
    licenseText(dir),
    '',
  ].join('\n');
});

writeFileSync(
  OUT,
  [
    'Paintball Buzzer – Lizenzen von Drittanbietern / third-party licenses',
    '',
    'Diese App enthält die folgenden Pakete. This app bundles the packages below.',
    '',
    ...sections,
  ].join('\n'),
);
console.log(`Licenses of ${PACKAGES.join(', ')} written to ${OUT}`);
