export type CanvasPaneId = "primary" | "secondary";

export type CanvasPaneSelection = {
  activePane: CanvasPaneId;
  openCanvasId: string | null;
  targetPane: CanvasPaneId;
};

export function otherCanvasPane(pane: CanvasPaneId): CanvasPaneId {
  return pane === "primary" ? "secondary" : "primary";
}

/**
 * Routes a sidebar selection without ever opening one Canvas in two panes.
 * Selecting a Canvas that is already visible focuses that pane; every other
 * selection replaces the document in the currently active pane.
 */
export function resolveCanvasPaneSelection(input: {
  activePane: CanvasPaneId;
  primaryCanvasId: string | null;
  requestedCanvasId: string;
  secondaryCanvasId: string | null;
}): CanvasPaneSelection {
  if (input.requestedCanvasId === input.primaryCanvasId) {
    return {
      activePane: "primary",
      openCanvasId: null,
      targetPane: "primary",
    };
  }
  if (input.requestedCanvasId === input.secondaryCanvasId) {
    return {
      activePane: "secondary",
      openCanvasId: null,
      targetPane: "secondary",
    };
  }
  return {
    activePane: input.activePane,
    openCanvasId: input.requestedCanvasId,
    targetPane: input.activePane,
  };
}
