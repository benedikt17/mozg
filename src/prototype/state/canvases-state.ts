import type {
  PrototypeCanvas,
  PrototypeCanvasGroup,
  PrototypeCanvasObject,
} from "@/prototype/desktop-mock-data";
import type { DesktopPrototypeState } from "@/prototype/state/types";

export function getCanvasById(
  state: DesktopPrototypeState,
  canvasId: string | null,
): PrototypeCanvas | undefined {
  if (!canvasId) return undefined;
  return state.canvases.find((canvas) => canvas.id === canvasId);
}

export function getCanvasObjectById(
  state: DesktopPrototypeState,
  canvasId: string | null,
  objectId: string | null,
): PrototypeCanvasObject | undefined {
  if (!objectId) return undefined;
  return getCanvasById(state, canvasId)?.objects.find(
    (object) => object.id === objectId,
  );
}

export function getProjectCanvases(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): PrototypeCanvas[] {
  return state.canvases.filter((canvas) => canvas.projectId === projectId);
}

export function getProjectCanvasGroups(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): PrototypeCanvasGroup[] {
  return state.canvasGroups
    .filter((group) => group.projectId === projectId)
    .sort((first, second) => first.order - second.order);
}

export function getCanvasesForGroup(
  state: DesktopPrototypeState,
  groupId: string,
): PrototypeCanvas[] {
  return getProjectCanvases(state).filter(
    (canvas) => canvas.groupId === groupId,
  );
}

export function createCanvasGroup(
  state: DesktopPrototypeState,
  title: string,
): DesktopPrototypeState {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return state;
  const group: PrototypeCanvasGroup = {
    id: `mock-canvas-group-${state.nextCanvasGroupNumber}`,
    projectId: state.activeProjectId,
    title: trimmedTitle,
    order: getProjectCanvasGroups(state).length,
  };
  return {
    ...state,
    canvasGroups: [...state.canvasGroups, group],
    expandedCanvasGroupIds: [...state.expandedCanvasGroupIds, group.id],
    nextCanvasGroupNumber: state.nextCanvasGroupNumber + 1,
  };
}

export function toggleCanvasGroup(
  state: DesktopPrototypeState,
  groupId: string,
): DesktopPrototypeState {
  const group = state.canvasGroups.find(
    (item) => item.id === groupId && item.projectId === state.activeProjectId,
  );
  if (!group) return state;
  const isExpanded = state.expandedCanvasGroupIds.includes(groupId);
  return {
    ...state,
    expandedCanvasGroupIds: isExpanded
      ? state.expandedCanvasGroupIds.filter((id) => id !== groupId)
      : [...state.expandedCanvasGroupIds, groupId],
  };
}

export function renameCanvasGroup(
  state: DesktopPrototypeState,
  groupId: string,
  title: string,
): DesktopPrototypeState {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return state;
  const group = state.canvasGroups.find(
    (item) => item.id === groupId && item.projectId === state.activeProjectId,
  );
  if (!group) return state;
  return {
    ...state,
    canvasGroups: state.canvasGroups.map((item) =>
      item.id === group.id ? { ...item, title: trimmedTitle } : item,
    ),
  };
}

export function deleteCanvasGroup(
  state: DesktopPrototypeState,
  groupId: string,
): DesktopPrototypeState {
  const group = state.canvasGroups.find(
    (item) => item.id === groupId && item.projectId === state.activeProjectId,
  );
  if (!group) return state;
  return {
    ...state,
    canvasGroups: state.canvasGroups.filter((item) => item.id !== group.id),
    canvases: state.canvases.map((canvas) =>
      canvas.groupId === group.id ? { ...canvas, groupId: null } : canvas,
    ),
    expandedCanvasGroupIds: state.expandedCanvasGroupIds.filter(
      (id) => id !== group.id,
    ),
  };
}

