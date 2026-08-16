import { readFile } from "node:fs/promises";
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

test("downloads all Knowledge as a ZIP backup", async ({ page }) => {
  await signIn(page);
  await page.goto("/prototype/desktop?section=knowledge&document=doc-l-routes");

  await expect(
    page
      .getByRole("navigation", { name: "Разделы приложения" })
      .getByRole("button", { name: "Знания", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Скачать резервную копию всех Знаний" })
    .click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(
    /^MOZG-Knowledge-Backup-\d{4}-\d{2}-\d{2}\.zip$/,
  );
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const bytes = await readFile(downloadPath!);
  expect(bytes.readUInt32LE(0)).toBe(0x04034b50);
  expect(bytes.readUInt32LE(bytes.length - 22)).toBe(0x06054b50);
});
