import { mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "./test-user";

const PREVIEW_IMAGE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAyAAAAJYCAIAAAAVFBUnAAAIzUlEQVR42u3WMREAAAjEMMC/2JeACY4pkdCpnaQAALgzEgAAGCwAAIMFAGCwAAAwWAAABgsAwGABAGCwAAAMFgCAwQIAwGABABgsAACDBQBgsAAAMFgAAAYLAMBgAQBgsAAADBYAgMECAMBgAQAYLAAAgwUAgMECADBYAAAGCwDAYAEAYLAAAAwWAIDBAgDAYAEAGCwAAIMFAIDBAgAwWAAABgsAAIMFAGCwAAAMFgCAwQIAwGABABgsAACDBQCAwQIAMFgAAAYLAACDBQBgsAAADBYAAAYLAMBgAQAYLAAAgwUAgMECADBYAAAGCwAAgwUAYLAAAAwWAAAGCwDAYAEAGCwAAIMFAIDBAgAwWAAABgsAAIMFAGCwAAAMFgAABgsAwGABABgsAAAMFgCAwQIAMFgAAAYLAACDBQBgsAAADBYAAAYLAMBgAQAYLAAADBYAgMECADBYAAAYLAAAgwUAYLAAAAwWAAAGCwDAYAEAGCwAAAwWAIDBAgAwWAAAGCwAAIMFAGCwAAAwWAAABgsAwGABABgsAAAMFgCAwQIAMFgAABgsAACDBQBgsAAAMFgAAAYLAMBgAQAYLAAADBYAgMECADBYAAAYLAAAgwUAYLAAADBYAAAGCwDAYAEAYLAAAAwWAIDBAgAwWAAAGCwAAIMFAGCwAAAwWAAABgsAwGABAGCwAAAMFgCAwQIAwGABABgsAACDBQBgsAAAMFgAAAYLAMBgAQBgsAAADBYAgMECAMBgAQAYLAAAgwUAgMECADBYAAAGCwDAYAEAYLAAAAwWAIDBAgDAYAEAGCwAAIMFAIDBAgAwWAAABgsAwGABAGCwAAAMFgCAwQIAwGABABgsAACDBQBgsAAAMFgAAAYLAMBgAQBgsAAADBYAgMECAMBgAQAYLAAAgwUAgMECADBYAAAGCwAAgwUAYLAAAAwWAAAGCwDAYAEAGCwAAIMFAIDBAgAwWAAABgsAAIMFAGCwAAAMFgAABgsAwGABABgsAAAMFgCAwQIAMFgAAAYLAACDBQBgsAAADBYAAAYLAMBgAQAYLAAADBYAgMECADBYAAAGCwAAgwUAYLAAAAwWAAAGCwDAYAEAGCwAAAwWAIDBAgAwWAAAGCwAAIMFAGCwAAAMFgAABgsAwGABABgsAAAMFgCAwQIAMFgAABgsAACDBQBgsAAAMFgAAAYLAMBgAQAYLAAADBYAgMECADBYAAAYLAAAgwUAYLAAADBYAAAGCwDAYAEAYLAAAAwWAIDBAgAwWAAAGCwAAIMFAGCwAAAwWAAABgsAwGABAGCwAAAMFgCAwQIAwGABABgsAACDBQCAwQIAMFgAAAYLAMBgAQBgsAAADBYAgMECAMBgAQAYLAAAgwUAgMECADBYAAAGCwDAYAEAYLAAAAwWAIDBAgDAYAEAGCwAAIMFAIDBAgAwWAAABgsAAIMFAGCwAAAMFgCAwQIAwGABABgsAACDBQCAwQIAMFgAAAYLAACDBQBgsAAADBYAAAYLAMBgAQAYLAAAgwUAgMECADBYAAAGCwAAgwUAYLAAAAwWAAAGCwDAYAEAGCwAAAwWAIDBAgAwWAAABgsAAIMFAGCwAAAMFgAABgsAwGABABgsAAAMFgCAwQIAMFgAAAYLAACDBQBgsAAADBYAAAYLAMBgAQAYLAAADBYAgMECADBYAAAYLAAAgwUAYLAAAAwWAAAGCwDAYAEAGCwAAAwWAIDBAgAwWAAAGCwAAIMFAGCwAAAwWAAABgsAwGABABgsAAAMFgCAwQIAMFgAABgsAACDBQBgsAAAMFgAAAYLAMBgAQBgsAAADBYAgMECADBYAAAYLAAAgwUAYLAAADBYAAAGCwDAYAEAYLAAAAwWAIDBAgAwWBIAABgsAACDBQBgsAAAMFgAAAYLAMBgAQBgsAAADBYAgMECAMBgAQAYLAAAgwUAYLAAADBYAAAGCwDAYAEAYLAAAAwWAIDBAgDAYAEAGCwAAIMFAIDBAgAwWAAABgsAwGABAGCwAAAMFgCAwQIAwGABABgsAACDBQCAwQIAMFgAAAYLAACDBQBgsAAADBYAgMECAMBgAQAYLAAAgwUAgMECADBYAAAGCwAAgwUAYLAAAAwWAAAGCwDAYAEAGCwAAIMFAIDBAgAwWAAABgsAAIMFAGCwAAAMFgAABgsAwGABABgsAACDBQCAwQIAMFgAAAYLAACDBQBgsAAADBYAAAYLAMBgAQAYLAAADBYAgMECADBYAAAGCwAAgwUAYLAAAAwWAAAGCwDAYAEAGCwAAAwWAMCfBZlEB4Aye4RvAAAAAElFTkSuQmCC",
  "base64",
);

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

