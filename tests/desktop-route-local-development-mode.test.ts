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
  schemaVersion: 2,
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

  it("keeps the main Desktop route cloud-backed even when the legacy local flag is true", async () => {
    vi.stubEnv("MOZG_LOCAL_DEV_MODE", "true");
    loadDesktopCloudSnapshot.mockResolvedValue({ kind: "ready", bootstrap });

    const page = await DesktopPrototypePage();
    const [desktopShell, annotationsRuntime] = page.props.children;

    expect(loadDesktopCloudSnapshot).toHaveBeenCalledOnce();
    expect(desktopShell.props).toMatchObject({
      runtimeMode: "cloud",
      cloudBootstrap: bootstrap,
    });
    expect(annotationsRuntime.props).toMatchObject({
      workspaceId: bootstrap.workspaceId,
    });
  });

  it("retains cloud loading outside explicit local mode", async () => {
    loadDesktopCloudSnapshot.mockResolvedValue({ kind: "ready", bootstrap });

    const page = await DesktopPrototypePage();
    const [desktopShell, annotationsRuntime] = page.props.children;

    expect(loadDesktopCloudSnapshot).toHaveBeenCalledOnce();
    expect(desktopShell.props).toMatchObject({
      runtimeMode: "cloud",
      cloudBootstrap: bootstrap,
    });
    expect(annotationsRuntime.props).toMatchObject({
      workspaceId: bootstrap.workspaceId,
    });
  });

  it("keeps the sign-in redirect path contract", async () => {
    const page = await SignInPage({
      searchParams: Promise.resolve({ next: "/prototype/desktop" }),
    });

    expect(redirect).not.toHaveBeenCalled();
    expect(page.props).toMatchObject({ redirectPath: "/prototype/desktop" });
  });
});
