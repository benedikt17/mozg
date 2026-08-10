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
  await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible();
}

test("authenticates and navigates the four primary Desktop sections", async ({
  page,
}) => {
  await signIn(page);

  const navigation = page.getByRole("navigation", {
    name: "Разделы приложения",
  });
  for (const section of ["Обзор", "Знания", "Задачи", "Холсты"] as const) {
    const button = navigation.getByRole("button", { name: section, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("region", { name: "Рабочая область" })).toBeVisible();
  }

  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("persists a Knowledge Markdown edit through cloud snapshot reload", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(
    "/prototype/desktop?section=knowledge&document=doc-l-routes",
  );

  const navigation = page.getByRole("navigation", {
    name: "Разделы приложения",
  });
  await expect(
    navigation.getByRole("button", { name: "Знания", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Редактировать Markdown" }).click();
  const editor = page.getByRole("textbox", { name: /^Markdown:/ });
  const marker = `E2E Browser Persistence ${process.env.GITHUB_RUN_ID ?? "local"}`;
  const markdown = `# ${marker}\n\nCloud snapshot browser contract.\n`;
  await editor.fill(markdown);
  await expect(editor).toHaveValue(markdown);

  const persistenceStatus = page.locator(".desktop-persistence-status");
  await expect(persistenceStatus).toContainText("Сохранено");

  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: marker }),
  ).toBeVisible();
});
