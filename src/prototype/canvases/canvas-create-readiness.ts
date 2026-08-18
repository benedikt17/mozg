export type CanvasListReadiness = "loading" | "ready" | "empty" | "error";

export function canCreateCanvasFromSidebar(
  listState: CanvasListReadiness,
  activeCanvasId: string | null,
): boolean {
  return (
    listState === "empty" || (listState === "ready" && activeCanvasId !== null)
  );
}
