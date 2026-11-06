// Renders the app icons into public/icons/ (and the docs logo) from the buzzer
// artwork of v1 in assets/buzzer-icon.png.
// Run with `npm run icons` after changing the artwork or the sizes below.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SOURCE = fileURLToPath(
  new URL('../assets/buzzer-icon.png', import.meta.url),
);
const OUT = fileURLToPath(new URL('../public/icons/', import.meta.url));
const DOCS_OUT = fileURLToPath(new URL('../docs-src/public/', import.meta.url));

// Same as theme_color / background_color in the manifest.
const BG = '#161826';
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// fill: share of the icon edge the artwork may take up at most.
// Maskable icons get cropped to a circle with a 40% radius, so the artwork has
// to stay well inside it. iOS fills transparency with black and rounds the
// corners itself, hence an opaque background there as well.
const ICONS = [
  { file: OUT + 'favicon.png', size: 64, fill: 0.96 },
  { file: OUT + 'icon-192.png', size: 192, fill: 0.88 },
  { file: OUT + 'icon-512.png', size: 512, fill: 0.88 },
  {
    file: OUT + 'icon-maskable-512.png',
    size: 512,
    fill: 0.62,
    background: BG,
  },
  { file: OUT + 'apple-touch-icon.png', size: 180, fill: 0.78, background: BG },
  { file: DOCS_OUT + 'logo.png', size: 512, fill: 0.92 },
];

// Cut away the transparent margin once so every icon centres the artwork
// itself, not the padding baked into the source.
const artwork = await sharp(SOURCE).trim().png().toBuffer();

async function render({ file, size, fill, background }) {
  const inner = Math.round(size * fill);
  const scaled = await sharp(artwork)
    .resize(inner, inner, { fit: 'contain', background: TRANSPARENT })
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? TRANSPARENT,
    },
  })
    .composite([{ input: scaled, gravity: 'center' }])
    .png({ compressionLevel: 9, palette: true, quality: 100, effort: 10 })
    .toFile(file);
}

mkdirSync(OUT, { recursive: true });
mkdirSync(DOCS_OUT, { recursive: true });
await Promise.all(ICONS.map(render));
console.log('Icons written to', OUT, 'and', DOCS_OUT);
