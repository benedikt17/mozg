import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CANVAS_DOCUMENT_LIMITS,
  CANVAS_DOCUMENT_V2_SCHEMA_VERSION,
  CANVAS_VIEWPORT_LIMITS,
  parseCanvasDocumentV2,
  type CanvasDocumentV2,
} from "@/lib/canvas/canvas-document";
import type { Database, Json } from "@/lib/supabase/database.types";
import type {
  CanvasGroup,
  CanvasGroupRepository,
  CreateCanvasGroupInput,
  DeleteCanvasGroupInput,
  MoveCanvasGroupInput,
  MoveCanvasToGroupInput,
  RenameCanvasGroupInput,
} from "@/lib/canvas/canvas-group-repository";

type CreateCanvasRpcRow =
  Database["public"]["Functions"]["create_canvas"]["Returns"][number];
type DeleteCanvasRpcRow =
  Database["public"]["Functions"]["delete_canvas"]["Returns"][number];
type RenameCanvasRpcRow =
  Database["public"]["Functions"]["rename_canvas"]["Returns"][number];
type SaveCanvasRpcRow =
  Database["public"]["Functions"]["save_canvas_document"]["Returns"][number];

const CANVAS_SUMMARY_SELECT =
  "id,workspace_id,title,group_id,sort_order,schema_version,revision,created_at,updated_at,deleted_at";
const CANVAS_LOAD_SELECT =
  "id,workspace_id,title,schema_version,document,revision,created_at,updated_at,deleted_at";
const VIEW_STATE_SELECT =
  "canvas_id,user_id,viewport_x,viewport_y,zoom,updated_at";
const CANVAS_GROUP_SELECT =
  "id,workspace_id,parent_group_id,title,sort_order,created_at,updated_at,deleted_at";

export type CloudCanvasRepositoryErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "invalid-input"
  | "invalid-server-document"
  | "server-contract"
  | "network"
  | "unexpected";

export class CloudCanvasRepositoryError extends Error {
  constructor(
    readonly code: CloudCanvasRepositoryErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "CloudCanvasRepositoryError";
  }
}

export type CloudCanvasSummary = {
  id: string;
  workspaceId: string;
  title: string;
  groupId: string | null;
  sortOrder: number;
  revision: number;
  schemaVersion: typeof CANVAS_DOCUMENT_V2_SCHEMA_VERSION;
  createdAt: string;
  updatedAt: string;
};

export type CloudLoadedCanvas = CloudCanvasSummary & {
  document: CanvasDocumentV2;
};

export type SaveCanvasDocumentInput = {
  workspaceId: string;
  canvasId: string;
  expectedRevision: number;
  title: string;
  document: CanvasDocumentV2;
};

export type CloudCanvasSaveResult =
  | { status: "saved"; revision: number }
  | { status: "conflict"; revision: number };

export type CloudCanvasViewState = {
  canvasId: string;
  userId: string;
  viewportX: number;
  viewportY: number;
  zoom: number;
  updatedAt: string;
};

export type SaveCanvasViewStateInput = {
  workspaceId: string;
  canvasId: string;
  viewportX: number;
  viewportY: number;
  zoom: number;
};

export interface CloudCanvasRepository extends CanvasGroupRepository {
  listCanvases(workspaceId: string): Promise<CloudCanvasSummary[]>;
  createCanvas(
    workspaceId: string,
    title: string,
    groupId?: string | null,
  ): Promise<CloudLoadedCanvas>;
  loadCanvas(workspaceId: string, canvasId: string): Promise<CloudLoadedCanvas>;
  renameCanvas(
    workspaceId: string,
    canvasId: string,
    title: string,
  ): Promise<CloudCanvasSummary>;
  deleteCanvas(workspaceId: string, canvasId: string): Promise<void>;
  saveCanvasDocument(
    input: SaveCanvasDocumentInput,
  ): Promise<CloudCanvasSaveResult>;
  loadCanvasViewState(
    workspaceId: string,
    canvasId: string,
  ): Promise<CloudCanvasViewState | null>;
  saveCanvasViewState(input: SaveCanvasViewStateInput): Promise<void>;
}

