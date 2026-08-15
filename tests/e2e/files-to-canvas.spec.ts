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
    row[offset] = 42;
    row[offset + 1] = 118;
    row[offset + 2] = 204;
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

test("adds a Project File image to Canvas by fileId without copying it into canvas-assets", async ({
  page,
}, testInfo) => {
  const suffix = `${process.env.GITHUB_RUN_ID ?? Date.now()}-${testInfo.retry}`;
  const fileName = `b3-files-canvas-${suffix}.png`;
  const canvasTitle = `B3 Files Canvas ${suffix}`;
  let projectFileId: string | null = null;
  let canvasAssetWriteCount = 0;
  let canvasVariantGetCount = 0;

  page.on("request", (request) => {
    const url = decodeURIComponent(request.url());
    if (
      ["POST", "PUT", "PATCH"].includes(request.method()) &&
      url.includes("canvas-assets")
    ) {
      canvasAssetWriteCount += 1;
    }
    if (request.method() === "GET" && url.includes("/variants/edge-")) {
      canvasVariantGetCount += 1;
    }
  });

  await signIn(page);
  await appNavigation(page)
    .getByRole("button", { name: "Файлы", exact: true })
    .click();

  const reserveRequest = page.waitForRequest((request) => {
    if (!request.url().includes("/rest/v1/rpc/reserve_project_file"))
      return false;
    const body = requestJson(request);
    return body.target_name === fileName;
  });
  const chooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Загрузить файл", exact: true })
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
  await expect(
    page.getByText(`Загружен: ${fileName}`, { exact: true }),
  ).toBeVisible();

  await appNavigation(page)
    .getByRole("button", { name: "Холсты", exact: true })
    .click();
  await page.getByRole("button", { name: "Новый холст", exact: true }).click();
  const canvasName = page.getByRole("textbox", {
    name: "Новый холст",
    exact: true,
  });
  await canvasName.fill(canvasTitle);
  await page.getByRole("button", { name: "Создать", exact: true }).click();

  const addFromFiles = page.getByRole("button", {
    name: "Добавить из Files",
    exact: true,
  });
  await expect(addFromFiles).toBeEnabled();

  const savedByFileId = page.waitForRequest((request) => {
    if (!request.url().includes("/rest/v1/rpc/save_canvas_document"))
      return false;
    const body = requestJson(request);
    const document = body.target_document as
      { nodes?: Array<Record<string, unknown>> } | undefined;
    return Boolean(
      document?.nodes?.some(
        (node) => node.kind === "image" && node.fileId === projectFileId,
      ),
    );
  });

  const assetWritesBeforeInsert = canvasAssetWriteCount;
  const variantGetsBeforeInsert = canvasVariantGetCount;
  await addFromFiles.click();
  const picker = page.getByRole("dialog", { name: "Добавить из Files" });
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: new RegExp(fileName) }).click();

  await savedByFileId;
  await expect
    .poll(() => canvasVariantGetCount, {
      message: "Canvas must load the Project File through an edge-* derivative",
      timeout: 10_000,
    })
    .toBeGreaterThan(variantGetsBeforeInsert);
  expect(canvasAssetWriteCount).toBe(assetWritesBeforeInsert);
  await expect(page.locator(".react-flow__node img")).toHaveCount(1);

  const variantGetsBeforeReload = canvasVariantGetCount;
  await page.reload();
  await appNavigation(page)
    .getByRole("button", { name: "Холсты", exact: true })
    .click();
  await page.getByRole("button", { name: canvasTitle, exact: true }).click();
  await expect(addFromFiles).toBeEnabled();
  await expect(page.locator(".react-flow__node img")).toHaveCount(1);
  await expect
    .poll(() => canvasVariantGetCount, {
      message: "Reloaded Canvas must restore the Project File derivative",
      timeout: 10_000,
    })
    .toBeGreaterThan(variantGetsBeforeReload);
  expect(canvasAssetWriteCount).toBe(assetWritesBeforeInsert);
});
