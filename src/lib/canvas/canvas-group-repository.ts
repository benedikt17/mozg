export type CanvasGroup = {
  id: string;
  workspaceId: string;
  parentGroupId: string | null;
  title: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CanvasGroupRepositoryErrorCode =
  | "invalid-input"
  | "not-found"
  | "workspace-mismatch"
  | "cycle"
  | "conflict"
  | "forbidden"
  | "network"
  | "unexpected";

export class CanvasGroupRepositoryError extends Error {
  constructor(
    readonly code: CanvasGroupRepositoryErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "CanvasGroupRepositoryError";
  }
}

export type CreateCanvasGroupInput = {
  workspaceId: string;
  title: string;
  parentGroupId?: string | null;
};

export type RenameCanvasGroupInput = {
  workspaceId: string;
  groupId: string;
  title: string;
};

export type DeleteCanvasGroupInput = {
  workspaceId: string;
  groupId: string;
};

export type MoveCanvasGroupInput = {
  workspaceId: string;
  groupId: string;
  parentGroupId: string | null;
};

export type MoveCanvasToGroupInput = {
  workspaceId: string;
  canvasId: string;
  groupId: string | null;
};

export interface CanvasGroupRepository {
  listCanvasGroups(workspaceId: string): Promise<CanvasGroup[]>;
  createCanvasGroup(input: CreateCanvasGroupInput): Promise<CanvasGroup>;
  renameCanvasGroup(input: RenameCanvasGroupInput): Promise<CanvasGroup>;
  softDeleteCanvasGroup(
    input: DeleteCanvasGroupInput,
  ): Promise<{ status: "deleted" | "already-deleted" }>;
  moveCanvasGroup(input: MoveCanvasGroupInput): Promise<CanvasGroup>;
  moveCanvasToGroup(input: MoveCanvasToGroupInput): Promise<void>;
}
