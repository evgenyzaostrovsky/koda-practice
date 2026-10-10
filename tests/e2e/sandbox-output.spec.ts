import { expect, test, type Page } from "@playwright/test";

const runButton = (page: Page) => page.getByRole("button", { name: /^Запустить$/ });

async function run(page: Page, code: string) {
  const acknowledge = page.getByRole("button", { name: "Продолжить" });
  for (let count = 0; count < 30; count += 1) {
    const appeared = await acknowledge.waitFor({ state: "visible", timeout: 1_500 }).then(() => true).catch(() => false);
    if (!appeared) break;
    await acknowledge.click();
    await page.waitForTimeout(500);
  }
  const clear = page.getByRole("button", { name: "Очистить" });
  if (await clear.isVisible().catch(() => false)) {
    await clear.click();
    await expect(page.locator(".sandbox-result")).toHaveCount(0);
  }
  await page.locator(".monaco-editor textarea").click({ force: true });
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(code);
  await page.waitForTimeout(500);
  await runButton(page).click();
  await expect(page.locator(".sandbox-result")).toBeVisible({ timeout: 120_000 });
}

test("real Pyodide output reaches the sandbox DOM", async ({ page }) => {
  test.setTimeout(300_000);
  const missingCode = "import pandas as pd\ndf = pd.DataFrame({'city': ['Москва', 'Казань', None], 'sales': [12, float('nan'), 8]})\nprint(df)\ndf";
  await page.addInitScript((code) => localStorage.setItem("koda:sandbox-code:v1", code), missingCode);
  await page.goto("/sandbox");
  await expect(page.locator(".sandbox-runtime.ready")).toContainText("Python готов", { timeout: 120_000 });

  await runButton(page).click();
  await expect(page.locator(".sandbox-table-wrap")).toContainText("Москва");
  await expect(page.locator(".sandbox-table-wrap")).toContainText("Казань");
  await expect(page.locator(".sandbox-table-wrap")).toContainText("sales");
  await expect(page.locator(".sandbox-stdout")).toContainText("NaN");
  await expect(page.locator(".sandbox-table-wrap tbody tr").nth(1).locator("td").nth(1)).toHaveText("");
  await expect(page.locator(".sandbox-table-wrap tbody tr").nth(2).locator("td").nth(0)).toHaveText("");
  await run(page, 'print("KODA_STDOUT_TEST")');
  await expect(page.locator(".sandbox-stdout")).toHaveText("KODA_STDOUT_TEST");
  await run(page, "6 * 7");
  await expect(page.locator(".sandbox-value")).toHaveText("42");
  await run(page, 'answer = 17\nanswer');
  await expect(page.locator('.sandbox-value')).toHaveText('17');
  await run(page, 'print("first")\nprint("second")');
  await expect(page.locator('.sandbox-stdout')).toHaveText('first\nsecond');
  await run(page, 'import warnings\nwarnings.warn("QA_WARNING")\n1 + 1');
  await expect(page.locator('.sandbox-value')).toHaveText('2');
  await expect(page.locator('.sandbox-result')).toContainText('QA_WARNING');
  await run(page, 'if True print("invalid")');
  await expect(page.locator('.sandbox-traceback')).toContainText('SyntaxError');
  await run(page, 'print("ROWS", len(df))\ndf.head(1)');
  await expect(page.locator(".sandbox-stdout")).toHaveText("ROWS 3");
  await expect(page.locator(".sandbox-table-wrap tbody tr")).toHaveCount(1);
  await run(page, 'raise ValueError("KODA_ERROR_TEST")');
  await expect(page.locator(".sandbox-traceback")).toContainText("ValueError: KODA_ERROR_TEST");
  await run(page, "import matplotlib.pyplot as plt\nplt.plot([1, 2, 3], [2, 4, 1])\nplt.show()");
  await expect(page.locator(".sandbox-plot")).toBeVisible();
  await expect(page.locator(".sandbox-plot")).toHaveAttribute("src", /^data:image\/png;base64,/);
  const acknowledge = page.getByRole("button", { name: "Продолжить" });
  while (await acknowledge.isVisible().catch(() => false)) {
    await acknowledge.click();
    await page.waitForTimeout(250);
  }
  await page.getByRole("button", { name: /Перезапустить среду/ }).click();
  await expect(page.locator(".sandbox-runtime.ready")).toContainText("Python готов", { timeout: 120_000 });
  await run(page, missingCode);
  await expect(page.locator(".sandbox-table-wrap tbody tr")).toHaveCount(3);
  await page.reload();
  await expect(page.locator(".sandbox-runtime.ready")).toContainText("Python готов", { timeout: 120_000 });
  await runButton(page).click();
  await expect(page.locator(".sandbox-table-wrap tbody tr")).toHaveCount(3);
});

test('CSV upload UI with mocked private storage feeds real isolated Python worker',async({page})=>{
  test.setTimeout(180000);
  const filename='qa_context.csv',content='city,sales\nМосква,12\nКазань,8\n';
  const file={id:'qa-upload',name:filename,logicalPath:`/datasets/${filename}`,sizeBytes:Buffer.byteLength(content),mimeType:'text/csv',createdAt:'2026-10-11T00:00:00Z',updatedAt:'2026-10-11T00:00:00Z',version:'qa-v1'};
  let uploaded=false;
  await page.route('**/api/sandbox/files',route=>{if(route.request().method()==='POST'){uploaded=true;return route.fulfill({status:201,json:file});}return route.fulfill({json:uploaded?[file]:[]});});
  await page.route('**/api/sandbox/files/qa-upload/content',route=>route.fulfill({contentType:'text/csv',body:content}));
  await page.goto('/sandbox');await expect(page.locator('.sandbox-runtime.ready')).toContainText('Python готов',{timeout:120000});
  await page.getByRole('button',{name:'Загрузить файл',exact:true}).click();
  await page.locator('input[type="file"]').setInputFiles({name:filename,mimeType:'text/csv',buffer:Buffer.from('city,sales\nМосква,12\nКазань,8\n')});
  await expect(page.locator('.sandbox-file-list')).toContainText(filename);
  await page.getByRole('button',{name:'Закрыть файлы'}).click();
  await run(page,`import pandas as pd\nuploaded = pd.read_csv('/datasets/${filename}')\nprint(uploaded['sales'].sum())\nuploaded.head(1)`);
  await expect(page.locator('.sandbox-stdout')).toHaveText('20');
  await expect(page.locator('.sandbox-table-wrap tbody tr')).toHaveCount(1);
  await expect(page.locator('.sandbox-table-wrap')).toContainText('Москва');
});
