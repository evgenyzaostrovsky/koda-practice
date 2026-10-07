import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`Air production routes remain readable and navigable at ${width}px`, async ({ page, request }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addLocatorHandler(page.getByRole('button', { name: 'Получить', exact: true }), async button => { await button.click(); });
    const knowledge = await (await request.get('/api/knowledge')).json();
    const routes = ['/', '/catalog', '/topics/start', '/practice/start-001', '/knowledge', `/knowledge/${knowledge[0].slug}`, '/progress', '/errors', '/achievements', '/profile', '/sandbox'];
    for (const route of routes) {
      await test.step(route, async () => {
        await page.goto(route);
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'airy');
        await expect(page.locator('.app main h1').first()).toBeVisible();
        if (route === '/practice/start-001') await expect(page.locator('.monaco-editor textarea')).toBeVisible();
        if (route === '/achievements') await expect(page.locator('button.family-preview').first()).toBeVisible();
        const appearance = await page.locator('.app main h1').first().evaluate(heading => {
          const body = getComputedStyle(document.body), title = getComputedStyle(heading);
          const channel = (v: number) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
          const luminance = (color: string) => (color.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map(channel).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
          const a = luminance(body.backgroundColor), b = luminance(title.color);
          return { pageWidth: document.documentElement.scrollWidth, viewport: innerWidth, backgroundLuminance: a, titleContrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
        });
        expect(appearance.pageWidth, `${route} overflow`).toBeLessThanOrEqual(appearance.viewport + 1);
        expect(appearance.backgroundLuminance, `${route} light surface`).toBeGreaterThan(.85);
        expect(appearance.titleContrast, `${route} title contrast`).toBeGreaterThanOrEqual(4.5);
        if (route === '/practice/start-001') await page.screenshot({ path: testInfo.outputPath(`air-practice-${width}.png`), fullPage: true });
      });
    }
    if (width === 390) {
      await page.goto('/');
      await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
      await expect(page.locator('.app > aside')).toHaveClass(/open/);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Открыть меню', exact: true })).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByRole('button', { name: 'Открыть меню', exact: true })).toBeFocused();
      await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
      await page.locator('aside nav').getByRole('link', { name: 'База знаний', exact: true }).click();
      await expect(page).toHaveURL(/\/knowledge$/);
      await expect(page.locator('.app > aside')).not.toHaveClass(/open/);
    } else {
      await page.locator('aside nav').getByRole('link', { name: 'База знаний', exact: true }).click();
      await expect(page).toHaveURL(/\/knowledge$/);
    }
    expect(errors).toEqual([]);
  });
}

test('Air sandbox displays a real Pyodide scalar expression', async ({ page }) => {
  await page.addLocatorHandler(page.getByRole('button', { name: 'Получить', exact: true }), async button => { await button.click(); });
  await page.goto('/sandbox');
  await expect(page.locator('.sandbox-runtime.ready')).toContainText('Python готов', { timeout: 120_000 });
  await page.locator('.monaco-editor textarea').click({ force: true });
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText('1 + 1');
  await page.getByRole('button', { name: /^Запустить$/ }).click();
  await expect(page.locator('.sandbox-value')).toHaveText('2', { timeout: 120_000 });
});
