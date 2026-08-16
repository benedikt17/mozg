import {
  desktopPrototypeReducer,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import {
  createDesktopDomainSnapshot,
  parseDesktopDomainSnapshotV3,
  type DesktopDomainSnapshot,
} from "@/prototype/persistence/domain-snapshot";
import { refreshDesktopDomain } from "@/prototype/state/domain-refresh";

export type DesktopRuntimeAction =
  | DesktopPrototypeAction
  | { type: "refresh-domain"; snapshot: DesktopDomainSnapshot };

function persistentlyValid(state: DesktopPrototypeState): boolean {
  return parseDesktopDomainSnapshotV3(createDesktopDomainSnapshot(state)).ok;
}

/**
 * Production runtime boundary around the pure prototype reducer.
 *
 * Most actions are validated by their domain transition guards and again by the
 * persistence adapters before a write. Knowledge structural history has two
 * intentionally privileged paths: committing a precomputed transition and
 * replaying an undo/redo entry. Validate their persisted projection here before
 * either can become the runtime state root.
 */
export function desktopRuntimeReducer(
  state: DesktopPrototypeState,
  action: DesktopRuntimeAction,
): DesktopPrototypeState {
  if (action.type === "refresh-domain") {
    const candidateState = refreshDesktopDomain(state, action.snapshot);
    return persistentlyValid(candidateState) ? candidateState : state;
  }

  if (action.type === "commit-knowledge-structural-transition") {
    return persistentlyValid(action.nextState) ? action.nextState : state;
  }

  if (action.type === "apply-knowledge-structural-history") {
    const candidateState = desktopPrototypeReducer(state, action);
    return persistentlyValid(candidateState) ? candidateState : state;
  }

  return desktopPrototypeReducer(state, action);
}
