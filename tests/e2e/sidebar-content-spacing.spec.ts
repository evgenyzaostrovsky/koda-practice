import { expect, test } from '@playwright/test';

for (const width of [1440, 1920, 390]) {
  test(`sidebar content spacing and sandbox bounds at ${width}px`, async ({ page, request, browser }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addLocatorHandler(page.getByRole('button', { name: 'Продолжить', exact: true }), async button => {
      for (let count = 0; count < 30 && await button.isVisible(); count++) {
        try { await button.click({ timeout: 5000 }); }
        catch (error) { if (!(await button.isVisible())) break; throw error; }
      }
    }, { noWaitAfter: true });
    const knowledgeResponse = await request.get('/api/knowledge');
    expect(knowledgeResponse.ok()).toBeTruthy();
    const knowledge = await knowledgeResponse.json();
    const routes = ['/', '/catalog', '/topics/start', '/practice/start-001', '/knowledge', `/knowledge/${knowledge[0].slug}`, '/progress', '/errors', '/achievements', '/profile', '/profile/settings', '/profile/history', '/sandbox'];
    const measurements = [];
    for (const route of routes) {
      console.log(`Spacing QA ${width}px ${route}`);
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const heading = page.locator('.app main h1').first();
      await expect(heading).toBeVisible();
      const geometry = await heading.evaluate(node => {
        let wrapper = node;
        while (wrapper.parentElement && wrapper.parentElement.tagName !== 'MAIN') wrapper = wrapper.parentElement;
        const bounds = wrapper.getBoundingClientRect();
        const sidebar = document.querySelector('.app > aside')!.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right, gap: bounds.left - sidebar.right, overflow: document.documentElement.scrollWidth - innerWidth };
      });
      measurements.push({ route, ...geometry });
      expect(geometry.overflow, `${route} document overflow`).toBeLessThanOrEqual(1);
      expect(geometry.left, `${route} content leading edge`).toBeGreaterThanOrEqual(0);
      expect(geometry.right, `${route} content trailing edge`).toBeLessThanOrEqual(width + 1);
      if (width > 760) expect(Math.abs(geometry.gap - 20), `${route} content gutter`).toBeLessThanOrEqual(2);
      else expect(geometry.left, `${route} mobile gutter`).toBeGreaterThanOrEqual(17);
      if (route === '/sandbox') {
        // Use a fresh browser session for draft interactions so route exploration's
        // achievement celebration queue cannot intercept editor or sidebar input.
        const sandboxContext = await browser.newContext({ baseURL: new URL(page.url()).origin, viewport: { width, height: 900 } });
        await sandboxContext.addInitScript(() => localStorage.setItem('koda:sandbox-code:v1', 'print("SPACING_DRAFT")'));
        page = await sandboxContext.newPage();
        await page.goto('/sandbox', { waitUntil: 'domcontentloaded' });
        await expect(page.locator('.monaco-editor textarea')).toBeVisible();
        for (const selector of ['.sandbox-grid', '.sandbox-code', '.monaco-editor', '.sandbox-output']) {
          const element = page.locator(selector);
          if (!(await element.isVisible())) continue;
          const box = await element.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.x, `${selector} left`).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width, `${selector} right`).toBeLessThanOrEqual(width + 1);
          if (width > 760) expect(box!.width, `${selector} expanded width`).toBeGreaterThanOrEqual(1190 - (selector === '.monaco-editor' ? 2 : 0));
        }
        await expect(page.locator('.monaco-editor .view-lines')).toContainText('SPACING_DRAFT');
        await expect.poll(() => page.evaluate(() => localStorage.getItem('koda:sandbox-code:v1'))).toBe('print("SPACING_DRAFT")');
        await page.setViewportSize({ width: width === 390 ? 1440 : 390, height: 900 });
        await page.setViewportSize({ width, height: 900 });
        await expect.poll(() => page.evaluate(() => localStorage.getItem('koda:sandbox-code:v1'))).toBe('print("SPACING_DRAFT")');
        if (width > 760) {
          await page.getByRole('button', { name: 'Свернуть меню', exact: true }).click();
          await expect(page.locator('.app')).toHaveClass(/sidebar-collapsed/);
          await expect.poll(() => page.locator('.sandbox-page').evaluate(node => node.getBoundingClientRect().left - document.querySelector('.app > aside')!.getBoundingClientRect().right)).toBe(20);
          await expect.poll(() => page.evaluate(() => localStorage.getItem('koda:sandbox-code:v1'))).toBe('print("SPACING_DRAFT")');
          await page.getByRole('button', { name: 'Развернуть меню', exact: true }).click();
        } else {
          await expect(page.locator('.sandbox-output')).toBeVisible();
          const output = await page.locator('.sandbox-output').boundingBox();
          expect(output!.x).toBeGreaterThanOrEqual(0);
          expect(output!.x + output!.width).toBeLessThanOrEqual(width + 1);
        }
        await page.screenshot({ path: testInfo.outputPath(`sandbox-${width}.png`), fullPage: true });
        await sandboxContext.close();
      }
      if (route === '/') await page.screenshot({ path: testInfo.outputPath(`dashboard-${width}.png`), fullPage: true });
    }
    await testInfo.attach('measured-route-bounds', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
  });
}