export type CloudCanvasRepositoryOptions = {
  supabase: SupabaseClient<Database>;
};

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inputIdentifier(value: string, field: string): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > CANVAS_DOCUMENT_LIMITS.maxIdLength ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new CloudCanvasRepositoryError(
      "invalid-input",
      `${field} is invalid.`,
    );
  }
  return value;
}

function inputTitle(value: string): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > CANVAS_DOCUMENT_LIMITS.maxTitleLength
  ) {
    throw new CloudCanvasRepositoryError(
      "invalid-input",
      "Canvas title is invalid.",
    );
  }
  return value;
}

function inputRevision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new CloudCanvasRepositoryError(
      "invalid-input",
      "Canvas revision is invalid.",
    );
  }
  return value;
}

function inputViewport(input: SaveCanvasViewStateInput): void {
  if (
    !Number.isFinite(input.viewportX) ||
    !Number.isFinite(input.viewportY) ||
    !Number.isFinite(input.zoom) ||
    Math.abs(input.viewportX) > CANVAS_DOCUMENT_LIMITS.maxAbsoluteCoordinate ||
    Math.abs(input.viewportY) > CANVAS_DOCUMENT_LIMITS.maxAbsoluteCoordinate ||
    input.zoom < CANVAS_VIEWPORT_LIMITS.minZoom ||
    input.zoom > CANVAS_VIEWPORT_LIMITS.maxZoom
  ) {
    throw new CloudCanvasRepositoryError(
      "invalid-input",
      "Canvas viewport is invalid.",
    );
  }
}

function serverString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CloudCanvasRepositoryError(
      "server-contract",
      `Cloud Canvas response has an invalid ${field}.`,
    );
  }
  return value;
}

function serverIdentifier(value: unknown, field: string): string {
  const identifier = serverString(value, field);
  if (
    identifier.length > CANVAS_DOCUMENT_LIMITS.maxIdLength ||
    /[\u0000-\u001f\u007f]/u.test(identifier)
  ) {
    throw new CloudCanvasRepositoryError(
      "server-contract",
      `Cloud Canvas response has an invalid ${field}.`,
    );
  }
  return identifier;
}

function serverTitle(value: unknown): string {
  const title = serverString(value, "title");
  if (title.length > CANVAS_DOCUMENT_LIMITS.maxTitleLength) {
    throw new CloudCanvasRepositoryError(
      "server-contract",
      "Cloud Canvas response has an invalid title.",
    );
  }
  return title;
}

function serverRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new CloudCanvasRepositoryError(
      "server-contract",
      "Cloud Canvas response has an invalid revision.",
    );
  }
  return value;
}

function serverSortOrder(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new CloudCanvasRepositoryError(
      "server-contract",
      "Cloud Canvas response has an invalid sort order.",
    );
  }
  return value;
}

function serverTimestamp(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new CloudCanvasRepositoryError(
      "server-contract",
      `Cloud Canvas response has an invalid ${field}.`,
    );
  }
  return value;
}

function serverSchemaVersion(
  value: unknown,
): typeof CANVAS_DOCUMENT_V2_SCHEMA_VERSION {
  if (value !== CANVAS_DOCUMENT_V2_SCHEMA_VERSION) {
    throw new CloudCanvasRepositoryError(
      "server-contract",
      "Cloud Canvas response is not V2.",
    );
  }
  return CANVAS_DOCUMENT_V2_SCHEMA_VERSION;
}

function parseCloudDocument(
  value: unknown,
  errorCode: "invalid-input" | "invalid-server-document",
): CanvasDocumentV2 {
  if (
    !isRecord(value) ||
    value.schemaVersion !== CANVAS_DOCUMENT_V2_SCHEMA_VERSION
  ) {
    throw new CloudCanvasRepositoryError(
      errorCode,
      errorCode === "invalid-input"
        ? "Canvas document must be CanvasDocumentV2."
        : "Cloud Canvas document is not CanvasDocumentV2.",
    );
  }
  try {
    return parseCanvasDocumentV2(value);
  } catch (cause) {
    throw new CloudCanvasRepositoryError(
      errorCode,
      errorCode === "invalid-input"
        ? "Canvas document is invalid."
        : "Cloud Canvas document is invalid.",
      { cause },
    );
  }
}

