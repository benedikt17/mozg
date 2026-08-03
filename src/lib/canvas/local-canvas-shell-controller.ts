import {
  createEmptyCanvasDocumentV2,
  parseCanvasDocumentV2,
  type CanvasDocument,
  type CanvasDocumentV2,
  type CanvasEdgeV2,
  type CanvasViewport,
  type CanvasTextNode,
} from "@/lib/canvas/canvas-document";
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
  private stateValue: LocalCanvasShellState = emptyShellState();

  constructor(options: LocalCanvasShellControllerOptions) {
    this.repository = options.repository;
    this.workspaceId = options.workspaceId;
    this.userId = options.userId;
    this.clock = options.clock ?? (() => new Date());
  }

  get state(): LocalCanvasShellState {
    return clone(this.stateValue);
  }

  restoreRuntimeState(state: LocalCanvasShellState): LocalCanvasShellState {
    this.stateValue = clone(state);
    return this.state;
  }

  async listCanvases(): Promise<CanvasSummary[]> {
    return this.repository.listCanvases(this.workspaceId);
  }

  async createCanvas(
    title: string,
    groupId: string | null = null,
  ): Promise<LocalCanvasShellState> {
    const canvas = await this.repository.createCanvas({
      workspaceId: this.workspaceId,
      title,
      groupId,
    });
    return this.hydrate(canvas, null);
  }

  async openCanvas(canvasId: string): Promise<LocalCanvasShellState> {
    this.stateValue = { ...this.stateValue, status: "loading", error: null };
    const canvas = await this.repository.loadCanvas({
      workspaceId: this.workspaceId,
      canvasId,
    });
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
    return this.hydrate(canvas, viewState);
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
    return this.state;
  }

  setImageNodes(nodes: readonly CanvasImageFlowNode[]): LocalCanvasShellState {
    if (!this.stateValue.canvasId) return this.state;
    this.stateValue = {
      ...this.stateValue,
      document: imageNodesToCanvasDocument(this.stateValue.document, nodes),
      status: "saving",
      error: null,
    };
    return this.state;
  }

  setRuntimeNodes(nodes: readonly CanvasFlowNode[]): LocalCanvasShellState {
    if (!this.stateValue.canvasId) return this.state;
    this.stateValue = {
      ...this.stateValue,
      document: runtimeNodesToCanvasDocument(this.stateValue.document, nodes),
      status: "saving",
      error: null,
    };
    return this.state;
  }

  setRuntimeEdges(edges: readonly CanvasEdgeFlow[]): LocalCanvasShellState {
    if (!this.stateValue.canvasId) return this.state;
    this.stateValue = {
      ...this.stateValue,
      document: runtimeEdgesToCanvasDocument(this.stateValue.document, edges),
      status: "saving",
      error: null,
    };
    return this.state;
  }

  removeImageNodes(nodeIds: readonly string[]): LocalCanvasShellState {
    return this.removeCanvasNodes(nodeIds);
  }

  removeCanvasNodes(nodeIds: readonly string[]): LocalCanvasShellState {
    if (nodeIds.length === 0) return this.state;
    const removed = new Set(nodeIds);
    this.stateValue = {
      ...this.stateValue,
      document: parseCanvasDocumentV2({
        ...this.stateValue.document,
        nodes: this.stateValue.document.nodes.filter(
          (node) => !removed.has(node.id),
        ),
        edges: this.stateValue.document.edges.filter(
          (edge) =>
            !removed.has(edge.sourceNodeId) && !removed.has(edge.targetNodeId),
        ),
      }),
      status: "saving",
      error: null,
    };
    return this.state;
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
      position: { ...node.position },
      size: {
        width: typeof node.style?.width === "number" ? node.style.width : 320,
        height:
          typeof node.style?.height === "number" ? node.style.height : 220,
      },
      zIndex:
        typeof node.zIndex === "number"
          ? node.zIndex
          : this.stateValue.document.nodes.reduce(
              (maximum, current) => Math.max(maximum, current.zIndex),
              0,
            ) + 1,
    };
    this.stateValue = {
      ...this.stateValue,
      document: parseCanvasDocumentV2({
        ...this.stateValue.document,
        nodes: [...this.stateValue.document.nodes, textNode],
      }),
      status: "saving",
      error: null,
    };
    return this.state;
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
    this.stateValue = {
      ...this.stateValue,
      document: parseCanvasDocumentV2({
        ...this.stateValue.document,
        nodes: [...this.stateValue.document.nodes, taskNode],
      }),
      status: "saving",
      error: null,
    };
    return this.state;
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
        assetId: node.data.assetId,
        position: { ...node.position },
        size: {
          width: typeof node.style?.width === "number" ? node.style.width : 160,
          height:
            typeof node.style?.height === "number" ? node.style.height : 120,
        },
        zIndex: ++nextZIndex,
        aspectRatioLocked: true,
      }));
    this.stateValue = {
      ...this.stateValue,
      document: parseCanvasDocumentV2({
        ...this.stateValue.document,
        nodes: [...this.stateValue.document.nodes, ...additions],
      }),
      status: "saving",
      error: null,
    };
    return this.state;
  }

  insertCanvasEdge(edge: CanvasEdgeV2): LocalCanvasShellState {
    if (!this.stateValue.canvasId) return this.state;
    if (
      this.stateValue.document.edges.some((current) => current.id === edge.id)
    )
      return this.state;
    this.stateValue = {
      ...this.stateValue,
      document: parseCanvasDocumentV2({
        ...this.stateValue.document,
        edges: [...this.stateValue.document.edges, edge],
      }),
      status: "saving",
      error: null,
    };
    return this.state;
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
    this.stateValue = {
      ...this.stateValue,
      document: parseCanvasDocumentV2({
        ...this.stateValue.document,
        edges: this.stateValue.document.edges.map((current) =>
          current.id === edgeId ? { ...current, ...update } : current,
        ),
      }),
      status: "saving",
      error: null,
    };
    return this.state;
  }

  removeCanvasEdges(edgeIds: readonly string[]): LocalCanvasShellState {
    if (edgeIds.length === 0) return this.state;
    const removed = new Set(edgeIds);
    this.stateValue = {
      ...this.stateValue,
      document: parseCanvasDocumentV2({
        ...this.stateValue.document,
        edges: this.stateValue.document.edges.filter(
          (edge) => !removed.has(edge.id),
        ),
      }),
      status: "saving",
      error: null,
    };
    return this.state;
  }

  setDocument(document: CanvasDocument): LocalCanvasShellState {
    this.stateValue = {
      ...this.stateValue,
      document: parseCanvasDocumentV2(document),
      status: "saving",
      error: null,
    };
    return this.state;
  }

  setTitle(title: string): LocalCanvasShellState {
    this.stateValue = { ...this.stateValue, title, status: "saving" };
    return this.state;
  }

  async save(): Promise<CanvasSaveResult | null> {
    const current = this.stateValue;
    if (!current.canvasId || current.autosaveBlocked) return null;
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
      this.stateValue = {
        ...this.stateValue,
        revision: result.revision,
        status: "saved",
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
