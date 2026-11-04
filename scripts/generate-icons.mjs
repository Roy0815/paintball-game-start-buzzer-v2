// Renders the app icons into public/icons/ without any image library: a few
// concentric discs, supersampled for anti-aliasing and written as plain PNG.
// Run with `npm run icons` after changing the colours or proportions below.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/icons/', import.meta.url));

const BG = [0x0f, 0x17, 0x2a];
// Discs from outside in, radius relative to the icon size. All of them stay
// inside the 40% radius safe zone of maskable icons.
const DISCS = [
  { r: 0.36, color: [0xf9, 0x73, 0x16] },
  { r: 0.28, color: BG },
  { r: 0.22, color: [0xf9, 0x73, 0x16] },
  { r: 0.08, color: [0xff, 0xed, 0xd5] },
];
const SAMPLES = 4;

function colorAt(x, y) {
  const d = Math.hypot(x - 0.5, y - 0.5);
  let color = BG;
  for (const disc of DISCS) if (d <= disc.r) color = disc.color;
  return color;
}

function render(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let o = 0;
  for (let py = 0; py < size; py++) {
    raw[o++] = 0; // PNG filter type: none
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const c = colorAt(
            (px + (sx + 0.5) / SAMPLES) / size,
            (py + (sy + 0.5) / SAMPLES) / size,
          );
          acc[0] += c[0];
          acc[1] += c[1];
          acc[2] += c[2];
        }
      }
      for (const v of acc) raw[o++] = Math.round(v / (SAMPLES * SAMPLES));
    }
  }
  return encodePng(size, raw);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function hex(c) {
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

function svg() {
  const circles = DISCS.map(
    (d) => `<circle cx="50" cy="50" r="${d.r * 100}" fill="${hex(d.color)}"/>`,
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="${hex(BG)}"/>${circles}</svg>\n`;
}

mkdirSync(OUT, { recursive: true });
// The maskable icon is the same picture: the background already bleeds to the
// edges and every disc sits inside the safe zone.
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(OUT + name, render(size));
}
writeFileSync(OUT + 'favicon.svg', svg());
console.log('Icons written to', OUT);
