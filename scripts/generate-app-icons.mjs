// Run with node scripts/generate-app-icons.mjs after changing src/app/icon.svg.
// Home-screen launchers apply their own mask: use a full opaque square, not
// transparent/rounded corners. The existing compass fits the inner 80% safe zone.
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const svg = (await readFile(new URL('src/app/icon.svg', root), 'utf8')).replace(' rx="18"', '');
await mkdir(new URL('public/icons/', root), { recursive: true });
for (const [size, path] of [[180, 'src/app/apple-icon.png'], [192, 'public/icons/icon-192.png'], [512, 'public/icons/icon-512.png']]) {
  await sharp(Buffer.from(svg), { density: 576 }).resize(size, size).removeAlpha().png().toFile(fileURLToPath(new URL(path, root)));
}
