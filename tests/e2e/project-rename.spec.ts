import { expect, test, type Page } from "@playwright/test";

import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "./test-user";

async function signIn(page: Page): Promise<void> {
  await page.goto("/prototype/desktop");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fprototype%2Fdesktop$/);
  await page.getByLabel("Email").fill(E2E_USER_EMAIL);
  await page.getByLabel("Пароль").fill(E2E_USER_PASSWORD);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/\/prototype\/desktop$/);
}

test("renames a project from the application header", async ({
  page,
}, testInfo) => {
  await signIn(page);

  const title = page.locator(".application-project-title");
  const nextName = `Проект ${process.env.GITHUB_RUN_ID ?? Date.now()}-${testInfo.retry}`;
  await title.dblclick();
  const editor = page.getByRole("textbox", { name: "Название проекта" });
  await expect(editor).toBeFocused();
  await editor.fill(nextName);
  await editor.press("Enter");

  await expect(title.getByText(nextName, { exact: true })).toBeVisible();
  await expect(page.getByRole("status", { name: "Сохранение…" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Сохранено" })).toBeVisible();
  await page.reload();
  await expect(title.getByText(nextName, { exact: true })).toBeVisible();
});
