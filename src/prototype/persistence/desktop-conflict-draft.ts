import {
  parseDesktopDomainSnapshotV3,
  type DesktopDomainSnapshot,
} from "@/prototype/persistence/domain-snapshot";

const DESKTOP_CONFLICT_DRAFT_VERSION = 1 as const;
const DESKTOP_CONFLICT_DRAFT_PREFIX = "mozg:desktop-conflict-draft:v1";

type DesktopConflictDraft = {
  version: typeof DESKTOP_CONFLICT_DRAFT_VERSION;
  snapshot: DesktopDomainSnapshot;
  savedAt: string;
};

function storageKey(scope: string): string {
  return `${DESKTOP_CONFLICT_DRAFT_PREFIX}:${scope}`;
}

function usableStorage(storage?: Storage): Storage | undefined {
  if (storage) return storage;
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

export function readDesktopConflictDraft(
  scope: string,
  storage?: Storage,
): DesktopDomainSnapshot | null {
  try {
    const raw = usableStorage(storage)?.getItem(storageKey(scope));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<DesktopConflictDraft>;
    if (draft.version !== DESKTOP_CONFLICT_DRAFT_VERSION || !draft.snapshot) {
      return null;
    }
    const parsed = parseDesktopDomainSnapshotV3(draft.snapshot);
    return parsed.ok ? parsed.snapshot : null;
  } catch {
    return null;
  }
}

export function saveDesktopConflictDraft(
  scope: string,
  snapshot: DesktopDomainSnapshot,
  storage?: Storage,
): void {
  try {
    usableStorage(storage)?.setItem(
      storageKey(scope),
      JSON.stringify({
        version: DESKTOP_CONFLICT_DRAFT_VERSION,
        snapshot,
        savedAt: new Date().toISOString(),
      } satisfies DesktopConflictDraft),
    );
  } catch {
    // Storage can be disabled or full. The live runtime still keeps the draft
    // in memory and never reloads it automatically.
  }
}

export function clearDesktopConflictDraft(
  scope: string,
  storage?: Storage,
): void {
  try {
    usableStorage(storage)?.removeItem(storageKey(scope));
  } catch {
    // Best effort only.
  }
}
