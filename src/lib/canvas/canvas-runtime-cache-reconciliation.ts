import type { CanvasDocumentV2 } from "@/lib/canvas/canvas-document";
import type { LoadedCanvas } from "@/lib/canvas/local-canvas-repository";
import type { LocalCanvasShellState } from "@/lib/canvas/local-canvas-shell-controller";

function sameDocument(first: CanvasDocumentV2, second: CanvasDocumentV2): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

export function serverCanvasMatchesCachedRuntime(
  latest: LoadedCanvas | null,
  cached: LocalCanvasShellState,
): latest is LoadedCanvas {
  return Boolean(
    latest &&
      latest.id === cached.canvasId &&
      latest.title === cached.title &&
      sameDocument(latest.document, cached.document),
  );
}

export function reconcileCachedRuntimeWithServer(
  latest: LoadedCanvas,
  cached: LocalCanvasShellState,
): LocalCanvasShellState {
  return {
    ...cached,
    canvasId: latest.id,
    title: latest.title,
    revision: latest.revision,
    document: latest.document,
    status: "saved",
    error: null,
    conflictRevision: null,
    autosaveBlocked: false,
  };
}