test("collapses all file folders and expands individual branches", async ({
  page,
}, testInfo) => {
  const suffix = `${process.env.GITHUB_RUN_ID ?? Date.now()}-${testInfo.retry}`;
  const parentName = `Tree Parent ${suffix}`;
  const childName = `Tree Child ${suffix}`;
  const grandchildName = `Tree Grandchild ${suffix}`;
  await signIn(page);
  await openFiles(page);

  await createFolder(page, parentName);
  await createFolder(page, childName);
  await createFolder(page, grandchildName);

  const navigation = page.getByRole("complementary", {
    name: "Навигация по файлам",
  });
  const parent = navigation.getByRole("button", {
    name: parentName,
    exact: true,
  });
  const child = navigation.getByRole("button", {
    name: childName,
    exact: true,
  });
  const grandchild = navigation.getByRole("button", {
    name: grandchildName,
    exact: true,
  });
  const collapseAll = navigation.getByRole("button", {
    name: "Свернуть все папки",
  });
  await expect(grandchild).toBeVisible();
  await collapseAll.click();
  await expect(child).toHaveCount(0);

  const expandParent = navigation.getByRole("button", {
    name: `Развернуть папку ${parentName}`,
  });
  await expect(expandParent).toHaveAttribute("aria-expanded", "false");
  await expandParent.click();
  await expect(child).toBeVisible();
  await expect(grandchild).toHaveCount(0);

  await navigation
    .getByRole("button", { name: `Развернуть папку ${childName}` })
    .click();
  await expect(grandchild).toBeVisible();
  await navigation
    .getByRole("button", { name: `Свернуть папку ${parentName}` })
    .click();
  await expect(child).toHaveCount(0);
  await expandParent.click();
  await expect(grandchild).toBeVisible();

  await parent.click();
  await expect(parent).toHaveAttribute("aria-current", "page");
  await expect(child).toBeVisible();
  await expect(collapseAll).toBeVisible();

  await page.reload();
  await openFiles(page);
  await expect(parent).toBeVisible();
  await expect(child).toHaveCount(0);
  await navigation.getByRole("button", { name: "Восстановить папки" }).click();
  await expect(grandchild).toBeVisible();
});

