import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialDesktopPrototypeState } from "@/prototype/desktop-state";
import { createDesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";

const createClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/browser", () => ({ createClient }));

const { createDesktopPersistenceAdapter } =
  await import("@/prototype/persistence/use-desktop-persistence");
const { IndexedDbDesktopPersistenceAdapter } =
  await import("@/prototype/persistence/indexeddb-adapter");
const { CloudDesktopPersistenceAdapter } =
  await import("@/prototype/persistence/cloud-persistence-adapter");

const bootstrap = {
  workspaceId: "workspace-1",
  workspaceName: "Workspace",
  schemaVersion: 1,
  revision: 1,
  updatedAt: "2026-07-30T00:00:00.000Z",
  snapshot: createDesktopDomainSnapshot(initialDesktopPrototypeState),
};

describe("desktop persistence mode selection", () => {
  beforeEach(() => createClient.mockReset());

  it("uses IndexedDB without constructing a Supabase client in local mode", () => {
    const adapter = createDesktopPersistenceAdapter({ runtimeMode: "local" });

    expect(adapter).toBeInstanceOf(IndexedDbDesktopPersistenceAdapter);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("uses the cloud adapter only with a server-provided cloud bootstrap", () => {
    createClient.mockReturnValue({ rpc: vi.fn() });

    const adapter = createDesktopPersistenceAdapter({
      runtimeMode: "cloud",
      cloudBootstrap: bootstrap,
    });

    expect(adapter).toBeInstanceOf(CloudDesktopPersistenceAdapter);
    expect(createClient).toHaveBeenCalledOnce();
  });

  it("does not infer cloud mode from missing credentials or bootstrap", () => {
    expect(() =>
      createDesktopPersistenceAdapter({ runtimeMode: "cloud" }),
    ).toThrow("Cloud desktop persistence requires a cloud bootstrap.");
  });
});
