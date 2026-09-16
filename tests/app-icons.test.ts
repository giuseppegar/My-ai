import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import manifest from '../src/app/manifest';

describe('icone schermata Home', () => {
  it('identità standalone stabile, con PNG piccoli, grandi e maskable', () => {
    const app = manifest();
    expect(app).toMatchObject({ id: '/', short_name: 'My ai', start_url: '/', scope: '/', display: 'standalone', lang: 'it' });
    expect(app.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192', type: 'image/png' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
    ]));
  });
  for (const [size, path] of [[180, 'src/app/apple-icon.png'], [192, 'public/icons/icon-192.png'], [512, 'public/icons/icon-512.png']] as const) {
    it(`${size}px reali, PNG opaco con il logo dentro la zona sicura del launcher`, async () => {
      const bytes = await readFile(path);
      const meta = await sharp(bytes).metadata();
      expect(meta).toMatchObject({ format: 'png', width: size, height: size, hasAlpha: false });
      const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
      const background = [0x5c, 0x75, 0x64];
      let logoPixels = 0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const pixel = [...data.subarray((y * size + x) * info.channels, (y * size + x) * info.channels + 3)];
        const isBackground = pixel.every((value, i) => value === background[i]);
        if (!isBackground) {
          logoPixels++;
          expect(Math.hypot(x - size / 2, y - size / 2)).toBeLessThan(size * 0.4);
        }
      }
      expect(logoPixels).toBeGreaterThan(size * size * 0.05);
    });
  }
});
