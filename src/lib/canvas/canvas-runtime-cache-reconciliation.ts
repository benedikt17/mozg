import {
  parseCanvasDocumentV2,
  type CanvasDocument,
} from "@/lib/canvas/canvas-document";
import type { LoadedCanvas } from "@/lib/canvas/local-canvas-repository";
import type { LocalCanvasShellState } from "@/lib/canvas/local-canvas-shell-controller";

function sameDocument(first: CanvasDocument, second: CanvasDocument): boolean {
  return (
    JSON.stringify(parseCanvasDocumentV2(first)) ===
    JSON.stringify(parseCanvasDocumentV2(second))
  );
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
    document: parseCanvasDocumentV2(latest.document),
    status: "saved",
    error: null,
    conflictRevision: null,
    autosaveBlocked: false,
  };
}
