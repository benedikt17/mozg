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

test("uploads to Inbox, creates a folder, previews and downloads an original", async ({
  page,
}) => {
  await signIn(page);

  const applicationNavigation = page.getByRole("navigation", {
    name: "Разделы приложения",
  });
  await applicationNavigation
    .getByRole("button", { name: "Файлы", exact: true })
    .click();

  const uploadButton = page.getByRole("button", {
    name: "Загрузить файл",
    exact: true,
  });
  await expect(uploadButton).toBeEnabled();
  await expect(uploadButton).toContainText("Загрузить");

  const inboxFileChooserPromise = page.waitForEvent("filechooser");
  await uploadButton.click();
  const inboxFileChooser = await inboxFileChooserPromise;
  await inboxFileChooser.setFiles({
    name: "inbox-note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Inbox upload contract."),
  });

  await expect(
    page.getByText("Загружен: inbox-note.txt", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /inbox-note\.txt/ }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Создать папку", exact: true })
    .click();
  const folderNameInput = page.getByRole("textbox", {
    name: "Название новой папки",
  });
  await folderNameInput.fill("E2E Assets");
  await folderNameInput.press("Enter");

  const filesNavigation = page.getByRole("complementary", {
    name: "Навигация по файлам",
  });
  await expect(
    filesNavigation.getByRole("button", { name: "E2E Assets", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Папка пуста", { exact: true })).toBeVisible();
  await expect(uploadButton).toBeEnabled();

  const folderFileChooserPromise = page.waitForEvent("filechooser");
  await uploadButton.click();
  const folderFileChooser = await folderFileChooserPromise;
  await folderFileChooser.setFiles({
    name: "pixel.gif",
    mimeType: "image/gif",
    buffer: Buffer.from(
      "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
      "base64",
    ),
  });

  await expect(
    page.getByText("Загружен: pixel.gif", { exact: true }),
  ).toBeVisible();
  const imageRow = page.getByRole("button", { name: /pixel\.gif/ });
  await expect(imageRow).toBeVisible();
  await imageRow.click();

  const preview = page.getByRole("complementary", {
    name: "Предпросмотр файла",
  });
  await expect(preview.getByRole("img", { name: "pixel.gif" })).toBeVisible();
  const downloadButton = preview.getByRole("button", {
    name: "Скачать оригинал",
    exact: true,
  });
  await expect(downloadButton).toBeEnabled();

  const downloadPromise = page.waitForEvent("download");
  await downloadButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("pixel.gif");

  await filesNavigation
    .getByRole("button", { name: "Входящие", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /inbox-note\.txt/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /pixel\.gif/ })).toHaveCount(0);
});