export function createCanvas(
  state: DesktopPrototypeState,
  title: string,
  groupId: string | null,
): DesktopPrototypeState {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return state;
  if (
    groupId &&
    !state.canvasGroups.some(
      (group) =>
        group.id === groupId && group.projectId === state.activeProjectId,
    )
  ) {
    return state;
  }
  const canvas: PrototypeCanvas = {
    id: `mock-canvas-${state.nextCanvasNumber}`,
    projectId: state.activeProjectId,
    groupId,
    title: trimmedTitle,
    description: "",
    objects: [],
  };
  return {
    ...state,
    canvases: [...state.canvases, canvas],
    selectedCanvasId: canvas.id,
    selectedCanvasObjectId: null,
    contextPanel: null,
    contextPanelBeforeAi: null,
    nextCanvasNumber: state.nextCanvasNumber + 1,
  };
}

export function moveCanvasToGroup(
  state: DesktopPrototypeState,
  canvasId: string,
  groupId: string,
): DesktopPrototypeState {
  const canvas = state.canvases.find(
    (item) => item.id === canvasId && item.projectId === state.activeProjectId,
  );
  const group = state.canvasGroups.find(
    (item) => item.id === groupId && item.projectId === state.activeProjectId,
  );
  if (!canvas || !group || canvas.groupId === group.id) return state;
  return {
    ...state,
    canvases: state.canvases.map((item) =>
      item.id === canvas.id ? { ...item, groupId: group.id } : item,
    ),
    expandedCanvasGroupIds: state.expandedCanvasGroupIds.includes(group.id)
      ? state.expandedCanvasGroupIds
      : [...state.expandedCanvasGroupIds, group.id],
  };
}

export function renameCanvas(
  state: DesktopPrototypeState,
  canvasId: string,
  title: string,
): DesktopPrototypeState {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return state;
  const canvas = state.canvases.find(
    (item) => item.id === canvasId && item.projectId === state.activeProjectId,
  );
  if (!canvas) return state;
  return {
    ...state,
    canvases: state.canvases.map((item) =>
      item.id === canvas.id ? { ...item, title: trimmedTitle } : item,
    ),
  };
}

export function deleteCanvas(
  state: DesktopPrototypeState,
  canvasId: string,
): DesktopPrototypeState {
  const canvas = state.canvases.find(
    (item) => item.id === canvasId && item.projectId === state.activeProjectId,
  );
  if (!canvas) return state;
  const canvases = state.canvases.filter((item) => item.id !== canvas.id);
  const nextSelected =
    state.selectedCanvasId === canvas.id
      ? (canvases.find((item) => item.projectId === state.activeProjectId)
          ?.id ?? null)
      : state.selectedCanvasId;
  return {
    ...state,
    canvases,
    selectedCanvasId: nextSelected,
    selectedCanvasObjectId:
      state.selectedCanvasId === canvas.id
        ? null
        : state.selectedCanvasObjectId,
    contextPanel:
      state.contextPanel?.kind === "canvas-inspector" &&
      state.contextPanel.canvasId === canvas.id
        ? null
        : state.contextPanel,
  };
}

export function firstCanvasForProject(
  state: DesktopPrototypeState,
  projectId: string,
): PrototypeCanvas | undefined {
  return state.canvases.find((canvas) => canvas.projectId === projectId);
}

export function selectCanvas(
  state: DesktopPrototypeState,
  canvasId: string,
): DesktopPrototypeState {
  const canvas = getCanvasById(state, canvasId);
  if (!canvas) return state;
  return {
    ...state,
    activeProjectId: canvas.projectId,
    activeSection: "canvases",
    selectedCanvasId: canvas.id,
    selectedCanvasObjectId: null,
    contextPanel: null,
    contextPanelBeforeAi: null,
    commandPaletteOpen: false,
  };
}

export function selectCanvasObject(
  state: DesktopPrototypeState,
  canvasId: string,
  objectId: string,
): DesktopPrototypeState {
  return {
    ...state,
    activeSection: "canvases",
    selectedCanvasId: canvasId,
    selectedCanvasObjectId: objectId,
    contextPanel: {
      kind: "canvas-inspector",
      canvasId,
      objectId,
    },
    contextPanelBeforeAi: null,
  };
}