function mapCanvasSummary(
  value: unknown,
  workspaceId: string,
): CloudCanvasSummary {
  if (!isRecord(value)) {
    throw new CloudCanvasRepositoryError(
      "server-contract",
      "Cloud Canvas response is not an object.",
    );
  }
  const rowWorkspaceId = serverIdentifier(value.workspace_id, "workspace_id");
  if (rowWorkspaceId !== workspaceId) {
    throw new CloudCanvasRepositoryError(
      "server-contract",
      "Cloud Canvas response crossed the workspace boundary.",
    );
  }
  if (value.deleted_at !== null) {
    throw new CloudCanvasRepositoryError(
      "server-contract",
      "Cloud Canvas response returned a deleted Canvas.",
    );
  }
  return {
    id: serverIdentifier(value.id, "id"),
    workspaceId: rowWorkspaceId,
    title: serverTitle(value.title),
    groupId:
      value.group_id === null || value.group_id === undefined
        ? null
        : serverIdentifier(value.group_id, "group_id"),
    sortOrder:
      value.sort_order === undefined ? 0 : serverSortOrder(value.sort_order),
    revision: serverRevision(value.revision),
    schemaVersion: serverSchemaVersion(value.schema_version),
    createdAt: serverTimestamp(value.created_at, "created_at"),
    updatedAt: serverTimestamp(value.updated_at, "updated_at"),
  };
}

function mapCanvasGroup(value: unknown, workspaceId: string): CanvasGroup {
  if (!isRecord(value))
    throw new CloudCanvasRepositoryError(
      "server-contract",
      "Canvas group response is not an object.",
    );
  const rowWorkspaceId = serverIdentifier(value.workspace_id, "workspace_id");
  if (rowWorkspaceId !== workspaceId)
    throw new CloudCanvasRepositoryError(
      "server-contract",
      "Canvas group response crossed the workspace boundary.",
    );
  return {
    id: serverIdentifier(value.id, "id"),
    workspaceId: rowWorkspaceId,
    parentGroupId:
      value.parent_group_id === null
        ? null
        : serverIdentifier(value.parent_group_id, "parent_group_id"),
    title: serverTitle(value.title),
    sortOrder: serverSortOrder(value.sort_order),
    createdAt: serverTimestamp(value.created_at, "created_at"),
    updatedAt: serverTimestamp(value.updated_at, "updated_at"),
    deletedAt:
      value.deleted_at === null
        ? null
        : serverTimestamp(value.deleted_at, "deleted_at"),
  };
}

function mapLoadedCanvas(
  value: unknown,
  workspaceId: string,
): CloudLoadedCanvas {
  if (!isRecord(value)) {
    throw new CloudCanvasRepositoryError(
      "server-contract",
      "Cloud Canvas response is not an object.",
    );
  }
  const summary = mapCanvasSummary(value, workspaceId);
  return {
    ...summary,
    document: parseCloudDocument(value.document, "invalid-server-document"),
  };
}

