import type {
  PrototypeCanvas,
  PrototypeCanvasObject,
} from "@/prototype/desktop-mock-data";
import type { DesktopPrototypeState } from "@/prototype/desktop-state";

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
