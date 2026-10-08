import { expect, test } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`Market journey keeps source order across knowledge units at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 });
    const course = await (await request.get('/market-course.json')).json();
    expect(course.lessons).toHaveLength(19);
    const groupby = course.lessons[0];
    expect(groupby.taskIds).toHaveLength(12);
    expect(groupby.source_start).toBe(1);
    expect(groupby.source_end).toBe(12);
    expect(course.lessons.reduce((count: number, lesson: { taskIds: string[] }) => count + lesson.taskIds.length, 0)).toBe(115);
    await page.goto('/catalog?course=koda-market');
    await expect(page.locator('.module-card')).toHaveCount(19);
    const lessonCard = page.locator('.module-card').nth(0);
    await expect(lessonCard).toContainText('ЗАДАЧИ 1–12');
    await lessonCard.click();
    await expect(page).toHaveURL(new RegExp(`/practice/${groupby.taskIds[0]}\\?course=koda-market&lesson=market-1$`));
    const route = page.getByRole('navigation', { name: 'Задачи темы' });
    await expect(route.getByRole('link')).toHaveCount(12);
    expect(await route.getByRole('link').evaluateAll(nodes => nodes.map(node => new URL((node as HTMLAnchorElement).href).pathname.split('/').pop()))).toEqual(groupby.taskIds);
    await route.getByRole('link').nth(10).click();
    await expect(page).toHaveURL(new RegExp(`/practice/${groupby.taskIds[10]}\\?course=koda-market&lesson=market-1$`));
    await expect(page.getByRole('heading', { level: 1, name: groupby.title, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Следующая задача', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/practice/${groupby.taskIds[11]}\\?course=koda-market&lesson=market-1$`));
    await page.getByRole('button', { name: 'Назад к теме', exact: true }).click();
    await expect(page).toHaveURL(/\/catalog\?course=koda-market$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  });
}
