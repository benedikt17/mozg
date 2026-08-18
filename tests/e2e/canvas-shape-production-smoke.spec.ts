import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "./test-user";

async function signIn(page: Page): Promise<void> {
  await page.goto("/prototype/desktop");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fprototype%2Fdesktop$/);
  await page.getByLabel("Email").fill(E2E_USER_EMAIL);
  await page.getByLabel("Пароль").fill(E2E_USER_PASSWORD);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/\/prototype\/desktop$/);
}

function frameFor(shape: Locator): Locator {
  return shape.locator('xpath=ancestor::*[@data-canvas-node-frame="true"]');
}

test("Production Canvas persists rectangle and circle through real cloud save", async ({ page, context }) => {
  const run = process.env.GITHUB_RUN_ID ?? String(Date.now());
  const canvasTitle = `Shape Production Smoke ${run}`;
  const rectangleText = `Rectangle Production Smoke ${run}`;
  const circleText = `Circle Production Smoke ${run}`;
  const browserErrors: string[] = [];

  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
  });

  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "https://mozg-production.vercel.app",
  });

  await signIn(page);
  const navigation = page.getByRole("navigation", { name: "Разделы приложения" });
  await navigation.getByRole("button", { name: "Холсты", exact: true }).click();
  await expect(
    navigation.getByRole("button", { name: "Холсты", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Новый холст", exact: true }).click();
  await page.getByLabel("Новый холст", { exact: true }).fill(canvasTitle);
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await expect(page.getByRole("button", { name: canvasTitle, exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  const canvasToolbar = page.getByRole("toolbar", { name: "Инструменты холста" });
  const addRectangle = canvasToolbar.getByRole("button", {
    name: "Добавить прямоугольник",
    exact: true,
  });
  const addCircle = canvasToolbar.getByRole("button", {
    name: "Добавить круг",
    exact: true,
  });
  await expect(addRectangle).toBeEnabled();
  await expect(addCircle).toBeEnabled();

  await addRectangle.click();
  const rectangle = page.locator('[data-canvas-shape="rectangle"]').last();
  await expect(rectangle).toBeVisible();
  const rectangleEditor = page.getByRole("textbox", { name: "Canvas text" });
  await rectangleEditor.fill(rectangleText);
  await rectangleEditor.press("Tab");
  await expect(rectangle).toContainText(rectangleText);

  await rectangle.click();
  const shapeToolbar = page.locator('[aria-label="Панель форматирования фигуры"]');
  await expect(shapeToolbar).toBeVisible();
  await shapeToolbar.getByRole("button", { name: "Цвет заливки", exact: true }).click();
  const fillHex = page.getByLabel("Цвет заливки: HEX", { exact: true });
  await fillHex.fill("#12AB34");
  await fillHex.press("Enter");
  await expect(rectangle).toHaveCSS("background-color", "rgb(18, 171, 52)");
  await page.keyboard.press("Escape");

  const rectangleFrame = frameFor(rectangle);
  const beforeResize = await rectangleFrame.boundingBox();
  expect(beforeResize).not.toBeNull();
  const resizeHandle = rectangleFrame.locator(".react-flow__resize-control.handle").last();
  await expect(resizeHandle).toBeVisible();
  const resizeBox = await resizeHandle.boundingBox();
  expect(resizeBox).not.toBeNull();
  if (!beforeResize || !resizeBox) throw new Error("Resize geometry unavailable");
  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeBox.x + resizeBox.width / 2 + 80, resizeBox.y + resizeBox.height / 2 + 40, {
    steps: 8,
  });
  await page.mouse.up();
  await expect.poll(async () => (await rectangleFrame.boundingBox())?.width ?? 0).toBeGreaterThan(
    beforeResize.width + 30,
  );

  await addCircle.click();
  const circle = page.locator('[data-canvas-shape="circle"]').last();
  await expect(circle).toBeVisible();
  const circleEditor = page.getByRole("textbox", { name: "Canvas text" });
  await circleEditor.fill(circleText);
  await circleEditor.press("Tab");
  await expect(circle).toContainText(circleText);

  const edgeCountBefore = await page.locator(".react-flow__edge").count();
  await rectangle.click();
  const sourceHandle = frameFor(rectangle).getByLabel("right connection handle");
  const targetHandle = frameFor(circle).getByLabel("left connection handle");
  const sourceBox = await sourceHandle.boundingBox();
  const targetBox = await targetHandle.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Connection handle geometry unavailable");
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
  await expect.poll(() => page.locator(".react-flow__edge").count()).toBe(edgeCountBefore + 1);

  const circlesBeforePaste = await page.locator('[data-canvas-shape="circle"]').count();
  await circle.click();
  await page.keyboard.press("Control+C");
  await page.keyboard.press("Control+V");
  await expect.poll(() => page.locator('[data-canvas-shape="circle"]').count()).toBe(
    circlesBeforePaste + 1,
  );

  await expect(page.getByText("Сохранено", { exact: true }).last()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Cloud Canvas input was rejected/i)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("button", { name: canvasTitle, exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator('[data-canvas-shape="rectangle"]')).toHaveCount(1);
  await expect(page.locator('[data-canvas-shape="circle"]')).toHaveCount(circlesBeforePaste + 1);
  await expect(page.locator('[data-canvas-shape="rectangle"]')).toContainText(rectangleText);
  await expect(page.locator('[data-canvas-shape="circle"]').first()).toContainText(circleText);
  await expect(page.locator('[data-canvas-shape="rectangle"]')).toHaveCSS(
    "background-color",
    "rgb(18, 171, 52)",
  );
  await expect(page.locator(".react-flow__edge")).toHaveCount(edgeCountBefore + 1);
  await expect(addRectangle).toBeEnabled();
  await expect(addCircle).toBeEnabled();
  await expect(page.getByText(/Cloud Canvas input was rejected/i)).toHaveCount(0);

  const relevantErrors = browserErrors.filter((line) =>
    /canvas|supabase|uncaught|error/i.test(line),
  );
  expect(relevantErrors, relevantErrors.join("\n")).toEqual([]);

  console.log(`SMOKE:PASS canvas=${canvasTitle}`);
  console.log("SMOKE:rectangle=create,text,color,resize,persist PASS");
  console.log("SMOKE:circle=create,text,copy-paste,persist PASS");
  console.log("SMOKE:connection=create,persist PASS");
  console.log("SMOKE:cloud-rejection=absent PASS");
});