function mapViewState(value: unknown, canvasId: string): CloudCanvasViewState {
  if (!isRecord(value)) {
    throw new CloudCanvasRepositoryError(
      "server-contract",
      "Cloud Canvas view state response is not an object.",
    );
  }
  const rowCanvasId = serverString(value.canvas_id, "canvas_id");
  if (rowCanvasId !== canvasId) {
    throw new CloudCanvasRepositoryError(
      "server-contract",
      "Cloud Canvas view state crossed the Canvas boundary.",
    );
  }
  if (
    typeof value.viewport_x !== "number" ||
    typeof value.viewport_y !== "number" ||
    typeof value.zoom !== "number" ||
    !Number.isFinite(value.viewport_x) ||
    !Number.isFinite(value.viewport_y) ||
    !Number.isFinite(value.zoom) ||
    Math.abs(value.viewport_x) > CANVAS_DOCUMENT_LIMITS.maxAbsoluteCoordinate ||
    Math.abs(value.viewport_y) > CANVAS_DOCUMENT_LIMITS.maxAbsoluteCoordinate ||
    value.zoom < CANVAS_VIEWPORT_LIMITS.minZoom ||
    value.zoom > CANVAS_VIEWPORT_LIMITS.maxZoom
  ) {
    throw new CloudCanvasRepositoryError(
      "server-contract",
      "Cloud Canvas view state has invalid viewport values.",
    );
  }
  return {
    canvasId: rowCanvasId,
    userId: serverIdentifier(value.user_id, "user_id"),
    viewportX: value.viewport_x,
    viewportY: value.viewport_y,
    zoom: value.zoom,
    updatedAt: serverTimestamp(value.updated_at, "updated_at"),
  };
}

function rpcRow(data: unknown, operation: string): RecordValue {
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
    throw new CloudCanvasRepositoryError(
      "server-contract",
      `Cloud Canvas ${operation} returned an invalid result.`,
    );
  }
  return data[0];
}

function supabaseCode(cause: unknown): string | undefined {
  return isRecord(cause) && typeof cause.code === "string"
    ? cause.code
    : undefined;
}

function projectSupabaseError(
  cause: unknown,
  operation: string,
): CloudCanvasRepositoryError {
  if (cause instanceof CloudCanvasRepositoryError) return cause;
  const code = supabaseCode(cause);
  if (code === "PGRST301" || code === "401") {
    return new CloudCanvasRepositoryError(
      "unauthenticated",
      "Cloud Canvas requires an authenticated session.",
      { operation, code },
    );
  }
  if (code === "42501" || code === "403") {
    return new CloudCanvasRepositoryError(
      "forbidden",
      "Cloud Canvas access is forbidden.",
      { operation, code },
    );
  }
  if (code === "40001") {
    return new CloudCanvasRepositoryError(
      "conflict",
      "Cloud Canvas save conflicted.",
      { operation, code },
    );
  }
  if (code === "22023") {
    return new CloudCanvasRepositoryError(
      "invalid-input",
      "Cloud Canvas input was rejected.",
      { operation, code },
    );
  }
  if (cause instanceof TypeError || cause instanceof DOMException) {
    return new CloudCanvasRepositoryError(
      "network",
      "Cloud Canvas network request failed.",
      { operation, code },
    );
  }
  return new CloudCanvasRepositoryError(
    "unexpected",
    "Cloud Canvas operation failed.",
    { operation, code },
  );
}

async function authenticatedUserId(
  supabase: SupabaseClient<Database>,
): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (typeof data.user?.id !== "string" || data.user.id.trim().length === 0) {
    throw new CloudCanvasRepositoryError(
      "unauthenticated",
      "Cloud Canvas requires an authenticated session.",
    );
  }
  return data.user.id;
}

