import { expect, test, type Page } from "@playwright/test";

import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "./test-user";

async function signIn(page: Page): Promise<void> {
  await page.goto("/prototype/desktop");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fprototype%2Fdesktop$/);

  await page.getByLabel("Email").fill(E2E_USER_EMAIL);
  await page.getByLabel("Пароль").fill(E2E_USER_PASSWORD);
  await page.getByRole("button", { name: "Войти", exact: true }).click();

  await expect(page).toHaveURL(/\/prototype\/desktop$/);
  await expect(
    page.getByRole("navigation", { name: "Разделы приложения" }),
  ).toBeVisible();
}

test("global Search finds a current-Project Knowledge article by body text and opens it", async ({
  page,
}) => {
  await signIn(page);

  await page.getByRole("button", { name: "Поиск", exact: true }).click();
  const palette = page.getByRole("region", { name: "Командная палитра" });
  await expect(palette).toBeVisible();

  const searchInput = palette.locator("input");
  await searchInput.fill("забирает ресурс");

  const result = palette.getByRole("button", {
    name: /Пути между островами/,
  });
  await expect(result).toBeVisible();
  await expect(result).toContainText(
    "Переход между островами всегда забирает ресурс",
  );
  await result.click();

  await expect(
    page
      .getByRole("navigation", { name: "Разделы приложения" })
      .getByRole("button", { name: "Знания", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { level: 1, name: "Пути между островами" }),
  ).toBeVisible();
});

test("Knowledge document Context follows the active article instead of the article that opened it", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(
    "/prototype/desktop?section=knowledge&document=doc-l-map&context=document",
  );

  await expect(
    page.getByRole("heading", { level: 1, name: "Карта Лукоморья" }),
  ).toBeVisible();

  const panel = page.getByRole("complementary", {
    name: "Контекстная панель",
  });
  await expect(panel).toBeVisible();
  await panel.getByRole("tab", { name: "Исходящие", exact: true }).click();
  await expect(panel.getByText("Острова", { exact: true })).toBeVisible();
  await expect(
    panel.getByText("Пути между островами", { exact: true }),
  ).toBeVisible();
  await expect(panel.getByText("Правила магии", { exact: true })).toBeVisible();

  const targetDocument = page.locator(
    '[data-knowledge-document-id="doc-l-routes"]',
  );
  await targetDocument
    .getByRole("button", { name: "Пути между островами" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Пути между островами" }),
  ).toBeVisible();
  await expect(
    panel.getByText("Исходящих ссылок нет.", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("Правила магии", { exact: true }),
  ).toHaveCount(0);
});
