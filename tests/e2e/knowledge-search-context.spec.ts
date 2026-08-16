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

async function getKnowledgeSearchHighlightText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const registry = (
      CSS as typeof CSS & {
        highlights?: {
          get: (name: string) =>
            | {
                values: () => IterableIterator<Range>;
              }
            | undefined;
        };
      }
    ).highlights;
    const highlight = registry?.get("knowledge-search-match");
    return highlight
      ? Array.from(highlight.values(), (range) =>
          range.toString().toLocaleLowerCase("ru"),
        )
      : [];
  });
}

test("global Search finds a current-Project Knowledge article by body text and opens it", async ({
  page,
}) => {
  await signIn(page);

  await page.getByRole("button", { name: "Поиск", exact: true }).click();
  const palette = page.getByRole("region", { name: "Командная палитра" });
  await expect(palette).toBeVisible();

  const searchInput = palette.locator("input");
  await searchInput.fill("почему герои не могут");

  const result = palette.getByRole("button", {
    name: /Карта Лукоморья/,
  });
  await expect(result).toBeVisible();
  await expect(result).toContainText("почему герои не могут");
  await result.click();

  await expect(
    page
      .getByRole("navigation", { name: "Разделы приложения" })
      .getByRole("button", { name: "Знания", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { level: 1, name: "Карта Лукоморья" }),
  ).toBeVisible();
  await expect
    .poll(() => getKnowledgeSearchHighlightText(page))
    .toContain("почему герои не могут");

  const tree = page.getByRole("navigation", { name: "Иерархия документов" });
  await tree.getByRole("button", { name: "Острова", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Острова" }),
  ).toBeVisible();
  await expect.poll(() => getKnowledgeSearchHighlightText(page)).toEqual([]);
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
  await expect(panel.getByText("Список сцен", { exact: true })).toHaveCount(0);

  await panel.getByRole("tab", { name: "Структура", exact: true }).click();
  await expect(
    panel.getByText("Мир / География / Карта Лукоморья", { exact: true }),
  ).toBeVisible();

  const tree = page.getByRole("navigation", { name: "Иерархия документов" });
  await tree.getByRole("button", { name: "Острова", exact: true }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Острова" }),
  ).toBeVisible();
  await expect(
    panel.getByText("Мир / География / Острова", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("Мир / География / Карта Лукоморья", { exact: true }),
  ).toHaveCount(0);
});
