import { expect, test, type Page } from "@playwright/test";

const runButton = (page: Page) => page.getByRole("button", { name: /^Запустить$/ });
async function run(page: Page, code: string, timeout = 150_000) {
  const clear = page.getByRole("button", { name: "Очистить" });
  if (await clear.isVisible().catch(() => false)) await clear.click();
  await page.locator(".monaco-editor textarea").click({ force: true });
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(code);
  await page.waitForTimeout(500);
  await runButton(page).click();
  await expect(page.locator(".sandbox-result")).toBeVisible({ timeout });
}

test("cold and warm plots render while user timeout still stops code and restart recovers", async ({ page }) => {
  test.setTimeout(360_000);
  await page.addLocatorHandler(page.getByRole('button', { name: 'Продолжить', exact: true }), async button => {
    for (let count = 0; count < 30 && await button.isVisible(); count += 1) {
      try { await button.click({ timeout: 2_000 }); }
      catch (error) { if (!(await button.isVisible())) break; throw error; }
    }
  }, { noWaitAfter: true });
  await page.goto("/sandbox");
  await expect(page.locator(".sandbox-runtime.ready")).toContainText("Python готов", { timeout: 120_000 });
  await run(page, "import matplotlib.pyplot as plt\nplt.plot([1,2],[1,2])\nplt.show()");
  await expect(page.locator(".sandbox-plot")).toBeVisible();
  await run(page, "import matplotlib.pyplot as plt\nplt.plot([1,2],[2,1])\nplt.show()");
  await expect(page.locator(".sandbox-plot")).toBeVisible();
  await run(page, "while True:\n    pass", 30_000);
  await expect(page.locator(".sandbox-traceback")).toContainText("превышен лимит 15 секунд", { timeout: 25_000 });
  await expect(page.locator(".sandbox-runtime.ready")).toContainText("Python готов", { timeout: 120_000 });
  await run(page, "6 * 7");
  await expect(page.locator(".sandbox-value")).toHaveText("42");
  const beforeStop=await page.evaluate(()=>JSON.parse(localStorage.getItem('koda:run-observations:v1:anonymous')||'[]').length);
  await page.locator('.monaco-editor textarea').click({force:true});await page.keyboard.press('ControlOrMeta+A');await page.keyboard.insertText('while True:\n    pass');
  await runButton(page).click();await page.getByRole('button',{name:'Остановить',exact:true}).click();
  await expect(page.locator('.sandbox-runtime.ready')).toContainText('Python готов',{timeout:120000});
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('koda:run-observations:v1:anonymous')||'[]').length)).toBe(beforeStop);
  await run(page,'1 + 1');await expect(page.locator('.sandbox-value')).toHaveText('2');
});
