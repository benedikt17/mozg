import { expect, test } from "@playwright/test";

import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "./test-user";

test("moves a Knowledge folder between folders and returns it to the root", async ({
  page,
}, testInfo) => {
  await page.goto("/prototype/desktop");
  await page.getByLabel("Email").fill(E2E_USER_EMAIL);
  await page.getByLabel("Пароль").fill(E2E_USER_PASSWORD);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Разделы приложения" })
    .getByRole("button", { name: "Знания", exact: true })
    .click();

  const tree = page.getByRole("navigation", { name: "Иерархия документов" });
  const world = tree.getByRole("button", { name: "Мир", exact: true });
  await world.click();
  const name = `Папка DnD ${process.env.GITHUB_RUN_ID ?? Date.now()}-${testInfo.retry}`;
  await page
    .getByRole("button", { name: "Создать папку", exact: true })
    .click();
  const editor = page.getByRole("textbox", { name: "Название папки" });
  await editor.fill(name);
  await editor.press("Enter");

  if ((await world.getAttribute("aria-expanded")) === "false")
    await world.click();
  const folder = tree.getByRole("button", { name, exact: true });
  const target = tree.getByRole("button", { name: "Персонажи", exact: true });
  await expect(folder).toBeVisible();
  const sourceBox = await folder.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox)
    throw new Error("Missing Knowledge folder drag target");
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
  await expect(target).toHaveClass(/is-drop-target/);
  await page.mouse.up();
  await expect(
    tree.locator(`.knowledge-folder-row[title="Персонажи / ${name}"]`),
  ).toBeVisible();

  const movedBox = await folder.boundingBox();
  if (!movedBox) throw new Error("Missing moved Knowledge folder");
  await page.mouse.move(
    movedBox.x + movedBox.width / 2,
    movedBox.y + movedBox.height / 2,
  );
  await page.mouse.down();
  const root = tree.getByText("Переместить папку на верхний уровень");
  await expect(root).toBeVisible();
  const rootBox = await root.boundingBox();
  if (!rootBox) throw new Error("Missing Knowledge root target");
  await page.mouse.move(
    rootBox.x + rootBox.width / 2,
    rootBox.y + rootBox.height / 2,
    { steps: 15 },
  );
  await expect(root).toHaveClass(/is-drop-target/);
  await page.mouse.up();
  await expect(
    tree.locator(`.knowledge-folder-row[title="${name}"]`),
  ).toBeVisible();
});