export class SupabaseCloudCanvasRepository
  implements CloudCanvasRepository, CanvasGroupRepository
{
  private readonly supabase: SupabaseClient<Database>;

  constructor(options: CloudCanvasRepositoryOptions) {
    this.supabase = options.supabase;
  }

  async listCanvases(workspaceId: string): Promise<CloudCanvasSummary[]> {
    try {
      const scopedWorkspaceId = inputIdentifier(workspaceId, "workspaceId");
      const { data, error } = await this.supabase
        .from("canvases")
        .select(CANVAS_SUMMARY_SELECT)
        .eq("workspace_id", scopedWorkspaceId)
        .eq("schema_version", CANVAS_DOCUMENT_V2_SCHEMA_VERSION)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) =>
        mapCanvasSummary(row, scopedWorkspaceId),
      );
    } catch (cause) {
      throw projectSupabaseError(cause, "list");
    }
  }

  async listCanvasGroups(workspaceId: string): Promise<CanvasGroup[]> {
    try {
      const scopedWorkspaceId = inputIdentifier(workspaceId, "workspaceId");
      const { data, error } = await this.supabase
        .from("canvas_groups")
        .select(CANVAS_GROUP_SELECT)
        .eq("workspace_id", scopedWorkspaceId)
        .is("deleted_at", null)
        .order("parent_group_id", { ascending: true, nullsFirst: true })
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => mapCanvasGroup(row, scopedWorkspaceId));
    } catch (cause) {
      throw projectSupabaseError(cause, "list-groups");
    }
  }

  async createCanvasGroup(input: CreateCanvasGroupInput): Promise<CanvasGroup> {
    try {
      const workspaceId = inputIdentifier(input.workspaceId, "workspaceId");
      const title = inputTitle(input.title);
      const parentGroupId =
        input.parentGroupId === null || input.parentGroupId === undefined
          ? null
          : inputIdentifier(input.parentGroupId, "parentGroupId");
      const { data, error } = await this.supabase.rpc("create_canvas_group", {
        // Supabase generation currently models nullable RPC arguments as
        // required strings, while the SQL function accepts NULL for root groups.
        target_parent_group_id: parentGroupId as string,
        target_title: title,
        target_workspace_id: workspaceId,
      });
      if (error) throw error;
      return mapCanvasGroup(
        rpcRow(
          data as
            | Database["public"]["Functions"]["create_canvas_group"]["Returns"]
            | null,
          "create-group",
        ),
        workspaceId,
      );
    } catch (cause) {
      throw projectSupabaseError(cause, "create-group");
    }
  }

  async renameCanvasGroup(input: RenameCanvasGroupInput): Promise<CanvasGroup> {
    try {
      const workspaceId = inputIdentifier(input.workspaceId, "workspaceId");
      const groupId = inputIdentifier(input.groupId, "groupId");
      const title = inputTitle(input.title);
      const { data, error } = await this.supabase.rpc("rename_canvas_group", {
        target_group_id: groupId,
        target_title: title,
      });
      if (error) throw error;
      return mapCanvasGroup(
        rpcRow(
          data as
            | Database["public"]["Functions"]["rename_canvas_group"]["Returns"]
            | null,
          "rename-group",
        ),
        workspaceId,
      );
    } catch (cause) {
      throw projectSupabaseError(cause, "rename-group");
    }
  }

  async softDeleteCanvasGroup(
    input: DeleteCanvasGroupInput,
  ): Promise<{ status: "deleted" | "already-deleted" }> {
    try {
      const workspaceId = inputIdentifier(input.workspaceId, "workspaceId");
      const groupId = inputIdentifier(input.groupId, "groupId");
      const { data, error } = await this.supabase.rpc("delete_canvas_group", {
        target_group_id: groupId,
      });
      if (error) throw error;
      const row = rpcRow(
        data as
          | Database["public"]["Functions"]["delete_canvas_group"]["Returns"]
          | null,
        "delete-group",
      );
      if (row.workspace_id !== workspaceId)
        throw new CloudCanvasRepositoryError(
          "server-contract",
          "Canvas group delete crossed the workspace boundary.",
        );
      return { status: row.deleted ? "deleted" : "already-deleted" };
    } catch (cause) {
      throw projectSupabaseError(cause, "delete-group");
    }
  }

  async moveCanvasGroup(input: MoveCanvasGroupInput): Promise<CanvasGroup> {
    try {
      const workspaceId = inputIdentifier(input.workspaceId, "workspaceId");
      const groupId = inputIdentifier(input.groupId, "groupId");
      const parentGroupId =
        input.parentGroupId === null
          ? null
          : inputIdentifier(input.parentGroupId, "parentGroupId");
      const { data, error } = await this.supabase.rpc("move_canvas_group", {
        target_group_id: groupId,
        target_parent_group_id: parentGroupId as string,
      });
      if (error) throw error;
      return mapCanvasGroup(
        rpcRow(
          data as
            | Database["public"]["Functions"]["move_canvas_group"]["Returns"]
            | null,
          "move-group",
        ),
        workspaceId,
      );
    } catch (cause) {
      throw projectSupabaseError(cause, "move-group");
    }
  }

  async moveCanvasToGroup(input: MoveCanvasToGroupInput): Promise<void> {
    try {
      const workspaceId = inputIdentifier(input.workspaceId, "workspaceId");
      const canvasId = inputIdentifier(input.canvasId, "canvasId");
      const groupId =
        input.groupId === null
          ? null
          : inputIdentifier(input.groupId, "groupId");
      const { error } = await this.supabase.rpc("move_canvas_to_group", {
        target_canvas_id: canvasId,
        target_group_id: groupId as string,
      });
      if (error) throw error;
      await this.loadCanvas(workspaceId, canvasId);
    } catch (cause) {
      throw projectSupabaseError(cause, "move-canvas");
    }
  }

  async createCanvas(
    workspaceId: string,
    title: string,
    groupId: string | null = null,
  ): Promise<CloudLoadedCanvas> {
    try {
      const scopedWorkspaceId = inputIdentifier(workspaceId, "workspaceId");
      const canvasTitle = inputTitle(title);
      const targetGroupId =
        groupId === null ? null : inputIdentifier(groupId, "groupId");
      const { data, error } = await this.supabase.rpc("create_canvas", {
        target_group_id: targetGroupId,
        target_workspace_id: scopedWorkspaceId,
        target_title: canvasTitle,
      });
      if (error) throw error;
      const result = rpcRow(data as CreateCanvasRpcRow[] | null, "create");
      const canvasId = serverString(result.id, "id");
      serverRevision(result.revision);
      return await this.loadCanvas(scopedWorkspaceId, canvasId);
    } catch (cause) {
      throw projectSupabaseError(cause, "create");
    }
  }

  async loadCanvas(
    workspaceId: string,
    canvasId: string,
  ): Promise<CloudLoadedCanvas> {
    try {
      const scopedWorkspaceId = inputIdentifier(workspaceId, "workspaceId");
      const scopedCanvasId = inputIdentifier(canvasId, "canvasId");
      const { data, error } = await this.supabase
        .from("canvases")
        .select(CANVAS_LOAD_SELECT)
        .eq("id", scopedCanvasId)
        .eq("workspace_id", scopedWorkspaceId)
        .eq("schema_version", CANVAS_DOCUMENT_V2_SCHEMA_VERSION)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      if (data === null) {
        throw new CloudCanvasRepositoryError(
          "not-found",
          "Cloud Canvas was not found.",
        );
      }
      return mapLoadedCanvas(data, scopedWorkspaceId);
    } catch (cause) {
      throw projectSupabaseError(cause, "load");
    }
  }

  async renameCanvas(
    workspaceId: string,
    canvasId: string,
    title: string,
  ): Promise<CloudCanvasSummary> {
    try {
      const scopedWorkspaceId = inputIdentifier(workspaceId, "workspaceId");
      const scopedCanvasId = inputIdentifier(canvasId, "canvasId");
      const canvasTitle = inputTitle(title);
      const current = await this.loadCanvas(scopedWorkspaceId, scopedCanvasId);
      const { data, error } = await this.supabase.rpc("rename_canvas", {
        target_canvas_id: scopedCanvasId,
        target_title: canvasTitle,
      });
      if (error) throw error;
      const summary = mapCanvasSummary(
        rpcRow(data as RenameCanvasRpcRow[] | null, "rename"),
        scopedWorkspaceId,
      );
      if (
        summary.id !== scopedCanvasId ||
        summary.revision !== current.revision
      ) {
        throw new CloudCanvasRepositoryError(
          "server-contract",
          "Cloud Canvas rename changed the document revision or identity.",
        );
      }
      return summary;
    } catch (cause) {
      throw projectSupabaseError(cause, "rename");
    }
  }

  async deleteCanvas(workspaceId: string, canvasId: string): Promise<void> {
    try {
      const scopedWorkspaceId = inputIdentifier(workspaceId, "workspaceId");
      const scopedCanvasId = inputIdentifier(canvasId, "canvasId");
      await this.loadCanvas(scopedWorkspaceId, scopedCanvasId);
      const { data, error } = await this.supabase.rpc("delete_canvas", {
        target_canvas_id: scopedCanvasId,
      });
      if (error) throw error;
      const result = rpcRow(data as DeleteCanvasRpcRow[] | null, "delete");
      if (result.deleted !== true) {
        throw new CloudCanvasRepositoryError(
          "server-contract",
          "Cloud Canvas delete returned an invalid result.",
        );
      }
    } catch (cause) {
      throw projectSupabaseError(cause, "delete");
    }
  }

  async saveCanvasDocument(
    input: SaveCanvasDocumentInput,
  ): Promise<CloudCanvasSaveResult> {
    try {
      const workspaceId = inputIdentifier(input.workspaceId, "workspaceId");
      const canvasId = inputIdentifier(input.canvasId, "canvasId");
      const expectedRevision = inputRevision(input.expectedRevision);
      const title = inputTitle(input.title);
      const document = parseCloudDocument(input.document, "invalid-input");
      await this.loadCanvas(workspaceId, canvasId);
      const { data, error } = await this.supabase.rpc("save_canvas_document", {
        target_canvas_id: canvasId,
        target_expected_revision: expectedRevision,
        target_title: title,
        target_document: document as unknown as Json,
      });
      if (error) throw error;
      const result = rpcRow(data as SaveCanvasRpcRow[] | null, "save");
      if (result.status !== "saved" && result.status !== "conflict") {
        throw new CloudCanvasRepositoryError(
          "server-contract",
          "Cloud Canvas save returned an invalid status.",
        );
      }
      return {
        status: result.status,
        revision: serverRevision(result.revision),
      };
    } catch (cause) {
      throw projectSupabaseError(cause, "save");
    }
  }

  async loadCanvasViewState(
    workspaceId: string,
    canvasId: string,
  ): Promise<CloudCanvasViewState | null> {
    try {
      const scopedWorkspaceId = inputIdentifier(workspaceId, "workspaceId");
      const scopedCanvasId = inputIdentifier(canvasId, "canvasId");
      await this.loadCanvas(scopedWorkspaceId, scopedCanvasId);
      const userId = await authenticatedUserId(this.supabase);
      const { data, error } = await this.supabase
        .from("canvas_view_states")
        .select(VIEW_STATE_SELECT)
        .eq("canvas_id", scopedCanvasId)
        .maybeSingle();
      if (error) throw error;
      if (data === null) return null;
      const state = mapViewState(data, scopedCanvasId);
      if (state.userId !== userId) {
        throw new CloudCanvasRepositoryError(
          "server-contract",
          "Cloud Canvas view state crossed the user boundary.",
        );
      }
      return state;
    } catch (cause) {
      throw projectSupabaseError(cause, "load-view-state");
    }
  }

  async saveCanvasViewState(input: SaveCanvasViewStateInput): Promise<void> {
    try {
      const workspaceId = inputIdentifier(input.workspaceId, "workspaceId");
      const canvasId = inputIdentifier(input.canvasId, "canvasId");
      inputViewport(input);
      await this.loadCanvas(workspaceId, canvasId);
      const userId = await authenticatedUserId(this.supabase);
      const { error } = await this.supabase.from("canvas_view_states").upsert(
        {
          canvas_id: canvasId,
          user_id: userId,
          viewport_x: input.viewportX,
          viewport_y: input.viewportY,
          zoom: input.zoom,
        },
        { onConflict: "canvas_id,user_id" },
      );
      if (error) throw error;
    } catch (cause) {
      throw projectSupabaseError(cause, "save-view-state");
    }
  }
}

export function createCloudCanvasRepository(
  options: CloudCanvasRepositoryOptions,
): CloudCanvasRepository {
  return new SupabaseCloudCanvasRepository(options);
}
