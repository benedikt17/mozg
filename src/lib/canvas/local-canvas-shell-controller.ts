import {
  createEmptyCanvasDocumentV2,
  parseCanvasDocumentV2,
  type CanvasDocument,
  type CanvasDocumentV2,
  type CanvasEdgeV2,
  type CanvasViewport,
  type CanvasTextNode,
  type CanvasNode,
} from "@/lib/canvas/canvas-document";
import { CanvasDocumentHistory } from "@/lib/canvas/canvas-document-history";
import type {
  CanvasPendingSaveFlushState,
  CanvasPendingSaveLifecycleRepository,
} from "@/lib/canvas/canvas-pending-save-lifecycle";
import {
  imageNodesToCanvasDocument,
  runtimeEdgesToCanvasDocument,
  runtimeNodesToCanvasDocument,
  type CanvasFlowNode,
  type CanvasEdgeFlow,
  type CanvasImageFlowNode,
  type CanvasTaskFlowNode,
  type CanvasTextFlowNode,
} from "@/lib/canvas/react-flow-canvas-adapter";
import type {
  CanvasRepository,
  CanvasSaveResult,
  CanvasSummary,
  CanvasViewStateRepository,
  LoadedCanvas,
} from "@/lib/canvas/local-canvas-repository";

type CanvasNavigationLifecycleRepository = {
  beginCanvasNavigation?: (canvasId: string | null) => void;
};

export type LocalCanvasShellStatus =
  "loading" | "saved" | "saving" | "conflict" | "error";

export type LocalCanvasShellState = {
  canvasId: string | null;
  title: string;
  revision: number;
  document: CanvasDocumentV2;
  viewport: CanvasViewport;
  status: LocalCanvasShellStatus;
  error: string | null;
  conflictRevision: number | null;
  autosaveBlocked: boolean;
};

export const DEFAULT_CANVAS_VIEWPORT: CanvasViewport = {
  x: 0,
  y: 0,
  zoom: 1,
};

