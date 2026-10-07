import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`UI kit gallery accessibility and isolation at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [], traffic: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const request = route.request();
      if (new URL(request.url()).pathname.startsWith('/api/') || !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        traffic.push(`${request.method()} ${request.url()}`);
        return route.abort();
      }
      return route.continue();
    });
    await page.addInitScript(() => {
      const writes: string[] = [];
      Object.assign(window, { __kitStorageWrites: writes });
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) { writes.push(key); return set.call(this, key, value); };
    });
    await page.goto('/design-system');
    await expect(page.getByRole('heading', { name: 'Soft Line', exact: true })).toBeVisible();
    await expect(page.getByText('UI Kit · демо без сохранения')).toBeVisible();
    await expect(page.locator('.kit-icon-tile')).toHaveCount(20);
    await page.getByRole('textbox', { name: 'Поиск иконок' }).fill('Hint');
    await expect(page.locator('.kit-icon-tile')).toHaveCount(1);
    await page.getByRole('button', { name: 'Очистить поиск', exact: true }).click();
    await expect(page.locator('.kit-icon-tile')).toHaveCount(20);
    await page.getByRole('textbox', { name: 'Поиск иконок' }).fill('no-such-icon');
    await expect(page.getByText('Иконки не найдены.')).toBeVisible();
    await page.getByRole('button', { name: 'Очистить поиск', exact: true }).click();
    const targetSizes = await page.locator('.koda-button').evaluateAll(buttons => buttons.map(button => ({ name: button.getAttribute('aria-label') || button.textContent, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
    for (const target of targetSizes) {
      expect(target.width, `${target.name} target width`).toBeGreaterThanOrEqual(44);
      expect(target.height, `${target.name} target height`).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('textbox', { name: 'Поиск иконок' }).focus();
    await page.keyboard.press('Tab');
    const firstRun = page.getByRole('button', { name: 'Запустить', exact: true });
    await expect(firstRun).toBeFocused();
    const outline = await firstRun.evaluate(element => ({ style: getComputedStyle(element).outlineStyle, width: parseFloat(getComputedStyle(element).outlineWidth) }));
    expect(outline.style).not.toBe('none');
    expect(outline.width).toBeGreaterThanOrEqual(2);
    await page.keyboard.press('Enter');
    await expect(page.locator('.kit-button-row').first().locator('button').first()).toBeDisabled();
    await expect(page.locator('.kit-output')).toContainText('Демонстрация запуска');
    await expect(page.locator('.kit-output')).toContainText('Python не выполнялся');
    await expect(firstRun).toBeEnabled();
    await page.getByRole('button', { name: 'Проверить пример', exact: true }).click();
    await expect(page.locator('.kit-output')).toContainText('Правильность кода не оценивалась');
    const hint = page.getByRole('button', { name: 'Подсказка', exact: true });
    await hint.click();
    await expect(hint).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.kit-hint')).toBeVisible();
    await page.getByRole('button', { name: 'Показать подсказку', exact: true }).click();
    await expect(hint).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.kit-hint')).toHaveCount(0);
    await page.getByRole('button', { name: 'Сбросить демо', exact: true }).click();
    await expect(page.locator('.kit-output')).toContainText('Демонстрация сброшена');
    await expect(page.getByRole('button', { name: 'Проверить', exact: true }).last()).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Сохранение выполняется', exact: true })).toBeDisabled();
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport + 1);
    await page.screenshot({ path: testInfo.outputPath(`ui-kit-${width}.png`), fullPage: true });
    expect(errors).toEqual([]);
    expect(traffic).toEqual([]);
    const writes = await page.evaluate(() => (window as unknown as { __kitStorageWrites: string[] }).__kitStorageWrites);
    expect(writes.filter(key => key !== 'koda:theme')).toEqual([]);
  });
}
