import { IndexedDbCanvasRepository } from "@/lib/canvas/local-canvas-repository";

export const INFINITE_CANVAS_LOCAL_SHELL_WORKSPACE_ID =
  "__mozg_infinite_canvas_local_shell__";
export const INFINITE_CANVAS_LOCAL_SHELL_USER_ID =
  "__mozg_infinite_canvas_local_shell_user__";
export const INFINITE_CANVAS_LOCAL_SHELL_DATABASE_NAME =
  "mozg-infinite-canvas-local-shell";

export function createLocalInfiniteCanvasRepository(): IndexedDbCanvasRepository {
  return new IndexedDbCanvasRepository({
    databaseName: INFINITE_CANVAS_LOCAL_SHELL_DATABASE_NAME,
  });
}
