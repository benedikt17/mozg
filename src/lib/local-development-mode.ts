import type { DesktopRuntimeMode } from "@/lib/desktop-runtime-mode";

export type LocalDevelopmentModeInput = {
  nodeEnv: string | undefined;
  localDevModeValue: string | undefined;
};

export function resolveLocalDevelopmentMode({
  nodeEnv,
  localDevModeValue,
}: LocalDevelopmentModeInput): boolean {
  return nodeEnv === "development" && localDevModeValue === "true";
}

export function getDesktopRuntimeMode(): DesktopRuntimeMode {
  return resolveLocalDevelopmentMode({
    nodeEnv: process.env.NODE_ENV,
    localDevModeValue: process.env.MOZG_LOCAL_DEV_MODE,
  })
    ? "local"
    : "cloud";
}
