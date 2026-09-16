import { expect, test, type Page } from '@playwright/test';
import { demoData } from '../../src/lib/demo';

async function fits(page: Page) {
  const layout = await page.evaluate(() => {
    const composer = document.querySelector('.composer')!.getBoundingClientRect();
    const buttons = [...document.querySelectorAll<HTMLElement>('.composer-actions button, .composer-tools button')]
      .filter(b => b.getClientRects().length).map(b => { const r = b.getBoundingClientRect(); return { name: b.textContent || b.getAttribute('aria-label'), x: r.x, right: r.right, y: r.y, bottom: r.bottom, width: r.width, height: r.height }; });
    return { page: document.documentElement.scrollWidth, viewport: innerWidth, left: composer.left, right: composer.right, buttons };
  });
  expect(layout.page, 'nessuno scorrimento orizzontale').toBeLessThanOrEqual(layout.viewport);
  for (const b of layout.buttons) {
    expect(b.x, String(b.name)).toBeGreaterThanOrEqual(layout.left);
    expect(b.right, String(b.name)).toBeLessThanOrEqual(layout.right);
    expect(b.height, String(b.name)).toBeGreaterThanOrEqual(44);
    expect(b.width, String(b.name)).toBeGreaterThanOrEqual(44);
  }
  for (let i = 0; i < layout.buttons.length; i++) for (let j = i + 1; j < layout.buttons.length; j++) {
    const a = layout.buttons[i], b = layout.buttons[j];
    expect(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, `${a.name} non copre ${b.name}`).toBe(true);
  }
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/bootstrap', route => route.fulfill({ json: { capabilities: { ...demoData.capabilities, web: true, images: true } } }));
});

for (const width of [320, 360, 390, 430, 768, 1024, 1280]) {
  test(`composer a ${width}px: comandi accessibili, strumenti e allegati senza overflow`, async ({ page }, info) => {
    const writes: string[] = [];
    page.on('request', r => { if (r.method() === 'POST' && !r.url().endsWith('/search')) writes.push(r.url()); });
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const input = page.locator('#chat-input');
    await expect(input).toBeVisible();
    await page.locator('.composer').scrollIntoViewIfNeeded();
    await expect(page.locator('#composer-tools')).toBeHidden();
    await fits(page);
    if (width <= 780) expect(await input.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    await input.fill('risotto');
    await expect(page.locator('.search-panel')).toBeVisible();
    await input.press('Escape');
    await page.locator('input[type=file]').setInputFiles({ name: `${'documento-lungo-'.repeat(10)}.txt`, mimeType: 'text/plain', buffer: Buffer.from('Solo anteprima, nessun upload.') });
    await expect(page.locator('.attachment')).toBeVisible();
    await fits(page);
    for (const name of ['Cerca nel web', 'Approfondisci', 'Genera video', 'Genera immagine']) {
      await page.locator('.tools-toggle').click();
      await fits(page);
      await page.getByRole('group', { name: 'Strumenti della chat' }).getByRole('button', { name, exact: true }).click();
      await expect(page.locator('.tools-toggle')).toBeFocused();
      await expect(page.locator('#composer-tools')).toBeHidden();
      await expect(page.locator('.composer-tools [aria-pressed=true]')).toHaveCount(1);
      await expect(input).toHaveValue('risotto');
      await fits(page);
    }
    await expect(page.locator('.attachment')).toBeHidden();
    await page.locator('.tools-toggle').click();
    await page.locator('.image-button').click();
    await expect(page.locator('.attachment')).toBeVisible();
    await expect(page.locator('.composer-tools [aria-pressed=true]')).toHaveCount(0);
    await page.getByRole('button', { name: /Rimuovi allegato/ }).click();
    await input.fill('');
    await page.locator('.composer').scrollIntoViewIfNeeded();
    if (width === 390) {
      await page.screenshot({ path: `tests/e2e/artifacts/composer-${info.project.name}.png` });
      await page.locator('.tools-toggle').click();
      await page.locator('.composer').screenshot({ path: `tests/e2e/artifacts/tools-${info.project.name}.png` });
      await page.locator('.tools-toggle').click();
    }
    // Reduced available height (e.g. an open keyboard): send remains reachable above the nav.
    if (width <= 780) {
      await page.setViewportSize({ width, height: 400 });
      await input.fill('Una bozza');
      await input.press('Escape');
      await page.locator('.send-button').scrollIntoViewIfNeeded();
      await page.locator('.send-button').click({ trial: true });
      const send = (await page.locator('.send-button').boundingBox())!;
      const nav = (await page.locator('.mobile-nav').boundingBox())!;
      expect(send.y + send.height).toBeLessThanOrEqual(nav.y);
      await fits(page);
    }
    expect(writes).toEqual([]);
  });
}

test('strumenti da tastiera: apertura, selezione ed Escape restituiscono il focus', async ({ page, browserName }) => {
  await page.goto('/');
  const toggle = page.locator('.tools-toggle');
  await toggle.focus();
  await toggle.press('ArrowDown');
  await expect(page.locator('.artifact-button')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.press('Enter');
  // Safari's default keyboard navigation uses Option+Tab to include buttons.
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(page.locator('.artifact-button')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(toggle).toBeFocused();
  await expect(toggle).toContainText('File di testo');
});

test('invio in corso a 320px: loader stabile e strumenti bloccati, provider simulato', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.route('**/api/bootstrap', route => route.fulfill({ json: { ...demoData, capabilities: { ...demoData.capabilities, configured: true, ai: true }, user: { id: 'ui-test', email: 'ui@example.invalid' } } }));
  await page.route('**/api/search', route => route.fulfill({ json: { results: [], mode: 'lexical' } }));
  await page.route('**/api/conversations', route => route.fulfill({ json: { id: 'ui-conversation', category: 'capire', title: 'Una domanda' } }));
  await page.route('**/api/conversations/ui-conversation', route => route.fulfill({ json: [] }));
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/chat', async route => { await pending; await route.fulfill({ json: { message: { content: 'Risposta simulata' } } }); });
  try {
    await page.goto('/');
    await page.locator('#chat-input').fill('Una domanda');
    await page.locator('#chat-input').press('Escape');
    await page.locator('.send-button').click();
    await expect(page.locator('.send-button')).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('.tools-toggle')).toBeDisabled();
    await expect(page.locator('.attachment-button')).toBeDisabled();
    await fits(page);
  } finally { release(); }
  await expect(page.locator('.send-button')).toHaveAttribute('aria-busy', 'false');
});
