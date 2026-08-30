import { describe, expect, it } from "vitest";
import { initialDesktopPrototypeState } from "@/prototype/desktop-state";
import { createDesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";
import {
  clearDesktopConflictDraft,
  readDesktopConflictDraft,
  saveDesktopConflictDraft,
} from "@/prototype/persistence/desktop-conflict-draft";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("desktop conflict drafts", () => {
  it("keeps a valid workspace snapshot until the explicit resolution succeeds", () => {
    const storage = new MemoryStorage() as unknown as Storage;
    const snapshot = createDesktopDomainSnapshot(initialDesktopPrototypeState);
    snapshot.tasks[0]!.title = "Unsaved task";

    saveDesktopConflictDraft("cloud:workspace-1", snapshot, storage);

    expect(
      readDesktopConflictDraft("cloud:workspace-1", storage)?.tasks[0]?.title,
    ).toBe("Unsaved task");
    clearDesktopConflictDraft("cloud:workspace-1", storage);
    expect(readDesktopConflictDraft("cloud:workspace-1", storage)).toBeNull();
  });
});
