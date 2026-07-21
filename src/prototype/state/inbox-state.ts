import type {
  InboxFilter,
  PrototypeInboxItem,
} from "@/prototype/desktop-mock-data";
import type { DesktopPrototypeState } from "@/prototype/state/types";

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
  const normalizedQuery = state.inboxSearchQuery.trim().toLocaleLowerCase();
  return getProjectInboxItems(state).filter((item) => {
    const matchesFilter =
      state.inboxFilter === "all" || item.kind === state.inboxFilter;
    if (!matchesFilter || normalizedQuery.length === 0) return matchesFilter;
    return [item.title, item.preview, item.source]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });
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

export function setInboxSearchQuery(
  state: DesktopPrototypeState,
  query: string,
): DesktopPrototypeState {
  return { ...state, inboxSearchQuery: query };
}

export function moveInboxItem(
  state: DesktopPrototypeState,
  itemId: string,
  targetItemId: string | null,
  targetFilter: InboxFilter,
): DesktopPrototypeState {
  const source = state.inboxItems.find((item) => item.id === itemId);
  if (!source || targetFilter === "all") return state;
  const moved = { ...source, kind: targetFilter };
  const remaining = state.inboxItems.filter((item) => item.id !== itemId);
  const targetIndex = targetItemId
    ? remaining.findIndex((item) => item.id === targetItemId)
    : -1;
  remaining.splice(targetIndex < 0 ? remaining.length : targetIndex, 0, moved);
  return { ...state, inboxItems: remaining };
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
