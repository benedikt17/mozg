export type DesktopRuntimeMode = "cloud" | "local";

export function shouldShowAuthenticatedAccountControls(
  runtimeMode: DesktopRuntimeMode,
): boolean {
  return runtimeMode === "cloud";
}
