import type {
  InboxFilter,
  PrototypeInboxItem,
} from "@/prototype/desktop-mock-data";
import type { DesktopPrototypeState } from "@/prototype/desktop-state";

export function getInboxItemById(
  state: DesktopPrototypeState,
  itemId: string | null,
): PrototypeInboxItem | undefined {
  if (!itemId) return undefined;
  return state.inboxItems.find((item) => item.id === itemId);
}

export function getProjectInboxItems(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): PrototypeInboxItem[] {
  return state.inboxItems.filter((item) => item.projectId === projectId);
}

export function getVisibleInboxItems(
  state: DesktopPrototypeState,
): PrototypeInboxItem[] {
  return getProjectInboxItems(state).filter(
    (item) => state.inboxFilter === "all" || item.kind === state.inboxFilter,
  );
}

export function firstInboxItemForProject(
  state: DesktopPrototypeState,
  projectId: string,
): PrototypeInboxItem | undefined {
  return state.inboxItems.find((item) => item.projectId === projectId);
}

export function setInboxFilter(
  state: DesktopPrototypeState,
  filter: InboxFilter,
): DesktopPrototypeState {
  return { ...state, inboxFilter: filter };
}

export function selectInboxItem(
  state: DesktopPrototypeState,
  itemId: string,
): DesktopPrototypeState {
  const item = getInboxItemById(state, itemId);
  if (!item) return state;
  return {
    ...state,
    activeProjectId: item.projectId,
    activeSection: "inbox",
    selectedInboxItemId: item.id,
    contextPanel: { kind: "inbox-item", itemId: item.id },
    contextPanelBeforeAi: null,
    commandPaletteOpen: false,
  };
}
