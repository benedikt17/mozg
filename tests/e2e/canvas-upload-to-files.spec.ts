import { deflateSync } from "node:zlib";

import { expect, test, type Page, type Request } from "@playwright/test";

import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "./test-user";

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function solidPng(width: number, height: number): Buffer {
  const signature = Buffer.from("89504e470d0a1a0a", "hex");
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const row = Buffer.alloc(1 + width * 4);
  row[0] = 0;
  for (let offset = 1; offset < row.length; offset += 4) {
    row[offset] = 74;
    row[offset + 1] = 142;
    row[offset + 2] = 198;
    row[offset + 3] = 255;
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

async function signIn(page: Page): Promise<void> {
  await page.goto("/prototype/desktop");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fprototype%2Fdesktop$/);
  await page.getByLabel("Email").fill(E2E_USER_EMAIL);
  await page.getByLabel("Пароль").fill(E2E_USER_PASSWORD);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/\/prototype\/desktop$/);
}

function appNavigation(page: Page) {
  return page.getByRole("navigation", { name: "Разделы приложения" });
}

function requestJson(request: Request): Record<string, unknown> {
  try {
    return request.postDataJSON() as Record<string, unknown>;
  } catch {
    return {};
  }
}

test("routes direct Canvas image upload through Project Files and persists fileId", async ({
  page,
}, testInfo) => {
  const suffix = `${process.env.GITHUB_RUN_ID ?? Date.now()}-${testInfo.retry}`;
  const fileName = `b4-canvas-upload-${suffix}.png`;
  const canvasTitle = `B4 Canvas Upload ${suffix}`;
  const savedDocuments: Array<{ nodes?: Array<Record<string, unknown>> }> = [];
  let projectFileId: string | null = null;
  let canvasAssetWriteCount = 0;
  let projectFileOriginalWriteCount = 0;
  let projectFileVariantGetCount = 0;

  page.on("request", (request) => {
    const url = decodeURIComponent(request.url());
    if (
      ["POST", "PUT", "PATCH"].includes(request.method()) &&
      url.includes("canvas-assets")
    ) {
      canvasAssetWriteCount += 1;
    }
    if (
      ["POST", "PUT", "PATCH"].includes(request.method()) &&
      url.includes("project-files") &&
      url.includes("/original")
    ) {
      projectFileOriginalWriteCount += 1;
    }
    if (
      request.method() === "GET" &&
      url.includes("project-files") &&
      url.includes("/variants/edge-")
    ) {
      projectFileVariantGetCount += 1;
    }
    if (url.includes("/rest/v1/rpc/save_canvas_document")) {
      const body = requestJson(request);
      const document = body.target_document as
        { nodes?: Array<Record<string, unknown>> } | undefined;
      if (document) savedDocuments.push(document);
    }
  });

  await signIn(page);
  await appNavigation(page)
    .getByRole("button", { name: "Холсты", exact: true })
    .click();
  await page.getByRole("button", { name: "Новый холст", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Новый холст", exact: true })
    .fill(canvasTitle);
  await page.getByRole("button", { name: "Создать", exact: true }).click();

  const reserveRequest = page.waitForRequest((request) => {
    if (!request.url().includes("/rest/v1/rpc/reserve_project_file"))
      return false;
    return requestJson(request).target_name === fileName;
  });
  const chooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Добавить изображение", exact: true })
    .click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: fileName,
    mimeType: "image/png",
    buffer: solidPng(800, 600),
  });

  const reserve = await reserveRequest;
  const reserveBody = requestJson(reserve);
  projectFileId =
    typeof reserveBody.target_file_id === "string"
      ? reserveBody.target_file_id
      : null;
  expect(projectFileId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );

  await expect(page.locator(".react-flow__node img")).toHaveCount(1);
  await expect
    .poll(
      () =>
        savedDocuments.some((document) =>
          document.nodes?.some(
            (node) =>
              node.kind === "image" &&
              node.fileId === projectFileId &&
              !("assetId" in node),
          ),
        ),
      {
        message: "Canvas save must persist the direct upload through fileId",
        timeout: 10_000,
      },
    )
    .toBe(true);
  expect(canvasAssetWriteCount).toBe(0);
  expect(projectFileOriginalWriteCount).toBeGreaterThan(0);

  await appNavigation(page)
    .getByRole("button", { name: "Файлы", exact: true })
    .click();
  await expect(page.getByText(fileName, { exact: true }).first()).toBeVisible();

  const variantGetsBeforeReload = projectFileVariantGetCount;
  await page.reload();
  await appNavigation(page)
    .getByRole("button", { name: "Холсты", exact: true })
    .click();
  await page.getByRole("button", { name: canvasTitle, exact: true }).click();
  await expect(page.locator(".react-flow__node img")).toHaveCount(1);
  await expect
    .poll(() => projectFileVariantGetCount, {
      message:
        "Reloaded Canvas must restore the direct upload through a Project File derivative",
      timeout: 10_000,
    })
    .toBeGreaterThan(variantGetsBeforeReload);
  expect(canvasAssetWriteCount).toBe(0);
});
