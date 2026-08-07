import {
  createDesktopDomainSnapshot,
  parseDesktopDomainSnapshot,
  type DesktopDomainSnapshot,
} from "@/prototype/persistence/domain-snapshot";
import type { DesktopPrototypeState } from "@/prototype/state/types";

export function expectPersistentStateValid(
  state: DesktopPrototypeState,
): DesktopDomainSnapshot {
  const snapshot = createDesktopDomainSnapshot(state);
  const result = parseDesktopDomainSnapshot(snapshot);

  if (!result.ok) {
    const diagnostics = result.errors
      .map(({ path, code, message }) => `- ${path} [${code}]: ${message}`)
      .join("\n");
    throw new Error(
      [
        "Persistent Desktop state invariant violated.",
        `Serialized snapshot schema version: ${snapshot.schemaVersion}.`,
        "Snapshot validation errors:",
        diagnostics,
      ].join("\n"),
    );
  }

  return result.snapshot;
}