test("highlights a file folder and moves multiple selected files in one drag", async ({
  page,
}, testInfo) => {
  const suffix = `${process.env.GITHUB_RUN_ID ?? Date.now()}-${testInfo.retry}`;
  const targetName = `Batch Target ${suffix}`;
  const names = [`batch-one-${suffix}.txt`, `batch-two-${suffix}.txt`];
  await signIn(page);
  await openFiles(page);
  await createFolder(page, targetName);

  const navigation = page.getByRole("complementary", {
    name: "Навигация по файлам",
  });
  const target = navigation.getByRole("button", {
    name: targetName,
    exact: true,
  });
  await navigation.getByRole("button", { name: "Входящие" }).click();

  const upload = page.getByRole("button", {
    name: "Загрузить файл",
    exact: true,
  });
  const chooserPromise = page.waitForEvent("filechooser");
  await upload.click();
  const chooser = await chooserPromise;
  await chooser.setFiles(
    names.map((name) => ({
      name,
      mimeType: "text/plain",
      buffer: Buffer.from(name),
    })),
  );

  const rows = names.map((name) =>
    page.getByRole("button", { name: new RegExp(name) }),
  );
  for (const row of rows) await expect(row).toBeVisible();
  await page.getByRole("button", { name: "Выбрать несколько" }).click();
  for (const row of rows) {
    await row.click();
    await expect(row).toHaveAttribute("aria-pressed", "true");
  }
  await expect(page.getByText("Выбрано: 2")).toBeVisible();
  await page.getByRole("button", { name: "Список", exact: true }).click();
  await expect(rows[0]).toHaveAttribute("aria-pressed", "true");

  const sourceBox = await rows[0].boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Missing drag target");
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 15 },
  );
  await expect(target.locator("..")).toHaveClass(/folderRowDropTarget/);
  await page.mouse.up();
  for (const row of rows) await expect(row).toHaveCount(0);

  await target.click();
  for (const row of rows) await expect(row).toBeVisible();
});

test("drags a nested folder into another folder and back to the top level", async ({
  page,
}, testInfo) => {
  const suffix = `${process.env.GITHUB_RUN_ID ?? Date.now()}-${testInfo.retry}`;
  const sourceName = `Drag Source ${suffix}`;
  const childName = `Drag Child ${suffix}`;
  const targetName = `Drag Target ${suffix}`;
  await signIn(page);
  await openFiles(page);
  await createFolder(page, sourceName);
  await createFolder(page, childName);

  const navigation = page.getByRole("complementary", {
    name: "Навигация по файлам",
  });
  await navigation.getByRole("button", { name: "Входящие" }).click();
  await createFolder(page, targetName);
  const child = navigation.getByRole("button", {
    name: childName,
    exact: true,
  });
  const target = navigation.getByRole("button", {
    name: targetName,
    exact: true,
  });
  await expect(child).toBeVisible();

  const dragTo = async (source: typeof child, destination: typeof target) => {
    const from = await source.boundingBox();
    const to = await destination.boundingBox();
    if (!from || !to) throw new Error("Missing folder drag target");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
      steps: 15,
    });
  };

  await dragTo(child, target);
  await expect(target.locator("..")).toHaveClass(/folderRowDropTarget/);
  await page.mouse.up();
  await expect(child.locator("..")).toHaveCSS("padding-left", "22px");
  await navigation
    .getByRole("button", { name: `Свернуть папку ${targetName}` })
    .click();
  await expect(child).toHaveCount(0);
  await navigation
    .getByRole("button", { name: `Развернуть папку ${targetName}` })
    .click();

  const childBox = await child.boundingBox();
  if (!childBox) throw new Error("Missing nested folder");
  await page.mouse.move(
    childBox.x + childBox.width / 2,
    childBox.y + childBox.height / 2,
  );
  await page.mouse.down();
  const root = navigation.getByText("Переместить папку на верхний уровень");
  await expect(root).toBeVisible();
  const rootBox = await root.boundingBox();
  if (!rootBox) throw new Error("Missing root folder target");
  await page.mouse.move(
    rootBox.x + rootBox.width / 2,
    rootBox.y + rootBox.height / 2,
    { steps: 15 },
  );
  await expect(root).toHaveClass(/folderRowDropTarget/);
  await page.mouse.up();
  await expect(child.locator("..")).toHaveCSS("padding-left", "8px");
});

