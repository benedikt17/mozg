import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "./test-user";

async function signInOnPhone(page: Page): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/prototype/desktop");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fprototype%2Fdesktop$/);
  await page.getByLabel("Email").fill(E2E_USER_EMAIL);
  await page.getByLabel("Пароль").fill(E2E_USER_PASSWORD);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/\/prototype\/desktop$/);
  await expect(
    page.getByRole("navigation", { name: "Основные разделы" }),
  ).toBeVisible();
}

async function swipe(
  target: Locator,
  input: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  },
): Promise<void> {
  await target.dispatchEvent("pointerdown", {
    bubbles: true,
    pointerId: 41,
    pointerType: "touch",
    clientX: input.startX,
    clientY: input.startY,
  });
  await target.dispatchEvent("pointerup", {
    bubbles: true,
    pointerId: 41,
    pointerType: "touch",
    clientX: input.endX,
    clientY: input.endY,
  });
}

function drawerTrigger(page: Page): Locator {
  return page.locator(".mobile-tool-sidebar-trigger");
}

test("phone left sidebar opens and closes with horizontal swipes", async ({
  page,
}) => {
  await signInOnPhone(page);
  await page
    .getByRole("navigation", { name: "Основные разделы" })
    .getByRole("button", { name: "Знания", exact: true })
    .click();

  const trigger = drawerTrigger(page);
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  await swipe(page.locator("body"), {
    startX: 1,
    startY: 320,
    endX: 116,
    endY: 324,
  });
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  const sidebar = page.getByRole("complementary", {
    name: "Дерево документов",
  });
  await expect(sidebar).toBeVisible();
  await swipe(sidebar, {
    startX: 250,
    startY: 360,
    endX: 150,
    endY: 356,
  });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("phone sidebar destination activates and closes on one tap", async ({
  page,
}) => {
  await signInOnPhone(page);
  await page
    .getByRole("navigation", { name: "Основные разделы" })
    .getByRole("button", { name: "Знания", exact: true })
    .click();

  const trigger = drawerTrigger(page);
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  const tree = page.getByRole("navigation", { name: "Иерархия документов" });
  const folderButton = tree.locator(".knowledge-tree-row.folder").first();
  await expect(folderButton).toBeVisible();
  if ((await folderButton.getAttribute("aria-expanded")) !== "true") {
    await folderButton.click();
  }

  const documentRow = tree.locator("[data-knowledge-document-id]").first();
  const documentButton = documentRow.locator(
    "button.knowledge-tree-row.document",
  );
  await expect(documentButton).toBeVisible();
  const title = (await documentButton.textContent())?.trim();
  expect(title).toBeTruthy();

  await documentButton.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".application-article-title")).toContainText(
    title ?? "",
  );
});

test("phone Canvas drawer uses the same swipe contract", async ({ page }) => {
  await signInOnPhone(page);
  await page
    .getByRole("navigation", { name: "Основные разделы" })
    .getByRole("button", { name: "Холсты", exact: true })
    .click();

  const trigger = drawerTrigger(page);
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  await swipe(page.locator("body"), {
    startX: 1,
    startY: 300,
    endX: 116,
    endY: 304,
  });
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  const canvasSidebar = page.getByRole("complementary", {
    name: "Дерево холстов",
  });
  await expect(canvasSidebar).toBeVisible();

  const canvasDestination = canvasSidebar
    .locator("[data-canvas-id] button")
    .first();
  await expect(canvasDestination).toBeVisible();
  await canvasDestination.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  await swipe(page.locator("body"), {
    startX: 1,
    startY: 300,
    endX: 116,
    endY: 304,
  });
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  await swipe(canvasSidebar, {
    startX: 250,
    startY: 340,
    endX: 145,
    endY: 342,
  });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test.describe("native mobile touch", () => {
  test.use({ hasTouch: true });

  test("phone knowledge folder toggles on one native touch without closing drawer", async ({
    page,
  }) => {
    await signInOnPhone(page);
    await page
      .getByRole("navigation", { name: "Основные разделы" })
      .getByRole("button", { name: "Знания", exact: true })
      .click();

    const trigger = drawerTrigger(page);
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".mobile-sidebar-edge-hint")).toHaveCount(0);

    const tree = page.getByRole("navigation", { name: "Иерархия документов" });
    const folderButton = tree.locator(".knowledge-tree-row.folder").first();
    await expect(folderButton).toBeVisible();
    const before = await folderButton.getAttribute("aria-expanded");
    const box = await folderButton.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

    await expect(folderButton).toHaveAttribute(
      "aria-expanded",
      before === "true" ? "false" : "true",
    );
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
