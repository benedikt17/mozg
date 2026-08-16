import { describe, expect, it } from "vitest";
import { initialDesktopPrototypeState } from "@/prototype/desktop-state";
import { DesktopPersistenceRuntime } from "@/prototype/persistence/desktop-persistence-runtime";
import {
  createDesktopDomainSnapshot,
  type DesktopDomainSnapshot,
} from "@/prototype/persistence/domain-snapshot";
import {
  DesktopPersistenceError,
  type DesktopPersistenceAdapter,
  type DesktopPersistenceLoadResult,
  type DesktopPersistenceSaveResult,
} from "@/prototype/persistence/persistence-adapter";

function baseSnapshot(): DesktopDomainSnapshot {
  return createDesktopDomainSnapshot(initialDesktopPrototypeState);
}

function withTaskTitle(
  snapshot: DesktopDomainSnapshot,
  title: string,
): DesktopDomainSnapshot {
  const next = structuredClone(snapshot);
  if (next.tasks[0]) next.tasks[0].title = title;
  return next;
}

class LiveRefreshAdapter implements DesktopPersistenceAdapter {
  snapshot = baseSnapshot();
  revision = 9;
  latestReadError: DesktopPersistenceError | null = null;
  readonly saveExpectedRevisions: number[] = [];

  loadWorkspace(): Promise<DesktopPersistenceLoadResult> {
    return Promise.resolve({
      kind: "loaded",
      snapshot: structuredClone(this.snapshot),
      revision: this.revision,
      savedAt: `revision-${this.revision}`,
    });
  }

  loadLatestWorkspace(): Promise<DesktopPersistenceLoadResult> {
    if (this.latestReadError) return Promise.reject(this.latestReadError);
    return Promise.resolve({
      kind: "loaded",
      snapshot: structuredClone(this.snapshot),
      revision: this.revision,
      savedAt: `revision-${this.revision}`,
    });
  }

  initializeWorkspace(): Promise<DesktopPersistenceSaveResult> {
    throw new Error("Refresh tests start from an initialized workspace.");
  }

  saveWorkspace(
    _storageKey: string,
    snapshot: DesktopDomainSnapshot,
    expectedRevision: number,
  ): Promise<DesktopPersistenceSaveResult> {
    this.saveExpectedRevisions.push(expectedRevision);
    if (expectedRevision !== this.revision) {
      return Promise.reject(
        new DesktopPersistenceError("conflict", "stale revision", {
          expectedRevision,
          actualRevision: this.revision,
        }),
      );
    }
    this.snapshot = structuredClone(snapshot);
    this.revision += 1;
    return Promise.resolve({
      revision: this.revision,
      savedAt: `revision-${this.revision}`,
    });
  }

  close(): void {}
}

function createRuntime(
  adapter: LiveRefreshAdapter,
  onRefresh: (snapshot: DesktopDomainSnapshot) => void = () => undefined,
): DesktopPersistenceRuntime {
  return new DesktopPersistenceRuntime({
    adapter,
    initialSnapshot: baseSnapshot(),
    onHydrate: () => undefined,
    onRefresh,
    onLifecycleChange: () => undefined,
  });
}

describe("DesktopPersistenceRuntime live refresh", () => {
  it("adopts a newer server snapshot before the next local save", async () => {
    const adapter = new LiveRefreshAdapter();
    const refreshed: DesktopDomainSnapshot[] = [];
    const runtime = createRuntime(adapter, (snapshot) =>
      refreshed.push(structuredClone(snapshot)),
    );
    await runtime.start();

    adapter.snapshot = withTaskTitle(adapter.snapshot, "Remote device edit");
    adapter.revision = 10;

    expect(await runtime.refreshFromSource()).toBe("refreshed");
    expect(refreshed[0]?.tasks[0]?.title).toBe("Remote device edit");

    const local = withTaskTitle(adapter.snapshot, "Local edit after refresh");
    runtime.observeSnapshot(local);
    await runtime.flush();

    expect(adapter.saveExpectedRevisions.at(-1)).toBe(10);
    expect(adapter.snapshot.tasks[0]?.title).toBe("Local edit after refresh");
    expect(runtime.lifecycle).toMatchObject({
      status: "ready",
      revision: 11,
    });
  });

  it("advances an identical newer revision without resetting content state", async () => {
    const adapter = new LiveRefreshAdapter();
    const refreshed: DesktopDomainSnapshot[] = [];
    const runtime = createRuntime(adapter, (snapshot) =>
      refreshed.push(snapshot),
    );
    await runtime.start();

    adapter.revision = 10;
    expect(await runtime.refreshFromSource()).toBe("unchanged");
    expect(refreshed).toHaveLength(0);

    const local = withTaskTitle(adapter.snapshot, "Edit after revision refresh");
    runtime.observeSnapshot(local);
    await runtime.flush();
    expect(adapter.saveExpectedRevisions).toEqual([10]);
  });

  it("keeps CAS as the final guard when the server changes after preflight", async () => {
    const adapter = new LiveRefreshAdapter();
    const runtime = createRuntime(adapter);
    await runtime.start();

    expect(await runtime.refreshFromSource()).toBe("unchanged");
    adapter.snapshot = withTaskTitle(adapter.snapshot, "Concurrent winner");
    adapter.revision = 10;

    runtime.observeSnapshot(
      withTaskTitle(baseSnapshot(), "Concurrent stale local edit"),
    );
    await runtime.flush();

    expect(adapter.saveExpectedRevisions).toEqual([9]);
    expect(runtime.lifecycle).toMatchObject({
      status: "conflict",
      revision: 9,
      error: { code: "conflict" },
    });
  });

  it("treats a failed live read as a best-effort skip", async () => {
    const adapter = new LiveRefreshAdapter();
    const runtime = createRuntime(adapter);
    await runtime.start();
    adapter.latestReadError = new DesktopPersistenceError(
      "unavailable",
      "temporary network failure",
    );

    expect(await runtime.refreshFromSource()).toBe("skipped");
    expect(runtime.lifecycle).toMatchObject({ status: "ready", revision: 9 });
  });
});