test("uploads to Inbox, routes a file above 6 MiB through TUS, creates a folder, previews and downloads an original", async ({
  page,
}, testInfo) => {
  const suffix = `${process.env.GITHUB_RUN_ID ?? Date.now()}-${testInfo.retry}`;
  const inboxFileName = `inbox-note-${suffix}.txt`;
  const largeFileName = `large-note-${suffix}.txt`;
  const folderName = `E2E Assets ${suffix}`;
  const previewFileName = `preview-image-${suffix}.png`;
  let sawResumableUpload = false;
  let sawImageVariantDownload = false;
  let originalImageDownloadRequests = 0;
  page.on("request", (request) => {
    const url = decodeURIComponent(request.url());
    if (url.includes("/storage/v1/upload/resumable")) {
      sawResumableUpload = true;
    }
    if (request.method() === "GET" && url.includes("/variants/edge-")) {
      sawImageVariantDownload = true;
    }
    if (request.method() === "GET" && url.includes("/original")) {
      originalImageDownloadRequests += 1;
    }
  });

  await signIn(page);
  await openFiles(page);

  await expect(
    page.getByRole("button", { name: "Превью", exact: true }),
  ).toHaveClass(/is-active/);

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
    name: inboxFileName,
    mimeType: "text/plain",
    buffer: Buffer.from("Inbox upload contract."),
  });

  await expect(
    page.getByRole("button", { name: new RegExp(inboxFileName) }),
  ).toBeVisible();
  expect(sawResumableUpload).toBe(false);

  const largeFileChooserPromise = page.waitForEvent("filechooser");
  await uploadButton.click();
  const largeFileChooser = await largeFileChooserPromise;
  await largeFileChooser.setFiles({
    name: largeFileName,
    mimeType: "text/plain",
    buffer: Buffer.alloc(7 * 1024 * 1024, "L"),
  });

  await expect(
    page.getByRole("button", { name: new RegExp(largeFileName) }),
  ).toBeVisible({ timeout: 30_000 });
  expect(sawResumableUpload).toBe(true);

  await createFolder(page, folderName);

  const filesNavigation = page.getByRole("complementary", {
    name: "Навигация по файлам",
  });
  await expect(page.getByText("Папка пуста", { exact: true })).toBeVisible();
  await expect(uploadButton).toBeEnabled();

  const folderFileChooserPromise = page.waitForEvent("filechooser");
  await uploadButton.click();
  const folderFileChooser = await folderFileChooserPromise;
  await folderFileChooser.setFiles({
    name: previewFileName,
    mimeType: "image/png",
    buffer: PREVIEW_IMAGE_PNG,
  });

  const imageRow = page.getByRole("button", {
    name: new RegExp(previewFileName),
  });
  await expect(imageRow).toBeVisible();
  await imageRow.click();

  const preview = page.getByRole("complementary", {
    name: "Предпросмотр файла",
  });
  const previewImage = preview.getByRole("img", { name: previewFileName });
  await expect(previewImage).toBeVisible();
  await expect(previewImage).toHaveAttribute("src", /^blob:/);
  await expect
    .poll(() => sawImageVariantDownload, {
      message: "Files preview must GET a /variants/edge-* derivative",
      timeout: 10_000,
    })
    .toBe(true);
  expect(originalImageDownloadRequests).toBe(0);

  await page
    .getByRole("button", { name: "Крупные превью", exact: true })
    .click();
  const imageTile = page.getByRole("button", {
    name: new RegExp(previewFileName),
  });
  await expect(imageTile).toBeVisible();
  await imageTile.dblclick();

  const imageViewer = page.getByRole("dialog", { name: previewFileName });
  await expect(imageViewer).toBeVisible();
  await expect(
    imageViewer.getByRole("img", { name: previewFileName }),
  ).toBeVisible();
  await expect
    .poll(() => originalImageDownloadRequests, {
      message: "Viewer must GET the original rather than a preview derivative",
      timeout: 10_000,
    })
    .toBeGreaterThan(0);
  await imageViewer
    .getByRole("button", { name: "Закрыть просмотр", exact: true })
    .click();
  await expect(imageViewer).toHaveCount(0);

  const originalImageDownloadsBeforeExplicitDownload =
    originalImageDownloadRequests;

  const downloadButton = preview.getByRole("button", {
    name: "Скачать оригинал",
    exact: true,
  });
  await expect(downloadButton).toBeEnabled();

  const downloadPromise = page.waitForEvent("download");
  await downloadButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(previewFileName);
  await expect
    .poll(() => originalImageDownloadRequests, {
      message: "Explicit download must GET the immutable original",
      timeout: 10_000,
    })
    .toBeGreaterThan(originalImageDownloadsBeforeExplicitDownload);

  await filesNavigation
    .getByRole("button", { name: "Входящие", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: new RegExp(inboxFileName) }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: new RegExp(largeFileName) }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: new RegExp(previewFileName) }),
  ).toHaveCount(0);
});

