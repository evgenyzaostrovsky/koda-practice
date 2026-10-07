import { expect, test, type Page } from '@playwright/test';

async function edit(page: Page, code: string) {
  await page.locator('.monaco-editor textarea').click({ force: true });
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(code);
}
async function prepare(page: Page) {
  await page.addLocatorHandler(page.getByRole('button', { name: 'Получить', exact: true }), async () => { await dismissRewards(page); }, { noWaitAfter: true });
  await page.goto('/practice/start-001');
  await expect(page.locator('.monaco-editor textarea')).toBeVisible();
  await dismissRewards(page);
}
async function dismissRewards(page: Page) {
  const button = page.getByRole('button', { name: 'Получить', exact: true });
  for (let i = 0; i < 12; i += 1) {
    if (!(await button.isVisible().catch(() => false))) break;
    try {
      await button.click({ timeout: 2000 });
    } catch (error) {
      if (!(await button.isVisible().catch(() => false))) break;
      throw error;
    }
    await page.waitForTimeout(100);
  }
}
const state = (page: Page, taskId = 'start-001') => page.evaluate((id) => JSON.parse(localStorage.getItem('koda:task-state:v1') || '{"tasks":{}}').tasks[id], taskId);

test('real Monaco and FastAPI preserve Run/Check semantics and completed evidence on reset', async ({ page, request }) => {
  await prepare(page);
  const before = (await (await request.get('/api/progress')).json()).attempts;
  const exercise = await (await request.get('/api/exercises/start-001')).json();
  await edit(page, `${exercise.setup_code}\n\nresult = pd.DataFrame(data)`);
  await page.getByRole('button', { name: /^Запустить/ }).click();
  await expect(page.locator('.result')).toContainText('Аня');
  await dismissRewards(page);
  expect((await (await request.get('/api/progress')).json()).attempts).toBe(before);
  await page.getByRole('button', { name: 'Открыть подсказку 1' }).click();
  await expect(page.locator('.hint-item')).toHaveCount(1);
  await page.getByRole('button', { name: /^Проверить/ }).click();
  await dismissRewards(page);
  await expect(page.getByText('Что ты сейчас отработал')).toBeVisible();
  await expect(page.locator('.success-stats')).toContainText('Подсказок: 1');
  expect((await (await request.get('/api/progress')).json()).attempts).toBe(before + 1);
  const completed = await state(page);
  expect(completed.status).toBe('completed');
  await page.getByRole('button', { name: /Сбросить решение/ }).click();
  const reset = await state(page);
  expect(reset.status).toBe('completed');
  expect(reset.attempts).toBe(completed.attempts);
  expect(reset.completedAt).toBe(completed.completedAt);
  expect(reset.code).toContain('result = None');
});

test('draft survives immediate reload and pending task A result stays out of task B', async ({ page }) => {
  await prepare(page);
  await edit(page, 'result = 987654');
  await page.reload();
  await expect(page.locator('.monaco-editor')).toContainText('987654');
  expect((await state(page)).code).toBe('result = 987654');
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  let arrived!: () => void;
  const requested = new Promise<void>(resolve => { arrived = resolve; });
  await page.route('**/api/executions/run', async route => {
    const response = await route.fetch();
    arrived();
    await waiting;
    await route.fulfill({ response });
  });
  await page.getByRole('button', { name: /^Запустить/ }).click();
  await requested;
  await page.getByRole('button', { name: 'Следующая задача', exact: true }).click();
  await expect(page).toHaveURL(/\/practice\/start-002$/);
  await expect(page.locator('.monaco-editor textarea')).toBeVisible();
  release();
  await expect.poll(async () => (await state(page))?.lastRunResult?.result?.data).toBe(987654);
  await expect(page.locator('.result')).not.toContainText('987654');
  expect((await state(page, 'start-002'))?.lastRunResult ?? null).toBeNull();
});

test('practice remains usable at 390px with actual editor and Run output', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  await edit(page, 'result = 42');
  await page.getByRole('button', { name: /^Запустить/ }).click();
  await expect(page.locator('.result pre')).toHaveText('42');
  await expect(page.getByRole('button', { name: /Сбросить решение/ })).toBeEnabled();
  const width = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(width.document).toBeLessThanOrEqual(width.viewport + 1);
});
