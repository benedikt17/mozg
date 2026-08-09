export type CanvasPendingSaveFlushState = {
  canvasId: string;
  title: string;
  revision: number;
  status: "loading" | "saved" | "saving" | "conflict" | "error";
  error: string | null;
  conflictRevision: number | null;
  autosaveBlocked: boolean;
};

export type CanvasPendingSaveFlushRegistration = {
  userId: string;
  flush: () => Promise<CanvasPendingSaveFlushState | null>;
};

/** Optional repository lifecycle hook used by mounted Canvas shells on leave/unmount. */
export interface CanvasPendingSaveLifecycleRepository {
  registerPendingSaveFlush(
    registration: CanvasPendingSaveFlushRegistration,
  ): void;
}
