import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const native = JSON.parse(readFileSync('content/market_native_v2.json', 'utf8'));
const authored = JSON.parse(readFileSync('content/market_authored_v2.json', 'utf8'));
const revision = JSON.parse(readFileSync('content/market_revision.json', 'utf8'));
const ids = new Map<number, string>(authored.tasks.map((row: { source_number: number; task_id: string }) => [row.source_number, row.task_id]));

for (const width of [1280, 390]) {
  test(`authored BI report interactions compute and restore source values at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const states = Object.fromEntries([106, 109, 110, 114].map(number => {
      const taskId = ids.get(number)!;
      return [taskId, { taskId, code: JSON.stringify({ ...native[number].solution_spec, interaction_events: [] }), status: 'draft', attempts: 0, lastRunResult: null, completedAt: null, updatedAt: '2026-10-08', contentRevision: revision.revision }];
    }));
    await page.addInitScript(({ tasks, version }) => {
      if (!localStorage.getItem('qa:authored-seeded')) {
        localStorage.setItem('koda:task-state:v1', JSON.stringify({ version: 1, tasks }));
        localStorage.setItem(`koda:content-revision:${version}:anonymous`, 'applied');
        localStorage.setItem('qa:authored-seeded', 'yes');
      }
    }, { tasks: states, version: revision.revision });
    const report = page.locator('.mode-report');
    async function open(number: number) {
      await page.goto(`/practice/${ids.get(number)}`);
      await page.getByRole('button', { name: /Запустить/ }).click();
      await expect(report).toBeVisible();
    }
    async function card(label: string, expected: number) {
      const value = report.locator('.mode-kpis > div').filter({ has: page.getByText(label, { exact: true }) }).locator('strong');
      await expect.poll(async () => Number((await value.innerText()).replace(/[^\d,.-]/g, '').replace(',', '.'))).toBe(expected);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    }
    async function checkbox(field: string, value: string, checked = true) {
      const box = report.getByRole('group', { name: field, exact: true }).getByRole('checkbox', { name: value, exact: true });
      if (checked) await box.check(); else await box.uncheck();
      await expect(page.getByRole('button', { name: /Запустить/ })).toBeEnabled();
    }
    async function clear() {
      await report.getByRole('button', { name: 'Очистить фильтры и выбор' }).click();
      await expect(page.getByRole('button', { name: /Запустить/ })).toBeEnabled();
    }

    await open(106);
    await card('Выручка', 385000);
    await checkbox('Канал', 'Сайт');
    await card('Выручка', 116400);
    await checkbox('Канал', 'Приложение');
    await card('Выручка', 250000);
    await card('Заказы', 23);
    await clear();
    await card('Выручка', 385000);

    await open(109);
    await card('Доставка дольше трёх дней', 8);
    await checkbox('Город', 'Москва');
    await checkbox('Категория', 'Электроника');
    await card('Доставка дольше трёх дней', 0);
    await card('Средняя доставка', 1);
    await card('Средняя оценка', 4.75);
    await clear();
    await card('Доставка дольше трёх дней', 8);

    await open(110);
    const city = report.getByRole('button', { name: 'Волгоград', exact: true });
    await city.click();
    await card('Выручка', 169000);
    await expect(city).toHaveAttribute('aria-pressed', 'true');
    await city.click();
    await card('Выручка', 385000);
    await expect(city).toHaveAttribute('aria-pressed', 'false');

    await open(114);
    await checkbox('Город', 'Волгоград');
    await card('Выручка', 169000);
    await clear();
    for (const [field, values] of [
      ['Город', ['Москва', 'Тула']],
      ['Канал', ['Сайт', 'Приложение', 'Магазин']],
      ['Статус', ['Оплачен', 'Возврат', 'Отменён']],
    ] as const) {
      for (const value of values) {
        await checkbox(field, value);
        await clear();
      }
    }
    await clear();
    await card('Выручка', 385000);
    await card('Заказы', 30);
    await page.getByRole('button', { name: /Проверить/ }).click();
    await expect(page.locator('.feedback.success.solved')).toBeVisible();
  });
}
