import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialDesktopPrototypeState } from "@/prototype/desktop-state";
import { createDesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";

const rpc = vi.fn();
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({ rpc }),
}));

const { CloudDesktopPersistenceAdapter } =
  await import("@/prototype/persistence/cloud-persistence-adapter");

const bootstrap = {
  workspaceId: "workspace-1",
  workspaceName: "Workspace",
  schemaVersion: 2,
  revision: 4,
  updatedAt: "2026-07-29T00:00:00.000Z",
  snapshot: createDesktopDomainSnapshot(initialDesktopPrototypeState),
};

describe("CloudDesktopPersistenceAdapter", () => {
  beforeEach(() => rpc.mockReset());

  it("accepts saved result and returns the server revision", async () => {
    rpc.mockResolvedValue({
      data: [{ status: "saved", revision: 5 }],
      error: null,
    });
    const adapter = new CloudDesktopPersistenceAdapter(bootstrap);

    await expect(
      adapter.saveWorkspace("ignored", bootstrap.snapshot, 4),
    ).resolves.toMatchObject({ revision: 5 });
    expect(rpc).toHaveBeenCalledWith("save_workspace_snapshot", {
      target_workspace_id: "workspace-1",
      target_expected_revision: 4,
      target_schema_version: 2,
      target_snapshot: bootstrap.snapshot,
    });
  });

  it("turns the typed conflict result into a non-retryable conflict error", async () => {
    rpc.mockResolvedValue({
      data: [{ status: "conflict", revision: 5 }],
      error: null,
    });
    const adapter = new CloudDesktopPersistenceAdapter(bootstrap);

    await expect(
      adapter.saveWorkspace("ignored", bootstrap.snapshot, 4),
    ).rejects.toMatchObject({
      code: "conflict",
      expectedRevision: 4,
      actualRevision: 5,
    });
  });

  it("keeps access and malformed responses unavailable", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "private detail" },
    });
    const adapter = new CloudDesktopPersistenceAdapter(bootstrap);
    await expect(
      adapter.saveWorkspace("ignored", bootstrap.snapshot, 4),
    ).rejects.toMatchObject({ code: "unavailable" });

    rpc.mockResolvedValueOnce({
      data: [{ status: "unknown", revision: 5 }],
      error: null,
    });
    await expect(
      adapter.saveWorkspace("ignored", bootstrap.snapshot, 4),
    ).rejects.toMatchObject({ code: "transaction-failed" });
  });

  it("maps server-side snapshot validation failures", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "22023", message: "desktop snapshot validation failed" },
    });
    const adapter = new CloudDesktopPersistenceAdapter(bootstrap);

    await expect(
      adapter.saveWorkspace("ignored", bootstrap.snapshot, 4),
    ).rejects.toMatchObject({ code: "invalid-snapshot" });
  });
});
