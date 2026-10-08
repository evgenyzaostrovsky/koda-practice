import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const native = JSON.parse(readFileSync('content/market_native_v2.json', 'utf8'));
const authored = JSON.parse(readFileSync('content/market_authored_v2.json', 'utf8'));
const revision = JSON.parse(readFileSync('content/market_revision.json', 'utf8'));
const ids = new Map<number, string>(authored.tasks.map((row: { source_number: number; task_id: string }) => [row.source_number, row.task_id]));

for (const width of [1280, 390]) {
  test(`Excel shows aligned checks and highlights only cancelled rows at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const tasks = Object.fromEntries([95, 96].map(number => {
      const taskId = ids.get(number)!;
      return [taskId, { taskId, code: JSON.stringify(native[number].solution_spec), status: 'draft', attempts: 0, lastRunResult: null, completedAt: null, updatedAt: '2026-10-08', contentRevision: revision.revision }];
    }));
    await page.addInitScript(({ states, version }) => {
      if (!localStorage.getItem('qa:formatting-seeded')) {
        localStorage.setItem('koda:task-state:v1', JSON.stringify({ version: 1, tasks: states }));
        localStorage.setItem(`koda:content-revision:${version}:anonymous`, 'applied');
        localStorage.setItem('qa:formatting-seeded', 'yes');
      }
    }, { states: tasks, version: revision.revision });
    await page.goto(`/practice/${ids.get(95)}`);
    await page.getByRole('button', { name: /Запустить/ }).click();
    const checks = page.getByRole('table', { name: 'Расчёт и проверка выручки по заказам' });
    await expect(checks).toBeVisible();
    await expect(checks.locator('tbody tr')).toHaveCount(30);
    await expect(checks.locator('tbody tr').first()).toContainText('1001');
    await expect(checks.locator('tbody tr').first()).toContainText('ОК');
    expect(await checks.locator('tbody tr').first().locator('td').count()).toBe(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);

    await page.goto(`/practice/${ids.get(96)}`);
    await page.getByRole('button', { name: /Запустить/ }).click();
    const formatted = page.getByRole('table', { name: 'Заказы с условным форматированием' });
    await expect(formatted).toBeVisible();
    await expect(formatted.locator('tbody tr')).toHaveCount(30);
    const highlighted = formatted.locator('tbody tr.mode-highlighted-row');
    await expect(highlighted).toHaveCount(2);
    await page.mouse.move(0, 0);
    expect(await highlighted.locator('td:first-child').allTextContents()).toEqual(['1011', '1025']);
    expect(await highlighted.evaluateAll(rows => rows.every(row => [...row.querySelectorAll('td')].every(cell => getComputedStyle(cell).backgroundColor === 'rgba(240, 128, 128, 0.22)')))).toBe(true);
    expect(await formatted.locator('tbody tr:not(.mode-highlighted-row)').evaluateAll(rows => rows.every(row => !row.hasAttribute('data-format-style')))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    const bounds = await page.evaluate(() => [...document.querySelectorAll('main, .mode-controls, .mode-report, .table-wrap')].map(element => ({ className: element.className, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width })));
    for (const box of bounds) {
      expect(box.left, `${box.className} left boundary`).toBeGreaterThanOrEqual(-1);
      expect(box.right, `${box.className} right boundary`).toBeLessThanOrEqual(width + 1);
    }
    if (width === 390) {
      const scrollRegion = page.locator('.mode-report .table-wrap');
      await expect(scrollRegion).toHaveAttribute('tabindex', '0');
      await scrollRegion.focus();
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => scrollRegion.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
      await scrollRegion.evaluate(element => { element.scrollLeft = element.scrollWidth; });
      const lastCellRight = await formatted.locator('tbody tr').first().locator('td').last().evaluate(element => element.getBoundingClientRect().right);
      expect(lastCellRight).toBeLessThanOrEqual(width + 1);
      await scrollRegion.evaluate(element => { element.scrollLeft = 0; });
    }
    await page.screenshot({ path: `reports/qa-authored-v2-formatting-${width}.png`, fullPage: true });
  });
}
