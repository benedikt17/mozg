import { mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

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

async function createFolder(page: Page, name: string): Promise<void> {
  await page
    .getByRole("button", { name: "Создать папку", exact: true })
    .click();
  const folderNameInput = page.getByRole("textbox", {
    name: "Название новой папки",
  });
  await folderNameInput.fill(name);
  await folderNameInput.press("Enter");

  const filesNavigation = page.getByRole("complementary", {
    name: "Навигация по файлам",
  });
  await expect(
    filesNavigation.getByRole("button", { name, exact: true }),
  ).toHaveAttribute("aria-current", "page");
}

test("uploads to Inbox, routes a file above 6 MiB through TUS, creates a folder, previews and downloads an original", async ({
  page,
}) => {
  let sawResumableUpload = false;
  page.on("request", (request) => {
    if (request.url().includes("/storage/v1/upload/resumable")) {
      sawResumableUpload = true;
    }
  });

  await signIn(page);
  await openFiles(page);

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
  expect(sawResumableUpload).toBe(false);

  const largeFileChooserPromise = page.waitForEvent("filechooser");
  await uploadButton.click();
  const largeFileChooser = await largeFileChooserPromise;
  await largeFileChooser.setFiles({
    name: "large-note.txt",
    mimeType: "text/plain",
    buffer: Buffer.alloc(7 * 1024 * 1024, "L"),
  });

  await expect(
    page.getByText("Загружен: large-note.txt", { exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("button", { name: /large-note\.txt/ }),
  ).toBeVisible();
  expect(sawResumableUpload).toBe(true);

  await createFolder(page, "E2E Assets");

  const filesNavigation = page.getByRole("complementary", {
    name: "Навигация по файлам",
  });
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
  await expect(
    page.getByRole("button", { name: /large-note\.txt/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /pixel\.gif/ })).toHaveCount(0);
});

test("keeps an interrupted TUS upload visible after F5 and resumes the same reservation", async ({
  page,
}, testInfo) => {
  await signIn(page);
  await openFiles(page);

  const filePath = testInfo.outputPath("resume-after-reload.txt");
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, Buffer.alloc(20 * 1024 * 1024, "R"));
  const stableTimestamp = new Date("2026-08-14T12:00:00.000Z");
  utimesSync(filePath, stableTimestamp, stableTimestamp);

  let delayTusPatches = true;
  await page.route("**/storage/v1/upload/resumable**", async (route) => {
    if (delayTusPatches && route.request().method() === "PATCH") {
      await new Promise((resolve) => setTimeout(resolve, 1_200));
    }
    try {
      await route.continue();
    } catch {
      // Reload intentionally abandons the in-flight request.
    }
  });

  const uploadButton = page.getByRole("button", {
    name: "Загрузить файл",
    exact: true,
  });
  const firstPatch = page.waitForRequest(
    (request) =>
      request.url().includes("/storage/v1/upload/resumable") &&
      request.method() === "PATCH",
  );
  const chooserPromise = page.waitForEvent("filechooser");
  await uploadButton.click();
  const chooser = await chooserPromise;
  await chooser.setFiles(filePath);
  await firstPatch;
  await expect(
    page.getByRole("status", { name: "Прогресс загрузки" }),
  ).toBeVisible();

  await page.reload();
  await page.evaluate(() => {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("mozg:project-files:resumable:v1:")) {
        localStorage.removeItem(key);
      }
    }
  });
  await openFiles(page);

  await expect(
    page.getByText("resume-after-reload.txt", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Не завершено", { exact: true })).toBeVisible();
  const continueButton = page.getByRole("button", {
    name: "Продолжить",
    exact: true,
  });
  await expect(continueButton).toBeEnabled();

  const resumeChooserPromise = page.waitForEvent("filechooser");
  await continueButton.click();
  const resumeChooser = await resumeChooserPromise;
  await resumeChooser.setFiles(filePath);

  await expect(
    page.getByText("Продолжение загрузки", { exact: true }),
  ).toBeVisible({
    timeout: 10_000,
  });
  delayTusPatches = false;
  await expect(
    page.getByText("Загружен: resume-after-reload.txt", { exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Не завершено", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /resume-after-reload\.txt/ }),
  ).toHaveCount(1);
});

test("renames, moves, drags, trashes and restores files and reorganizes folders", async ({
  page,
}) => {
  await signIn(page);
  await openFiles(page);

  const filesNavigation = page.getByRole("complementary", {
    name: "Навигация по файлам",
  });
  const inboxButton = filesNavigation.getByRole("button", {
    name: "Входящие",
    exact: true,
  });
  const uploadButton = page.getByRole("button", {
    name: "Загрузить файл",
    exact: true,
  });

  await createFolder(page, "A4 Parent");
  await inboxButton.click();
  await createFolder(page, "A4 Target");
  await inboxButton.click();
  await createFolder(page, "A4 Source");

  const lifecycleChooserPromise = page.waitForEvent("filechooser");
  await uploadButton.click();
  const lifecycleChooser = await lifecycleChooserPromise;
  await lifecycleChooser.setFiles({
    name: "lifecycle.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Files lifecycle contract."),
  });
  await expect(
    page.getByText("Загружен: lifecycle.txt", { exact: true }),
  ).toBeVisible();

  let lifecycleRow = page.getByRole("button", { name: /lifecycle\.txt/ });
  await lifecycleRow.click();

  const preview = page.getByRole("complementary", {
    name: "Предпросмотр файла",
  });
  await preview
    .getByRole("button", { name: "Переименовать", exact: true })
    .click();
  const fileNameInput = preview.getByRole("textbox", {
    name: "Новое имя файла",
  });
  await fileNameInput.fill("renamed-lifecycle.txt");
  await preview.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByText("Переименован: renamed-lifecycle.txt", { exact: true }),
  ).toBeVisible();
  lifecycleRow = page.getByRole("button", { name: /renamed-lifecycle\.txt/ });
  await expect(lifecycleRow).toBeVisible();

  const fileMoveSelect = preview.getByLabel("Куда переместить файл");
  await fileMoveSelect.selectOption({ label: "A4 Target" });
  await preview
    .getByRole("button", { name: "Переместить", exact: true })
    .click();
  await expect(lifecycleRow).toHaveCount(0);

  const targetButton = filesNavigation.getByRole("button", {
    name: "A4 Target",
    exact: true,
  });
  await targetButton.click();
  lifecycleRow = page.getByRole("button", { name: /renamed-lifecycle\.txt/ });
  await expect(lifecycleRow).toBeVisible();
  await lifecycleRow.click();

  await preview.getByRole("button", { name: "В корзину", exact: true }).click();
  await expect(
    preview.getByText("Переместить файл в корзину?", { exact: true }),
  ).toBeVisible();
  await preview.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(
    preview.getByText("Переместить файл в корзину?", { exact: true }),
  ).toHaveCount(0);
  await preview.getByRole("button", { name: "В корзину", exact: true }).click();
  await preview
    .getByRole("button", { name: "Да, в корзину", exact: true })
    .click();
  await expect(
    page.getByText("Перемещён в корзину: renamed-lifecycle.txt", {
      exact: true,
    }),
  ).toBeVisible();

  const trashButton = filesNavigation.getByRole("button", {
    name: "Корзина",
    exact: true,
  });
  await trashButton.click();
  lifecycleRow = page.getByRole("button", { name: /renamed-lifecycle\.txt/ });
  await expect(lifecycleRow).toBeVisible();
  await lifecycleRow.click();
  await preview
    .getByRole("button", { name: "Восстановить", exact: true })
    .click();
  await expect(
    page.getByText("Восстановлен: renamed-lifecycle.txt", { exact: true }),
  ).toBeVisible();
  await expect(lifecycleRow).toHaveCount(0);

  await targetButton.click();
  lifecycleRow = page.getByRole("button", { name: /renamed-lifecycle\.txt/ });
  await expect(lifecycleRow).toBeVisible();
  await lifecycleRow.click();
  await preview.getByLabel("Куда переместить файл").selectOption("");
  await preview
    .getByRole("button", { name: "Переместить", exact: true })
    .click();

  await inboxButton.click();
  lifecycleRow = page.getByRole("button", { name: /renamed-lifecycle\.txt/ });
  await expect(lifecycleRow).toBeVisible();
  await lifecycleRow.dragTo(targetButton);
  await expect(
    page.getByText("Перемещён «renamed-lifecycle.txt» → A4 Target", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(lifecycleRow).toHaveCount(0);

  await targetButton.click();
  lifecycleRow = page.getByRole("button", { name: /renamed-lifecycle\.txt/ });
  await expect(lifecycleRow).toBeVisible();

  await page
    .getByRole("button", { name: "Переименовать папку", exact: true })
    .click();
  const folderRenameInput = page.getByRole("textbox", {
    name: "Новое название папки",
  });
  await folderRenameInput.fill("A4 Target Renamed");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    filesNavigation.getByRole("button", {
      name: "A4 Target Renamed",
      exact: true,
    }),
  ).toBeVisible();

  await page
    .getByLabel("Куда переместить папку")
    .selectOption({ label: "A4 Parent" });
  await page.getByRole("button", { name: "Переместить", exact: true }).click();

  const breadcrumbs = page.getByRole("navigation", { name: "Путь к папке" });
  await expect(
    breadcrumbs.getByText("A4 Parent", { exact: true }),
  ).toBeVisible();
  await expect(
    breadcrumbs.getByRole("button", {
      name: "A4 Target Renamed",
      exact: true,
    }),
  ).toBeVisible();
});
