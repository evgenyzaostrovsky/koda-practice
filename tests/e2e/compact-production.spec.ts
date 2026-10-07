import { expect, test } from '@playwright/test';

// Observable layout checks supplement the real execution suites; no mocked execution or account.
for (const width of [1440, 1024, 390]) {
  test(`compact production route families at ${width}px`, async ({ page, request }, testInfo) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addLocatorHandler(page.getByRole('button', { name: 'Получить', exact: true }), async button => { await button.click(); });
    const response = await request.get('/api/knowledge');
    expect(response.ok()).toBeTruthy();
    const knowledge = await response.json();
    expect(knowledge.length).toBeGreaterThan(0);
    const articleRoute = `/knowledge/${knowledge[0].slug}`;
    const routes = ['/', '/catalog', '/topics/start', '/practice/start-001', '/knowledge', articleRoute, '/progress', '/errors', '/achievements', '/profile', '/profile/settings', '/profile/history', '/sandbox'];
    for (const route of routes) {
      await test.step(route, async () => {
        await page.goto(route);
        await expect(page.locator('.app main h1').first()).toBeVisible();
        if (route === '/practice/start-001' || route === '/sandbox') await expect(page.locator('.monaco-editor textarea')).toBeVisible();
        if (route.startsWith('/profile')) await expect(page.getByRole('heading', { name: 'Профиль доступен после входа' })).toBeVisible();
        if (route === '/catalog') {
          const cards = page.locator('.module-card');
          await expect(cards.first()).toBeVisible();
          const boxes = await cards.evaluateAll(nodes => nodes.slice(0, 2).map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y }; }));
          expect(boxes).toHaveLength(2);
          if (width > 760) { expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(2); expect(boxes[1].x).toBeGreaterThan(boxes[0].x); }
          else expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
        }
        if (route === articleRoute) {
          await expect(page.locator('.cheat-search')).toBeVisible();
          await checkReadingSurfaces();
          await screenshot('cheatsheet');
          await page.getByRole('button', { name: 'Статья', exact: true }).click();
          await expect(page.locator('.knowledge-reading')).toBeVisible();
          await checkReadingSurfaces();
          const bodySize = await page.locator('.knowledge-reading section p').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize));
          expect(bodySize, 'article body remains readable').toBeGreaterThanOrEqual(15);
          await screenshot('article');
        }
        const geometry = await page.locator('.app main h1').first().evaluate(node => {
          const r = node.getBoundingClientRect();
          return { document: document.documentElement.scrollWidth, viewport: innerWidth, headingSize: parseFloat(getComputedStyle(node).fontSize), headingWidth: r.width };
        });
        expect(geometry.document, `${route} document overflow`).toBeLessThanOrEqual(geometry.viewport + 1);
        expect(geometry.headingSize, `${route} heading size`).toBeGreaterThanOrEqual(20);
        if (width === 1440 && !['/practice/start-001', '/sandbox'].includes(route)) expect(geometry.headingWidth, `${route} bounded composition`).toBeLessThanOrEqual(980);
        await checkReadingSurfaces('.app *:not(.air-nav-backdrop)');
        await screenshot(route === articleRoute ? 'knowledge-detail' : route.replace(/\//g, '-') || 'dashboard');
        if (route === '/achievements' && width === 1440) {
          await page.locator('button.family-preview').first().click();
          const dialog = page.getByRole('dialog');
          await expect(dialog).toBeVisible();
          await checkReadingSurfaces('[role="dialog"] *');
          expect(await dialog.evaluate(node => node.getBoundingClientRect().width)).toBeLessThanOrEqual(1100);
          await screenshot('achievement-dialog');
          await page.getByRole('button', { name: 'Закрыть окно', exact: true }).click();
          await expect(dialog).not.toBeVisible();
        }
      });
    }
    if (width === 390) {
      await page.goto('/');
      const menu = page.getByRole('button', { name: 'Открыть меню', exact: true });
      await menu.click();
      await expect(page.locator('.app > aside')).toHaveClass(/open/);
      await page.keyboard.press('Escape');
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
      await expect(menu).toBeFocused();
      await menu.click();
      await page.locator('aside nav').getByRole('link', { name: 'База знаний', exact: true }).click();
      await expect(page).toHaveURL(/\/knowledge$/);
      await expect(page.locator('.app > aside')).not.toHaveClass(/open/);
    }
    expect(errors).toEqual([]);

    async function screenshot(name: string) { await page.screenshot({ path: testInfo.outputPath(`compact-${name}-${width}.png`), fullPage: true }); }
    async function checkReadingSurfaces(selector = '.knowledge-article-page *') {
      const dark = await page.locator(selector).evaluateAll(nodes => nodes.filter(node => {
        const rgb = (getComputedStyle(node).backgroundColor.match(/[\d.]+/g) || []).map(Number);
        return rgb.length >= 3 && (rgb.length < 4 || rgb[3] > .5) && Math.max(...rgb.slice(0, 3)) < 100 && node.getBoundingClientRect().width > 80 && node.getBoundingClientRect().height > 25;
      }).map(node => ({ tag: node.tagName, className: node.className, text: node.textContent?.slice(0, 80), background: getComputedStyle(node).backgroundColor })));
      expect(dark, `${selector} has no opaque dark blocks`).toEqual([]);
    }
  });
}

test('compact sandbox preserves warnings, syntax errors, repeated output and manual Stop', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await page.addLocatorHandler(page.getByRole('button', { name: 'Получить', exact: true }), async button => { await button.click(); });
  await page.goto('/sandbox');
  await expect(page.locator('.sandbox-runtime.ready')).toContainText('Python готов', { timeout: 120_000 });
  async function edit(code: string) {
    const clear = page.getByRole('button', { name: 'Очистить', exact: true });
    if (await clear.isVisible()) await clear.click();
    await page.locator('.monaco-editor textarea').click({ force: true });
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText(code);
  }
  async function run(code: string) {
    await edit(code);
    await page.getByRole('button', { name: /^Запустить$/ }).click();
    await expect(page.locator('.sandbox-result')).toBeVisible({ timeout: 120_000 });
  }
  await run('import warnings\nprint("first")\nprint("second")\nwarnings.warn("COMPACT_WARNING")\nanswer = 73\nanswer');
  await expect(page.locator('.sandbox-stdout')).toHaveText('first\nsecond');
  await expect(page.locator('.sandbox-stderr')).toContainText('COMPACT_WARNING');
  await expect(page.locator('.sandbox-value')).toHaveText('73');
  await page.screenshot({ path: testInfo.outputPath('compact-sandbox-distinct-outputs.png'), fullPage: true });
  await run('if True print("invalid")');
  await expect(page.locator('.sandbox-traceback')).toContainText('SyntaxError');
  await run('print("recovered")');
  await expect(page.locator('.sandbox-stdout')).toHaveText('recovered');
  await edit('while True:\n    pass');
  await page.getByRole('button', { name: /^Запустить$/ }).click();
  await page.getByRole('button', { name: 'Остановить', exact: true }).click();
  await expect(page.locator('.sandbox-runtime.ready')).toContainText('Python готов', { timeout: 120_000 });
  await run('answer = 19\nanswer');
  await expect(page.locator('.sandbox-value')).toHaveText('19');
});