export type LocalCanvasShellControllerOptions = {
  repository: CanvasRepository & CanvasViewStateRepository;
  workspaceId: string;
  userId: string;
  clock?: () => Date | string;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function now(clock: () => Date | string): string {
  return new Date(clock()).toISOString();
}

function sameDocument(
  first: CanvasDocumentV2,
  second: CanvasDocumentV2,
): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

export function emptyShellState(): LocalCanvasShellState {
  return {
    canvasId: null,
    title: "",
    revision: 1,
    document: createEmptyCanvasDocumentV2(),
    viewport: { ...DEFAULT_CANVAS_VIEWPORT },
    status: "loading",
    error: null,
    conflictRevision: null,
    autosaveBlocked: false,
  };
}

export class LocalCanvasShellController {
  private readonly repository: CanvasRepository & CanvasViewStateRepository;
  private readonly workspaceId: string;
  private readonly userId: string;
  private readonly clock: () => Date | string;
  private readonly documentHistory = new CanvasDocumentHistory();
  private stateValue: LocalCanvasShellState = emptyShellState();
  private mutationVersion = 0;
  private savedMutationVersion = 0;
  private saveInFlight: Promise<CanvasSaveResult | null> | null = null;
  private navigationVersion = 0;

  constructor(options: LocalCanvasShellControllerOptions) {
    this.repository = options.repository;
    this.workspaceId = options.workspaceId;
    this.userId = options.userId;
    this.clock = options.clock ?? (() => new Date());

    const lifecycleRepository = this.repository as typeof this.repository &
      Partial<CanvasPendingSaveLifecycleRepository>;
    lifecycleRepository.registerPendingSaveFlush?.({
      userId: this.userId,
      flush: async () => {
        if (!this.hasPendingSave && !this.stateValue.autosaveBlocked)
          return null;
        try {
          await this.flushPendingSave();
        } catch {
          // The controller keeps the failed save state so the runtime cache can
          // preserve the unsaved scene and expose a retryable error on return.
        }
        return this.pendingSaveFlushState();
      },
    });
  }

  get state(): LocalCanvasShellState {
    return clone(this.stateValue);
  }

  get hasPendingSave(): boolean {
    return this.mutationVersion > this.savedMutationVersion;
  }

  get canUndo(): boolean {
    return this.documentHistory.canUndo;
  }

  get canRedo(): boolean {
    return this.documentHistory.canRedo;
  }

  restoreRuntimeState(state: LocalCanvasShellState): LocalCanvasShellState {
    this.beginCanvasNavigation(state.canvasId);
    this.stateValue = clone(state);
    this.documentHistory.reset();
    this.saveInFlight = null;
    this.savedMutationVersion = 0;
    this.mutationVersion =
      state.status === "saving" ||
      state.status === "error" ||
      state.status === "conflict"
        ? 1
        : 0;
    return this.state;
  }

  async listCanvases(): Promise<CanvasSummary[]> {
    return this.repository.listCanvases(this.workspaceId);
  }

  async createCanvas(
    title: string,
    groupId: string | null = null,
  ): Promise<LocalCanvasShellState> {
    if (this.stateValue.canvasId && this.stateValue.autosaveBlocked) {
      throw new Error(
        "Resolve the current Canvas save conflict before leaving it.",
      );
    }
    const navigationVersion = this.beginCanvasNavigation(null);
    if (this.stateValue.canvasId) {
      await this.flushPendingSave();
      if (!this.isCurrentNavigation(navigationVersion)) return this.state;
      if (this.stateValue.autosaveBlocked) {
        throw new Error(
          "Resolve the current Canvas save conflict before leaving it.",
        );
      }
    }
    const canvas = await this.repository.createCanvas({
      workspaceId: this.workspaceId,
      title,
      groupId,
    });
    if (!this.isCurrentNavigation(navigationVersion)) return this.state;
    return this.hydrate(canvas, null);
  }

  async openCanvas(canvasId: string): Promise<LocalCanvasShellState> {
    const currentCanvasId = this.stateValue.canvasId;
    if (
      currentCanvasId &&
      currentCanvasId !== canvasId &&
      this.stateValue.autosaveBlocked
    ) {
      throw new Error(
        "Resolve the current Canvas save conflict before leaving it.",
      );
    }
    const navigationVersion = this.beginCanvasNavigation(canvasId);
    if (currentCanvasId) {
      if (!this.stateValue.autosaveBlocked) {
        await this.flushPendingSave();
      }
      if (!this.isCurrentNavigation(navigationVersion)) return this.state;
      if (currentCanvasId !== canvasId && this.stateValue.autosaveBlocked) {
        throw new Error(
          "Resolve the current Canvas save conflict before leaving it.",
        );
      }
    }

    if (!this.isCurrentNavigation(navigationVersion)) return this.state;
    this.stateValue = { ...this.stateValue, status: "loading", error: null };
    const canvas = await this.repository.loadCanvas({
      workspaceId: this.workspaceId,
      canvasId,
    });
    if (!this.isCurrentNavigation(navigationVersion)) return this.state;
    if (!canvas) {
      this.stateValue = {
        ...this.stateValue,
        status: "error",
        error: "Canvas was not found.",
      };
      throw new Error("Canvas was not found.");
    }
    const viewState = await this.repository.loadViewState({
      canvasId,
      userId: this.userId,
    });
    if (!this.isCurrentNavigation(navigationVersion)) return this.state;
    return this.hydrate(canvas, viewState);
  }

  private beginCanvasNavigation(canvasId: string | null): number {
    const navigationVersion = ++this.navigationVersion;
    const lifecycleRepository = this.repository as typeof this.repository &
      CanvasNavigationLifecycleRepository;
    lifecycleRepository.beginCanvasNavigation?.(canvasId);
    return navigationVersion;
  }

  private isCurrentNavigation(navigationVersion: number): boolean {
    return navigationVersion === this.navigationVersion;
  }

  private hydrate(
    canvas: LoadedCanvas,
    viewState: Awaited<ReturnType<CanvasViewStateRepository["loadViewState"]>>,
  ): LocalCanvasShellState {
    const document = parseCanvasDocumentV2(canvas.document);
    this.stateValue = {
      canvasId: canvas.id,
      title: canvas.title,
      revision: canvas.revision,
      document: clone(document),
      viewport: viewState
        ? {
            x: viewState.viewportX,
            y: viewState.viewportY,
            zoom: viewState.zoom,
          }
        : { ...DEFAULT_CANVAS_VIEWPORT },
      status: "saved",
      error: null,
      conflictRevision: null,
      autosaveBlocked: false,
    };
    this.documentHistory.reset();
    this.mutationVersion = 0;
    this.savedMutationVersion = 0;
    this.saveInFlight = null;
    return this.state;
  }

  private markPendingSave(
    nextState: LocalCanvasShellState,
  ): LocalCanvasShellState {
    this.mutationVersion += 1;
    this.stateValue = {
      ...nextState,
      status: "saving",
      error: null,
    };
    return this.state;
  }

  private markDocumentPendingSave(
    document: CanvasDocumentV2,
    recordHistory = true,
  ): LocalCanvasShellState {
    const nextDocument = parseCanvasDocumentV2(document);
    if (sameDocument(this.stateValue.document, nextDocument)) return this.state;
    if (recordHistory)
      this.documentHistory.commit(this.stateValue.document, nextDocument);
    return this.markPendingSave({
      ...this.stateValue,
      document: clone(nextDocument),
    });
  }

  private pendingSaveFlushState(): CanvasPendingSaveFlushState | null {
    const current = this.stateValue;
    if (!current.canvasId) return null;
    return {
      canvasId: current.canvasId,
      title: current.title,
      revision: current.revision,
      status: current.status,
      error: current.error,
      conflictRevision: current.conflictRevision,
      autosaveBlocked: current.autosaveBlocked,
    };
  }

  setImageNodes(nodes: readonly CanvasImageFlowNode[]): LocalCanvasShellState {
    if (!this.stateValue.canvasId) return this.state;
    return this.markDocumentPendingSave(
      imageNodesToCanvasDocument(this.stateValue.document, nodes),
    );
  }

  setRuntimeNodes(nodes: readonly CanvasFlowNode[]): LocalCanvasShellState {
    if (!this.stateValue.canvasId) return this.state;
    return this.markDocumentPendingSave(
      runtimeNodesToCanvasDocument(this.stateValue.document, nodes),
    );
  }

  setCanvasBranchCollapsed(
    nodeId: string,
    collapsed: boolean,
  ): LocalCanvasShellState {
    if (!this.stateValue.canvasId) return this.state;
    const current = this.stateValue.document.nodes.find(
      (node) => node.id === nodeId,
    );
    if (!current || current.branchCollapsed === collapsed) return this.state;
    return this.markDocumentPendingSave(
      parseCanvasDocumentV2({
        ...this.stateValue.document,
        nodes: this.stateValue.document.nodes.map((node) => {
          if (node.id !== nodeId) return { ...node };
          if (collapsed) return { ...node, branchCollapsed: true };
          const expanded = { ...node };
          delete expanded.branchCollapsed;
          return expanded;
        }),
      }),
    );
  }

  setRuntimeEdges(edges: readonly CanvasEdgeFlow[]): LocalCanvasShellState {
    if (!this.stateValue.canvasId) return this.state;
    return this.markDocumentPendingSave(
      runtimeEdgesToCanvasDocument(this.stateValue.document, edges),
      false,
    );
  }

  removeImageNodes(nodeIds: readonly string[]): LocalCanvasShellState {
    return this.removeCanvasNodes(nodeIds);
  }

  removeCanvasNodes(nodeIds: readonly string[]): LocalCanvasShellState {
    if (nodeIds.length === 0) return this.state;
    const removed = new Set(nodeIds);
    return this.markDocumentPendingSave(
      parseCanvasDocumentV2({
        ...this.stateValue.document,
        nodes: this.stateValue.document.nodes.filter(
          (node) => !removed.has(node.id),
        ),
        edges: this.stateValue.document.edges.filter(
          (edge) =>
            !removed.has(edge.sourceNodeId) && !removed.has(edge.targetNodeId),
        ),
      }),
    );
  }

  insertCanvasNodes(nodes: readonly CanvasNode[]): LocalCanvasShellState {
    if (!this.stateValue.canvasId || nodes.length === 0) return this.state;
    const existing = new Set(
      this.stateValue.document.nodes.map((node) => node.id),
    );
    const additions = nodes
      .filter((node) => !existing.has(node.id))
      .map((node) => clone(node));
    if (additions.length === 0) return this.state;
    return this.markDocumentPendingSave(
      parseCanvasDocumentV2({
        ...this.stateValue.document,
        nodes: [...this.stateValue.document.nodes, ...additions],
      }),
    );
  }

  insertTextNode(node: CanvasTextFlowNode): LocalCanvasShellState {
    if (!this.stateValue.canvasId) return this.state;
    if (
      this.stateValue.document.nodes.some((existing) => existing.id === node.id)
    ) {
      return this.state;
    }
    const textNode: CanvasTextNode = {
      id: node.id,
      kind: "text",
      markdown: node.data.markdown,
      style: { ...node.data.style },
      position: { ...node.position },
      size: {
        width: typeof node.style?.width === "number" ? node.style.width : 240,
        height: typeof node.style?.height === "number" ? node.style.height : 56,
      },
      zIndex:
        typeof node.zIndex === "number"
          ? node.zIndex
          : this.stateValue.document.nodes.reduce(
              (maximum, current) => Math.max(maximum, current.zIndex),
              0,
            ) + 1,
    };
    return this.markDocumentPendingSave(
      parseCanvasDocumentV2({
        ...this.stateValue.document,
        nodes: [...this.stateValue.document.nodes, textNode],
      }),
    );
  }

  insertTaskNode(node: CanvasTaskFlowNode): LocalCanvasShellState {
    if (!this.stateValue.canvasId) return this.state;
    if (
      this.stateValue.document.nodes.some((existing) => existing.id === node.id)
    ) {
      return this.state;
    }
    const taskNode = {
      id: node.id,
      kind: "task" as const,
      taskId: node.data.taskId,
      ...(node.data.lastKnownTitle === undefined
        ? {}
        : { lastKnownTitle: node.data.lastKnownTitle }),
      position: { ...node.position },
      size: {
        width: typeof node.style?.width === "number" ? node.style.width : 300,
        height:
          typeof node.style?.height === "number" ? node.style.height : 150,
      },
      zIndex:
        typeof node.zIndex === "number"
          ? node.zIndex
          : this.stateValue.document.nodes.reduce(
              (maximum, current) => Math.max(maximum, current.zIndex),
              0,
            ) + 1,
    };
    return this.markDocumentPendingSave(
      parseCanvasDocumentV2({
        ...this.stateValue.document,
        nodes: [...this.stateValue.document.nodes, taskNode],
      }),
    );
  }

  insertImageNodes(
    nodes: readonly CanvasImageFlowNode[],
  ): LocalCanvasShellState {
    if (!this.stateValue.canvasId || nodes.length === 0) return this.state;
    const existing = new Set(
      this.stateValue.document.nodes.map((node) => node.id),
    );
    let nextZIndex = this.stateValue.document.nodes.reduce(
      (maximum, node) => Math.max(maximum, node.zIndex),
      0,
    );
    const additions = nodes
      .filter((node) => !existing.has(node.id))
      .map((node) => ({
        id: node.id,
        kind: "image" as const,
        ...(node.data.fileId
          ? { fileId: node.data.fileId }
          : { assetId: node.data.assetId }),
        position: { ...node.position },
        size: {
          width: typeof node.style?.width === "number" ? node.style.width : 160,
          height:
            typeof node.style?.height === "number" ? node.style.height : 120,
        },
        zIndex: ++nextZIndex,
        aspectRatioLocked: true,
      }));
    return this.markDocumentPendingSave(
      parseCanvasDocumentV2({
        ...this.stateValue.document,
        nodes: [...this.stateValue.document.nodes, ...additions],
      }),
    );
  }

  insertCanvasEdge(edge: CanvasEdgeV2): LocalCanvasShellState {
    if (!this.stateValue.canvasId) return this.state;
    if (
      this.stateValue.document.edges.some((current) => current.id === edge.id)
    )
      return this.state;
    return this.markDocumentPendingSave(
      parseCanvasDocumentV2({
        ...this.stateValue.document,
        edges: [...this.stateValue.document.edges, edge],
      }),
    );
  }

  updateCanvasEdge(
    edgeId: string,
    update: Pick<CanvasEdgeV2, "routing" | "arrows">,
  ): LocalCanvasShellState {
    if (!this.stateValue.canvasId) return this.state;
    const edge = this.stateValue.document.edges.find(
      (current) => current.id === edgeId,
    );
    if (!edge) return this.state;
    return this.markDocumentPendingSave(
      parseCanvasDocumentV2({
        ...this.stateValue.document,
        edges: this.stateValue.document.edges.map((current) =>
          current.id === edgeId ? { ...current, ...update } : current,
        ),
      }),
    );
  }

  removeCanvasEdges(edgeIds: readonly string[]): LocalCanvasShellState {
    if (edgeIds.length === 0) return this.state;
    const removed = new Set(edgeIds);
    return this.markDocumentPendingSave(
      parseCanvasDocumentV2({
        ...this.stateValue.document,
        edges: this.stateValue.document.edges.filter(
          (edge) => !removed.has(edge.id),
        ),
      }),
    );
  }

  setDocument(document: CanvasDocument): LocalCanvasShellState {
    return this.markDocumentPendingSave(parseCanvasDocumentV2(document));
  }

  undoDocument(): LocalCanvasShellState | null {
    if (!this.stateValue.canvasId || this.stateValue.autosaveBlocked)
      return null;
    const previous = this.documentHistory.undo(this.stateValue.document);
    if (!previous) return null;
    return this.markPendingSave({
      ...this.stateValue,
      document: previous,
    });
  }

  redoDocument(): LocalCanvasShellState | null {
    if (!this.stateValue.canvasId || this.stateValue.autosaveBlocked)
      return null;
    const next = this.documentHistory.redo(this.stateValue.document);
    if (!next) return null;
    return this.markPendingSave({
      ...this.stateValue,
      document: next,
    });
  }

  setTitle(title: string): LocalCanvasShellState {
    return this.markPendingSave({ ...this.stateValue, title });
  }

  async save(): Promise<CanvasSaveResult | null> {
    if (!this.stateValue.canvasId || this.stateValue.autosaveBlocked)
      return null;

    while (this.saveInFlight) {
      const inFlight = this.saveInFlight;
      const result = await inFlight;
      if (!this.hasPendingSave || this.stateValue.autosaveBlocked)
        return result;
    }

    const operation = this.performSave();
    this.saveInFlight = operation;
    try {
      return await operation;
    } finally {
      if (this.saveInFlight === operation) this.saveInFlight = null;
    }
  }

  async flushPendingSave(): Promise<CanvasSaveResult | null> {
    let result: CanvasSaveResult | null = null;
    while (
      this.stateValue.canvasId &&
      !this.stateValue.autosaveBlocked &&
      this.hasPendingSave
    ) {
      result = await this.save();
      if (!result || result.status === "conflict") break;
    }
    return result;
  }

  private async performSave(): Promise<CanvasSaveResult | null> {
    const current = this.stateValue;
    if (!current.canvasId || current.autosaveBlocked) return null;
    const saveMutationVersion = this.mutationVersion;
    this.stateValue = { ...current, status: "saving", error: null };
    try {
      const result = await this.repository.saveCanvas({
        workspaceId: this.workspaceId,
        canvasId: current.canvasId,
        expectedRevision: current.revision,
        title: current.title,
        document: parseCanvasDocumentV2(current.document),
      });
      if (result.status === "conflict") {
        this.stateValue = {
          ...this.stateValue,
          status: "conflict",
          conflictRevision: result.revision,
          autosaveBlocked: true,
          error: "This Canvas changed elsewhere. Reload to continue.",
        };
        return result;
      }
      this.savedMutationVersion = Math.max(
        this.savedMutationVersion,
        saveMutationVersion,
      );
      this.stateValue = {
        ...this.stateValue,
        revision: result.revision,
        status: this.hasPendingSave ? "saving" : "saved",
        conflictRevision: null,
        autosaveBlocked: false,
        error: null,
      };
      return result;
    } catch (error) {
      this.stateValue = {
        ...this.stateValue,
        status: "error",
        error: error instanceof Error ? error.message : "Canvas save failed.",
      };
      throw error;
    }
  }

  async saveViewport(viewport: CanvasViewport): Promise<void> {
    const current = this.stateValue;
    if (!current.canvasId) return;
    await this.repository.saveViewState({
      canvasId: current.canvasId,
      userId: this.userId,
      viewportX: viewport.x,
      viewportY: viewport.y,
      zoom: viewport.zoom,
      updatedAt: now(this.clock),
    });
    this.stateValue = { ...this.stateValue, viewport: { ...viewport } };
  }

  async reloadAfterConflict(): Promise<LocalCanvasShellState> {
    if (!this.stateValue.canvasId) return this.state;
    return this.openCanvas(this.stateValue.canvasId);
  }
}
