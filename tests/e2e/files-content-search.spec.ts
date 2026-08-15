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

async function openFiles(page: Page): Promise<void> {
  const applicationNavigation = page.getByRole("navigation", {
    name: "Разделы приложения",
  });
  await applicationNavigation
    .getByRole("button", { name: "Файлы", exact: true })
    .click();
}

test("finds a phrase inside a Project file whose name does not contain the query and opens the result", async ({
  page,
}) => {
  const phrase = "Кощей обсуждает архитектуру поискового индекса";
  const filename = "neutral-e2e-note.txt";

  await signIn(page);
  await openFiles(page);

  const uploadButton = page.getByRole("button", {
    name: "Загрузить файл",
    exact: true,
  });
  const chooserPromise = page.waitForEvent("filechooser");
  await uploadButton.click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: filename,
    mimeType: "text/plain",
    buffer: Buffer.from(`Служебная строка.\n${phrase}.\nКонец документа.`),
  });

  await expect(
    page.getByText(`Загружен: ${filename}`, { exact: true }),
  ).toBeVisible();

  const search = page.getByPlaceholder("Поиск по имени и содержимому");
  await search.fill("архитектура поискового индекса");

  const result = page.getByRole("button", { name: new RegExp(filename) });
  await expect(result).toBeVisible({ timeout: 20_000 });
  await result.click();

  const preview = page.getByRole("complementary", {
    name: "Предпросмотр файла",
  });
  await expect(preview.getByText(filename, { exact: true })).toBeVisible();
  const openButton = preview.getByRole("button", {
    name: "Открыть",
    exact: true,
  });
  await expect(openButton).toBeEnabled();

  const popupPromise = page.waitForEvent("popup");
  await openButton.click();
  const popup = await popupPromise;
  await expect(popup.locator("body")).toContainText(phrase);
  await popup.close();
});
