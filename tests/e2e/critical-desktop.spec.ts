import { expect, test, type Page } from "@playwright/test";
import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "./test-user";

const LOCAL_ONLY_PROTOTYPE_PATHS = [
  "/prototype/canvas-image-ingestion-lab",
  "/prototype/canvas-react-flow-ingestion-spike",
  "/prototype/infinite-canvas-local-shell",
] as const;

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

test("blocks local-only prototype labs in cloud runtime", async ({
  request,
}) => {
  for (const pathname of LOCAL_ONLY_PROTOTYPE_PATHS) {
    const response = await request.get(pathname, { maxRedirects: 0 });
    expect(response.status(), pathname).toBe(404);
  }
});

test("authenticates and navigates the five primary Desktop sections", async ({
  page,
}) => {
  await signIn(page);

  const navigation = page.getByRole("navigation", {
    name: "Разделы приложения",
  });
  for (const section of [
    "Обзор",
    "Знания",
    "Задачи",
    "Холсты",
    "Файлы",
  ] as const) {
    const button = navigation.getByRole("button", {
      name: section,
      exact: true,
    });
    await button.click();
    await expect(button).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("region", { name: "Рабочая область" }),
    ).toBeVisible();
  }

  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("keeps the Desktop header controls aligned across primary sections", async ({
  page,
}) => {
  await signIn(page);

  const navigation = page.getByRole("navigation", {
    name: "Разделы приложения",
  });
  const header = page.locator(".application-header");
  const projectTitle = page.locator(".application-project-title strong");
  const headerActions = page.locator(".application-header-right");

  for (const section of [
    "Обзор",
    "Знания",
    "Задачи",
    "Холсты",
    "Файлы",
  ] as const) {
    await navigation
      .getByRole("button", { name: section, exact: true })
      .click();

    const activeNavigationItem = navigation.locator('[aria-current="page"]');
    const firstHeaderAction = headerActions.getByRole("button").first();
    const [headerBox, titleBox, navigationBox, actionsBox] = await Promise.all([
      header.boundingBox(),
      projectTitle.boundingBox(),
      activeNavigationItem.boundingBox(),
      firstHeaderAction.boundingBox(),
    ]);
    expect(headerBox, `${section}: header`).not.toBeNull();
    expect(titleBox, `${section}: project title`).not.toBeNull();
    expect(navigationBox, `${section}: navigation`).not.toBeNull();
    expect(actionsBox, `${section}: actions`).not.toBeNull();
    if (!headerBox || !titleBox || !navigationBox || !actionsBox) continue;

    const headerCenter = headerBox.y + headerBox.height / 2;
    const navigationCenter = navigationBox.y + navigationBox.height / 2;
    expect(
      Math.abs(navigationCenter - headerCenter),
      `${section}: navigation center`,
    ).toBeLessThanOrEqual(1);
    for (const [region, box] of [
      ["project title", titleBox],
      ["actions", actionsBox],
    ] as const) {
      const center = box.y + box.height / 2;
      expect(
        Math.abs(center - navigationCenter),
        `${section}: ${region} center`,
      ).toBeLessThanOrEqual(1);
    }
  }
});

test("opens Project Files inside the normal Desktop shell", async ({
  page,
}) => {
  await signIn(page);

  const navigation = page.getByRole("navigation", {
    name: "Разделы приложения",
  });
  const filesButton = navigation.getByRole("button", {
    name: "Файлы",
    exact: true,
  });
  await filesButton.click();

  await expect(filesButton).toHaveAttribute("aria-current", "page");
  await expect(
    page.locator(".section-workspace.section-files .main-workspace"),
  ).toHaveCSS("padding", "0px");
  const filesNavigation = page.getByRole("complementary", {
    name: "Навигация по файлам",
  });
  await expect(filesNavigation).toBeVisible();
  await expect(
    filesNavigation.getByRole("button", { name: "Входящие", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Входящие" })).toBeVisible();
  const filePreview = page.getByRole("complementary", {
    name: "Предпросмотр файла",
  });
  await expect(filePreview).toBeVisible();
  await expect(
    filePreview.getByText("Выберите файл", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Preview · Файлы", { exact: true })).toHaveCount(
    0,
  );
});

test("redirects the retired Files harness route into the Desktop section", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/prototype/desktop/files");

  await expect(page).toHaveURL(/\/prototype\/desktop\?section=files$/);
  await expect(
    page
      .getByRole("navigation", { name: "Разделы приложения" })
      .getByRole("button", { name: "Файлы", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("persists a Knowledge Markdown edit through cloud snapshot reload", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/prototype/desktop?section=knowledge&document=doc-l-routes");

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
  const persistenceStatus = page.locator(".desktop-persistence-status");
  await expect(persistenceStatus).toContainText("Сохранено");

  const saveResponse = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === "POST" &&
      response.url().includes("/rest/v1/rpc/save_workspace_snapshot") &&
      (request.postData()?.includes(marker) ?? false) &&
      response.status() === 200
    );
  });

  await editor.fill(markdown);
  await expect(editor).toHaveValue(markdown);
  await saveResponse;
  await expect(persistenceStatus).toContainText("Сохранено");

  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: marker }),
  ).toBeVisible();
});
