import { expect, test } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`Market native mode controls reject wrong answers and accept valid work at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addLocatorHandler(page.getByRole('button', { name: 'Продолжить', exact: true }), async button => {
      // Several earned achievements reuse this button between queue entries.
      for (let index = 0; index < 30 && await button.isVisible(); index += 1) {
        try { await button.click({ timeout: 2_000 }); }
        catch (error) { if (!(await button.isVisible())) break; throw error; }
      }
    }, { noWaitAfter: true });
    async function check(passed: boolean) {
      await page.getByRole('button', { name: 'Проверить', exact: true }).click();
      await expect(page.locator(passed ? '.feedback.success.solved' : '.feedback.error')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    }
    await page.goto('/practice/market-sql-001');
    await expect(page.locator('.monaco-editor textarea')).toBeVisible();
    async function sql(code: string) {
      await page.locator('.monaco-editor textarea').click({ force: true });
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.insertText(code);
    }
    await sql('SELECT order_id, city, revenue FROM orders WHERE revenue < 0');
    await check(false);
    await sql("SELECT order_id, city, revenue FROM orders WHERE status = 'Оплачен' AND revenue > 10000 ORDER BY order_id");
    await check(true);
    await page.goto('/practice/market-excel-003');
    const formula = page.locator('.mode-controls input[type=text]');
    await formula.fill('=[@quantity]*[@price]');
    await check(false);
    await formula.fill('=[@quantity]*[@price]-[@discount]');
    await check(true);
    await page.goto('/practice/market-power-bi-003');
    await page.locator('.mode-controls').getByLabel('city', { exact: true }).check();
    await page.locator('.mode-controls select').selectOption('bar');
    const measure = page.locator('.mode-controls input[type=text]');
    await measure.fill('AVERAGE(orders[revenue])');
    await check(false);
    await measure.fill('SUM(orders[revenue])');
    await check(true);
  });
}