test("restores the current Files folder and warm image tiles after section navigation", async ({
  page,
}, testInfo) => {
  const suffix = `${process.env.GITHUB_RUN_ID ?? Date.now()}-${testInfo.retry}`;
  const folderName = `Warm Files ${suffix}`;
  const fileName = `warm-preview-${suffix}.png`;
  let variantRequestsAfterReturn = 0;

  await signIn(page);
  await openFiles(page);
  await createFolder(page, folderName);
  await page.getByRole("button", { name: "Превью", exact: true }).click();

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Загрузить файл", exact: true })
    .click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: fileName,
    mimeType: "image/png",
    buffer: PREVIEW_IMAGE_PNG,
  });

  const tile = page.getByRole("button", { name: new RegExp(fileName) });
  const tileImage = tile.locator("img");
  await expect(tileImage).toHaveAttribute("src", /^blob:/);
  const warmSrc = await tileImage.getAttribute("src");

  const applicationNavigation = page.getByRole("navigation", {
    name: "Разделы приложения",
  });
  await applicationNavigation
    .getByRole("button", { name: "Холсты", exact: true })
    .click();
  await applicationNavigation
    .getByRole("button", { name: "Файлы", exact: true })
    .click();

  page.on("request", (request) => {
    if (
      request.method() === "GET" &&
      decodeURIComponent(request.url()).includes("/variants/edge-")
    ) {
      variantRequestsAfterReturn += 1;
    }
  });

  const filesNavigation = page.getByRole("complementary", {
    name: "Навигация по файлам",
  });
  await expect(
    filesNavigation.getByRole("button", { name: folderName, exact: true }),
  ).toHaveAttribute("aria-current", "page");
  const returnedImage = page
    .getByRole("button", { name: new RegExp(fileName) })
    .locator("img");
  await expect(returnedImage).toHaveAttribute("src", warmSrc ?? "");
  await page.waitForTimeout(1_200);
  await expect(returnedImage).toHaveAttribute("src", warmSrc ?? "");
  expect(variantRequestsAfterReturn).toBe(0);
});

test("opens a PDF in the file viewer on double click", async ({ page }) => {
  await signIn(page);
  await openFiles(page);

  const uploadButton = page.getByRole("button", {
    name: "Загрузить файл",
    exact: true,
  });
  const fileChooserPromise = page.waitForEvent("filechooser");
  await uploadButton.click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "viewer-contract.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(
      "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF",
    ),
  });

  await expect(
    page.getByText("Загружен: viewer-contract.pdf", { exact: true }),
  ).toBeVisible();
  const pdfRow = page.getByRole("button", { name: /viewer-contract\.pdf/ });
  await pdfRow.dblclick();

  const pdfViewer = page.getByRole("dialog", {
    name: "viewer-contract.pdf",
  });
  await expect(pdfViewer).toBeVisible();
  await expect(pdfViewer.locator("iframe")).toHaveAttribute("src", /^blob:/);
});

test("keeps an interrupted TUS upload visible after F5 and resumes the same reservation", async ({
  page,
}, testInfo) => {
  await signIn(page);
  await openFiles(page);

  const fileName = `resume-after-reload-${process.env.GITHUB_RUN_ID ?? Date.now()}-${testInfo.retry}.txt`;
  const filePath = testInfo.outputPath(fileName);
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

  const pendingFile = page.locator(`[data-pending-file-name="${fileName}"]`);
  await expect(pendingFile).toBeVisible();
  await expect(pendingFile).toContainText("Не завершено");
  const continueButton = pendingFile.getByRole("button", {
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
  await expect(pendingFile).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: new RegExp(fileName) }),
  ).toHaveCount(1);
});

