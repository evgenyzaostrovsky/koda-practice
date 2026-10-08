import { expect, test, type Page } from '@playwright/test';

async function watchIsolation(page: Page) {
  const apiRequests: string[] = [];
  const mutations: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(`${request.method()} ${request.url()}`);
  });
  await page.addInitScript(() => {
    const writes: string[] = [];
    Object.assign(window, { __prototypeStorageWrites: writes });
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      writes.push(key);
      return original.call(this, key, value);
    };
  });
  // A faulty prototype must never reach a real API while this regression runs.
  await page.route('**/api/**', route => route.abort());
  return async () => {
    expect(errors).toEqual([]);
    expect(apiRequests).toEqual([]);
    expect(mutations).toEqual([]);
    const writes = await page.evaluate(() => (window as unknown as { __prototypeStorageWrites: string[] }).__prototypeStorageWrites);
    // Global theme initialization persists its migration marker before route isolation.
    // Both preferences predate the prototype; all practice/progress writes stay forbidden.
    expect(writes.filter(key => !['koda:theme', 'koda:air-migration:v1'].includes(key))).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem('koda:air-migration:v1'))).toBe('done');
  };
}

test('design prototype opens without touching live practice services or progress', async ({ page }) => {
  const verifyIsolation = await watchIsolation(page);
  await page.goto('/design-prototype');
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('h1')).toBeVisible();
  await verifyIsolation();
});

for (const width of [1440, 390]) {
  test(`prototype four screens and demo actions remain usable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const verifyIsolation = await watchIsolation(page);
    await page.goto('/design-prototype');
    const navigate = async (label: string) => {
      if (width < 800) await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
      await page.locator('nav').getByRole('button', { name: label, exact: true }).click();
      await expect(page.getByRole('heading', { name: label, exact: true, level: 1 })).toBeVisible();
      await expect(page.getByText('Демо · без сохранения', { exact: true })).toBeVisible();
      await expect(page.locator('nav button[aria-current="page"]')).toHaveText(label);
    };
    const capture = async (name: string) => {
      const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
      expect(dimensions.width, `${name} page overflow`).toBeLessThanOrEqual(dimensions.viewport + 1);
      await page.screenshot({ path: testInfo.outputPath(`${width}-${name}.png`), fullPage: name !== 'catalog' });
    };
    await expect(page.locator('nav button')).toHaveCount(4);
    await expect(page.getByRole('heading', { name: 'Обзор', exact: true, level: 1 })).toBeVisible();
    await capture('overview');
    if (width < 800) {
      const opener = page.getByRole('button', { name: 'Открыть меню', exact: true });
      await opener.click();
      await expect(page.getByRole('button', { name: 'Закрыть меню', exact: true })).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(page.locator('nav button').last()).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Закрыть меню', exact: true })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(opener).toBeFocused();
    }
    await navigate('Практика');
    const editor = page.getByRole('textbox', { name: 'Код решения' });
    const starter = await editor.inputValue();
    await expect(page.getByRole('status')).toContainText('Запустите код');
    await expect(page.locator('.kd-hint')).toHaveCount(0);
    await page.getByRole('button', { name: 'Открыть подсказку 1', exact: true }).click();
    await expect(page.locator('.kd-hint')).toHaveCount(1);
    await editor.fill('print("demo")\ninvalid syntax');
    await page.getByRole('button', { name: 'Запустить', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Вывод запуска');
    await expect(page.getByRole('status')).toContainText('Python в этом макете не выполняется');
    await page.getByRole('button', { name: 'Проверить', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Проверка решения');
    await expect(page.getByRole('status')).toContainText('правильность решения не оценивалась');
    await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
    await expect(editor).toHaveValue(starter);
    await expect(page.locator('.kd-hint')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Запустите код');
    await capture('practice');
    await navigate('Каталог');
    await page.getByRole('textbox', { name: 'Поиск по каталогу' }).fill('qa-no-such-topic-987654');
    await expect(page.getByText('Ничего не найдено. Попробуйте другой запрос.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Поиск по каталогу' }).fill('');
    const topic = await page.getByRole('combobox', { name: 'Фильтр по теме' }).locator('option').nth(1).getAttribute('value');
    await page.getByRole('combobox', { name: 'Фильтр по теме' }).selectOption(topic!);
    await expect(page.locator('.kd-catalog-head')).toHaveCount(1);
    await capture('catalog');
    const selectedTitle = await page.locator('.kd-task-row').nth(1).locator('strong').innerText();
    await page.locator('.kd-task-row').nth(1).click();
    await expect(page.locator('.kd-problem h2')).toHaveText(selectedTitle);
    await navigate('Прогресс');
    await expect(page.locator('.kd-progress-summary')).toContainText('нет реальных попыток');
    await capture('progress');
    await navigate('Обзор');
    await expect(page.locator('.kd-resume')).toContainText(selectedTitle);
    await verifyIsolation();
  });
}
