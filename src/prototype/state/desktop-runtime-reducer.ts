import {
  desktopPrototypeReducer,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import {
  createDesktopDomainSnapshot,
  parseDesktopDomainSnapshotV3,
} from "@/prototype/persistence/domain-snapshot";

/**
 * Production runtime boundary around the pure prototype reducer.
 *
 * Most actions are validated by their domain transition guards and again by the
 * persistence adapters before a write. The structural-history commit action is
 * intentionally different: it carries a precomputed state so the underlying
 * transition is not evaluated twice. Because that shape can otherwise bypass
 * reducer-level domain guards, validate its persisted projection here before it
 * can become the runtime state root.
 */
export function desktopRuntimeReducer(
  state: DesktopPrototypeState,
  action: DesktopPrototypeAction,
): DesktopPrototypeState {
  if (action.type === "commit-knowledge-structural-transition") {
    const parsed = parseDesktopDomainSnapshotV3(
      createDesktopDomainSnapshot(action.nextState),
    );
    return parsed.ok ? action.nextState : state;
  }

  return desktopPrototypeReducer(state, action);
}