test("renames, moves, drags, trashes and restores files and reorganizes folders", async ({
  page,
}, testInfo) => {
  const suffix = `${process.env.GITHUB_RUN_ID ?? Date.now()}-${testInfo.retry}`;
  const parentFolderName = `A4 Parent ${suffix}`;
  const targetFolderName = `A4 Target ${suffix}`;
  const sourceFolderName = `A4 Source ${suffix}`;
  const lifecycleFileName = `lifecycle-${suffix}.txt`;
  const renamedFileName = `renamed-lifecycle-${suffix}.txt`;
  const renamedTargetFolderName = `A4 Target Renamed ${suffix}`;
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

  await createFolder(page, parentFolderName);
  await inboxButton.click();
  await createFolder(page, targetFolderName);
  await inboxButton.click();
  await createFolder(page, sourceFolderName);

  const lifecycleChooserPromise = page.waitForEvent("filechooser");
  await uploadButton.click();
  const lifecycleChooser = await lifecycleChooserPromise;
  await lifecycleChooser.setFiles({
    name: lifecycleFileName,
    mimeType: "text/plain",
    buffer: Buffer.from("Files lifecycle contract."),
  });
  let lifecycleRow = page.getByRole("button", {
    name: new RegExp(lifecycleFileName),
  });
  await expect(lifecycleRow).toBeVisible();
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
  await fileNameInput.fill(renamedFileName);
  await preview.getByRole("button", { name: "Сохранить", exact: true }).click();
  lifecycleRow = page.getByRole("button", {
    name: new RegExp(renamedFileName),
  });
  await expect(lifecycleRow).toBeVisible();

  const fileMoveSelect = preview.getByLabel("Куда переместить файл");
  await fileMoveSelect.selectOption({ label: targetFolderName });
  await preview
    .getByRole("button", { name: "Переместить", exact: true })
    .click();
  await expect(lifecycleRow).toHaveCount(0);

  const targetButton = filesNavigation.getByRole("button", {
    name: targetFolderName,
    exact: true,
  });
  await targetButton.click();
  lifecycleRow = page.getByRole("button", {
    name: new RegExp(renamedFileName),
  });
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
  const trashButton = filesNavigation.getByRole("button", {
    name: "Корзина",
    exact: true,
  });
  await trashButton.click();
  lifecycleRow = page.getByRole("button", {
    name: new RegExp(renamedFileName),
  });
  await expect(lifecycleRow).toBeVisible();
  await lifecycleRow.click();
  await preview
    .getByRole("button", { name: "Восстановить", exact: true })
    .click();
  await expect(lifecycleRow).toHaveCount(0);

  await targetButton.click();
  lifecycleRow = page.getByRole("button", {
    name: new RegExp(renamedFileName),
  });
  await expect(lifecycleRow).toBeVisible();
  await lifecycleRow.click();
  await preview.getByLabel("Куда переместить файл").selectOption("");
  await preview
    .getByRole("button", { name: "Переместить", exact: true })
    .click();

  await inboxButton.click();
  lifecycleRow = page.getByRole("button", {
    name: new RegExp(renamedFileName),
  });
  await expect(lifecycleRow).toBeVisible();
  await lifecycleRow.dragTo(targetButton);
  await expect(lifecycleRow).toHaveCount(0);

  await targetButton.click();
  lifecycleRow = page.getByRole("button", {
    name: new RegExp(renamedFileName),
  });
  await expect(lifecycleRow).toBeVisible();

  await page
    .getByRole("button", { name: "Переименовать папку", exact: true })
    .click();
  const folderRenameInput = page.getByRole("textbox", {
    name: "Новое название папки",
  });
  await folderRenameInput.fill(renamedTargetFolderName);
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    filesNavigation.getByRole("button", {
      name: renamedTargetFolderName,
      exact: true,
    }),
  ).toBeVisible();

  await page
    .getByLabel("Куда переместить папку")
    .selectOption({ label: parentFolderName });
  await page.getByRole("button", { name: "Переместить", exact: true }).click();

  const breadcrumbs = page.getByRole("navigation", { name: "Путь к папке" });
  await expect(
    breadcrumbs.getByText(parentFolderName, { exact: true }),
  ).toBeVisible();
  await expect(
    breadcrumbs.getByRole("button", {
      name: renamedTargetFolderName,
      exact: true,
    }),
  ).toBeVisible();
});
