import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";
import { initialDesktopPrototypeState } from "@/prototype/desktop-state";

const loadDesktopCloudSnapshot = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/desktop-snapshot-loader", () => ({
  loadDesktopCloudSnapshot,
}));
vi.mock("next/navigation", () => ({ redirect }));

const { default: DesktopPrototypePage } =
  await import("@/app/prototype/desktop/page");
const { default: SignInPage } = await import("@/app/sign-in/page");

const bootstrap = {
  workspaceId: "workspace-1",
  workspaceName: "Workspace",
  schemaVersion: 1,
  revision: 1,
  updatedAt: "2026-07-30T00:00:00.000Z",
  snapshot: createDesktopDomainSnapshot(initialDesktopPrototypeState),
};

describe("desktop routes in local development mode", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MOZG_LOCAL_DEV_MODE", "false");
    loadDesktopCloudSnapshot.mockReset();
    redirect.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("skips cloud loading and renders the local desktop boundary", async () => {
    vi.stubEnv("MOZG_LOCAL_DEV_MODE", "true");

    const page = await DesktopPrototypePage();

    expect(loadDesktopCloudSnapshot).not.toHaveBeenCalled();
    expect(page.props).toMatchObject({ runtimeMode: "local" });
  });

  it("retains cloud loading outside explicit local mode", async () => {
    loadDesktopCloudSnapshot.mockResolvedValue({ kind: "ready", bootstrap });

    const page = await DesktopPrototypePage();

    expect(loadDesktopCloudSnapshot).toHaveBeenCalledOnce();
    expect(page.props).toMatchObject({
      runtimeMode: "cloud",
      cloudBootstrap: bootstrap,
    });
  });

  it("redirects sign-in to the desktop only in local mode", async () => {
    vi.stubEnv("MOZG_LOCAL_DEV_MODE", "true");

    await SignInPage({ searchParams: Promise.resolve({}) });

    expect(redirect).toHaveBeenCalledWith("/prototype/desktop");
  });
});
