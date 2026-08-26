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

test("phone left sidebar opens and closes with horizontal swipes", async ({
  page,
}) => {
  await signInOnPhone(page);
  await page
    .getByRole("navigation", { name: "Основные разделы" })
    .getByRole("button", { name: "Знания", exact: true })
    .click();

  const drawerTrigger = page.getByRole("button", {
    name: "Открыть панель раздела",
  });
  await expect(drawerTrigger).toBeVisible();
  await expect(drawerTrigger).toHaveAttribute("aria-expanded", "false");

  await swipe(page.locator("body"), {
    startX: 8,
    startY: 320,
    endX: 92,
    endY: 324,
  });
  await expect(
    page.getByRole("button", { name: "Закрыть панель раздела" }),
  ).toHaveAttribute("aria-expanded", "true");

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
  await expect(drawerTrigger).toHaveAttribute("aria-expanded", "false");
});

test("phone sidebar destination activates and closes on one tap", async ({
  page,
}) => {
  await signInOnPhone(page);
  await page
    .getByRole("navigation", { name: "Основные разделы" })
    .getByRole("button", { name: "Знания", exact: true })
    .click();

  await page
    .getByRole("button", { name: "Открыть панель раздела" })
    .click();
  const documentButton = page.locator(".knowledge-tree-row.document").first();
  const title = (await documentButton.textContent())?.trim();
  expect(title).toBeTruthy();

  await documentButton.click();
  await expect(
    page.getByRole("button", { name: "Открыть панель раздела" }),
  ).toHaveAttribute("aria-expanded", "false");
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

  const drawerTrigger = page.getByRole("button", {
    name: "Открыть панель раздела",
  });
  await expect(drawerTrigger).toBeVisible();

  await swipe(page.locator("body"), {
    startX: 8,
    startY: 300,
    endX: 92,
    endY: 304,
  });
  await expect(
    page.getByRole("button", { name: "Закрыть панель раздела" }),
  ).toHaveAttribute("aria-expanded", "true");

  const canvasSidebar = page.getByRole("complementary", {
    name: "Управление холстами",
  });
  await expect(canvasSidebar).toBeVisible();
  await swipe(canvasSidebar, {
    startX: 250,
    startY: 340,
    endX: 145,
    endY: 342,
  });
  await expect(drawerTrigger).toHaveAttribute("aria-expanded", "false");
});
