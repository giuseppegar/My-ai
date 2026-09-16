import { expect, test } from '@playwright/test';
import sharp from 'sharp';

test('schermata Home: manifest e icone PNG disponibili anche senza accesso', async ({ page, request }) => {
  await page.goto('/');
  const apple = page.locator('link[rel="apple-touch-icon"]');
  await expect(apple).toHaveAttribute('sizes', '180x180');
  const icon = await request.get((await apple.getAttribute('href'))!);
  expect(icon.status()).toBe(200);
  expect(icon.headers()['content-type']).toContain('image/png');
  expect(await sharp(await icon.body()).metadata()).toMatchObject({ format: 'png', width: 180, height: 180, hasAlpha: false });
  const link = page.locator('link[rel="manifest"]');
  await expect(link).toHaveAttribute('href', '/manifest.webmanifest');
  const manifestResponse = await request.get((await link.getAttribute('href'))!);
  expect(manifestResponse.status()).toBe(200);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({ short_name: 'My ai', display: 'standalone', start_url: '/', scope: '/' });
  for (const entry of manifest.icons) {
    const response = await request.get(entry.src);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
    const metadata = await sharp(await response.body()).metadata();
    expect(`${metadata.width}x${metadata.height}`).toBe(entry.sizes);
  }
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'My ai');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f8f6ef');
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).toContain('viewport-fit=cover');
  expect(viewport).not.toMatch(/user-scalable=no|maximum-scale=1/);
});
