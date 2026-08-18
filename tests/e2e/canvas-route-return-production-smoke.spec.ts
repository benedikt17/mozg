import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { initialDesktopPrototypeState } from "@/prototype/desktop-state";
import {
  createDesktopDomainSnapshot,
  DESKTOP_DOMAIN_SCHEMA_VERSION,
} from "@/prototype/persistence/domain-snapshot";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

type CookieWrite = {
  name: string;
  value: string;
  options: CookieOptions;
};

async function installSmokeSession(context: BrowserContext): Promise<void> {
  const writes: CookieWrite[] = [];
  const supabase = createServerClient(
    requiredEnv("E2E_SUPABASE_URL"),
    requiredEnv("E2E_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll: () => [],
        setAll: (next) => writes.push(...next),
      },
    },
  );

  const refreshed = await supabase.auth.refreshSession({
    refresh_token: requiredEnv("PRODUCTION_SMOKE_REFRESH_TOKEN"),
  });
  if (refreshed.error || !refreshed.data.session) {
    throw refreshed.error ?? new Error("Production smoke refresh failed");
  }

  const membership = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", refreshed.data.session.user.id)
    .single();
  if (membership.error) throw membership.error;

  const existingSnapshot = await supabase
    .from("workspace_snapshots")
    .select("workspace_id")
    .eq("workspace_id", membership.data.workspace_id)
    .maybeSingle();
  if (existingSnapshot.error) throw existingSnapshot.error;
  if (!existingSnapshot.data) {
    const initialized = await supabase.rpc("initialize_workspace_snapshot", {
      target_workspace_id: membership.data.workspace_id,
      target_schema_version: DESKTOP_DOMAIN_SCHEMA_VERSION,
      target_snapshot: createDesktopDomainSnapshot(initialDesktopPrototypeState),
    });
    if (initialized.error) throw initialized.error;
  }

  if (writes.length === 0) throw new Error("Supabase SSR session cookies were not written");
  await context.addCookies(
    writes.map(({ name, value, options }) => ({
      name,
      value,
      url: "https://mozg-production.vercel.app",
      httpOnly: options.httpOnly ?? false,
      secure: options.secure ?? true,
      sameSite:
        options.sameSite === "strict"
          ? ("Strict" as const)
          : options.sameSite === "none"
            ? ("None" as const)
            : ("Lax" as const),
    })),
  );
}

async function openCanvases(page: Page): Promise<void> {
  const navigation = page.getByRole("navigation", { name: "Разделы приложения" });
  const canvases = navigation.getByRole("button", { name: "Холсты", exact: true });
  await canvases.click();
  await expect(canvases).toHaveAttribute("aria-current", "page");
}

test("Production keeps shapes visible after leaving Canvas and returning", async ({
  page,
  context,
}) => {
  const run = process.env.GITHUB_RUN_ID ?? String(Date.now());
  const canvasTitle = `Route Return Smoke ${run}`;
  const browserErrors: string[] = [];

  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
  });

  await installSmokeSession(context);
  await page.goto("/prototype/desktop");
  await expect(page).toHaveURL(/\/prototype\/desktop$/);

  await openCanvases(page);
  const newCanvas = page.getByRole("button", { name: "Новый холст", exact: true });
  await expect(newCanvas).toBeEnabled();
  await newCanvas.click();
  await page.getByRole("textbox", { name: "Новый холст", exact: true }).fill(canvasTitle);
  await page.getByRole("button", { name: "Создать", exact: true }).click();

  const canvasButton = page.getByRole("button", { name: canvasTitle, exact: true });
  await expect(canvasButton).toHaveAttribute("aria-current", "page");

  const toolbar = page.getByRole("toolbar", { name: "Инструменты холста" });
  await toolbar.getByRole("button", { name: "Добавить прямоугольник", exact: true }).click();
  await page.getByRole("textbox", { name: "Canvas text" }).fill(`Rectangle ${run}`);
  await page.getByRole("textbox", { name: "Canvas text" }).press("Tab");

  await toolbar.getByRole("button", { name: "Добавить круг", exact: true }).click();
  await page.getByRole("textbox", { name: "Canvas text" }).fill(`Circle ${run}`);
  await page.getByRole("textbox", { name: "Canvas text" }).press("Tab");

  await expect(page.locator('[data-canvas-shape="rectangle"]')).toHaveCount(1);
  await expect(page.locator('[data-canvas-shape="circle"]')).toHaveCount(1);
  await expect(page.getByText("Сохранено", { exact: true }).first()).toBeVisible();
  await page.waitForTimeout(1200);

  const navigation = page.getByRole("navigation", { name: "Разделы приложения" });
  const overview = navigation.getByRole("button", { name: "Обзор", exact: true });
  await overview.click();
  await expect(overview).toHaveAttribute("aria-current", "page");

  const canvases = navigation.getByRole("button", { name: "Холсты", exact: true });
  await canvases.click();
  await expect(canvases).toHaveAttribute("aria-current", "page");

  await expect(canvasButton).toHaveAttribute("aria-current", "page");
  await expect(page.locator('[data-canvas-shape="rectangle"]')).toHaveCount(1);
  await expect(page.locator('[data-canvas-shape="circle"]')).toHaveCount(1);
  await expect(page.locator('[data-canvas-shape="rectangle"]')).toContainText(`Rectangle ${run}`);
  await expect(page.locator('[data-canvas-shape="circle"]')).toContainText(`Circle ${run}`);
  await expect(page.getByText(/Cloud Canvas input was rejected/i)).toHaveCount(0);

  const relevantErrors = browserErrors.filter((line) =>
    /Cloud Canvas input was rejected|uncaught|canvas.*error|supabase.*error/i.test(line),
  );
  expect(relevantErrors, relevantErrors.join("\n")).toEqual([]);

  console.log(`ROUTE_RETURN_SMOKE:PASS canvas=${canvasTitle}`);
  console.log("ROUTE_RETURN_SMOKE:rectangle-visible-after-section-return PASS");
  console.log("ROUTE_RETURN_SMOKE:circle-visible-after-section-return PASS");
  console.log("ROUTE_RETURN_SMOKE:no-reload-no-canvas-switch PASS");
});
