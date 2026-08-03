"use client";

import {
  Background,
  ConnectionMode,
  Controls,
  EdgeToolbar,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useEdgesState,
  useNodesState,
  useInternalNode,
  useReactFlow,
  type Connection,
  type ConnectionLineComponentProps,
  type EdgeChange,
  type EdgeProps,
  type InternalNode,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent as ReactDragEvent,
} from "react";
import {
  attachCanvasImagePasteListener,
  createObjectUrlRegistry,
  eventTouchesEditingSurface,
  shouldPreventCanvasImagePaste,
  shouldPreventFileNavigation,
  transferHasSupportedImage,
  transferHasFiles,
  type CanvasImageTransferPayload,
} from "@/lib/canvas/canvas-image-ingestion";
import {
  isCurrentViewportInitialization,
  isProgrammaticViewportMove,
  scheduleViewportReveal,
  type CanvasViewportInitialization,
} from "@/lib/canvas/canvas-viewport-initialization";
import {
  CANVAS_IMAGE_NODE_TYPE,
  CANVAS_TASK_NODE_TYPE,
  CANVAS_TEXT_NODE_TYPE,
  CANVAS_EDGE_TYPE,
  canvasDocumentToEdges,
  canvasDocumentToImageNodes,
  canvasDocumentToTaskNodes,
  canvasDocumentToTextNodes,
  createCanvasTaskFlowNode,
  createCanvasTaskId,
  createCanvasEdgeFromConnection,
  createCanvasTextFlowNode,
  ingestCanvasImageTransferToNodes,
  restoreCanvasImageNodes,
  updateCanvasEdgeFlowRuntime,
  type CanvasImageAdapterDependencies,
  type CanvasFlowNode,
  type CanvasEdgeFlow,
  type CanvasEdgeFlowData,
  type CanvasImageFlowNode,
  type CanvasTaskFlowNode,
  type CanvasTextFlowNode,
  type FlowPosition,
} from "@/lib/canvas/react-flow-canvas-adapter";
import type {
  CanvasEdgeArrows,
  CanvasEdgeV2,
  CanvasEdgeRouting,
  CanvasHandleSide,
} from "@/lib/canvas/canvas-document";
import {
  canvasArrowsToEndpointArrows,
  endpointArrowsToCanvasArrows,
  swapCanvasEdgeArrows,
} from "@/lib/canvas/canvas-edge-controls";
import {
  canvasHandleCenterToPerimeter,
  canvasNodePerimeterAnchor,
  type CanvasNodeBounds,
} from "@/lib/canvas/canvas-edge-geometry";
import {
  findShortestCanvasHandlePair,
  recomputeCanvasRuntimeEdgeHandles,
  type CanvasNodeBoundsRecord,
} from "@/lib/canvas/canvas-shortest-handle-pair";
import {
  createCanvasTextId,
  hasMeaningfulPlainText,
  plainTextFromClipboard,
  commitTextMarkdown,
} from "@/lib/canvas/text-canvas-interactions";
import { MarkdownStringPreview } from "@/prototype/knowledge/markdown-document-preview";
import type {
  CanvasTaskBridge,
  CanvasTaskProjection,
} from "@/lib/canvas/canvas-task-bridge";
import {
  type CanvasAssetRepository,
  type CanvasRepository,
  type CanvasSummary,
  type CanvasViewStateRepository,
} from "@/lib/canvas/local-canvas-repository";
import {
  emptyShellState,
  LocalCanvasShellController,
  type LocalCanvasShellState,
} from "@/lib/canvas/local-canvas-shell-controller";
import type {
  CloudCanvasRuntimeCache,
  CanvasImageRuntimePayload,
  CloudCanvasRuntimeSnapshot,
} from "@/lib/canvas/cloud-canvas-runtime-cache";
import { shouldCloseCanvasTaskDetails } from "@/lib/canvas/canvas-task-selection";
import {
  CanvasEdgeMarkerDefinitions,
  CanvasVisibleEdge,
} from "@/lib/canvas/canvas-visible-edge";
import { CanvasNodeFrame, ConnectionHandleLayer } from "./canvas-node-frame";
import styles from "./infinite-canvas-local-shell.module.css";

type RestoreStats = {
  reads: number;
  maxConcurrency: number;
  missing: number;
};

const EMPTY_RESTORE_STATS: RestoreStats = {
  reads: 0,
  maxConcurrency: 0,
  missing: 0,
};

function canvasFlowNodeBounds(
  node: CanvasFlowNode,
): CanvasNodeBoundsRecord | null {
  const width = node.measured?.width ?? node.width ?? node.style?.width;
  const height = node.measured?.height ?? node.height ?? node.style?.height;
  if (typeof width !== "number" || typeof height !== "number") return null;
  return {
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    width,
    height,
  };
}

function canvasInternalNodeBounds(
  node: InternalNode<CanvasFlowNode> | undefined,
): CanvasNodeBounds | null {
  if (!node) return null;
  const width = node.measured.width ?? node.width ?? node.style?.width;
  const height = node.measured.height ?? node.height ?? node.style?.height;
  if (typeof width !== "number" || typeof height !== "number") return null;
  return {
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    width,
    height,
  };
}

function canvasFlowNodeBoundsRecords(
  nodes: readonly CanvasFlowNode[],
): CanvasNodeBoundsRecord[] {
  return nodes.flatMap((node) => {
    const bounds = canvasFlowNodeBounds(node);
    return bounds ? [bounds] : [];
  });
}

function autoAttachCanvasEdge(
  edge: CanvasEdgeV2,
  bounds: readonly CanvasNodeBoundsRecord[],
): CanvasEdgeV2 {
  const boundsById = new Map(bounds.map((node) => [node.id, node]));
  const sourceBounds = boundsById.get(edge.sourceNodeId);
  const targetBounds = boundsById.get(edge.targetNodeId);
  if (!sourceBounds || !targetBounds) return edge;
  const pair = findShortestCanvasHandlePair(sourceBounds, targetBounds);
  return {
    ...edge,
    sourceHandle: pair.sourceHandle,
    targetHandle: pair.targetHandle,
  };
}

function transferPayload(
  event: ClipboardEvent | DragEvent,
): CanvasImageTransferPayload {
  const transfer =
    "clipboardData" in event ? event.clipboardData : event.dataTransfer;
  return {
    items: transfer ? Array.from(transfer.items) : [],
    files: transfer ? Array.from(transfer.files) : [],
    types: transfer ? Array.from(transfer.types) : [],
  };
}

function ImageNodeBody({
  data,
  selected,
}: NodeProps<CanvasImageFlowNode>): React.JSX.Element {
  return (
    <CanvasNodeFrame
      selected={selected}
      minWidth={120}
      minHeight={80}
      keepAspectRatio
      className={styles.imageNodeFrame}
      connectionHandleLayer={<ConnectionHandleLayer selected={selected} />}
    >
      {data.objectUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.image}
          src={data.objectUrl}
          alt={`Canvas asset ${data.assetId}`}
          draggable={false}
        />
      ) : (
        <div className={styles.image} aria-label="Loading canvas image" />
      )}
    </CanvasNodeFrame>
  );
}

function TextNodeBody({
  data,
  selected,
  id,
}: NodeProps<CanvasTextFlowNode>): React.JSX.Element {
  const [draft, setDraft] = useState(data.markdown);
  const update = (value: string) => {
    setDraft(value);
    window.dispatchEvent(
      new CustomEvent("mozg:canvas-text-draft", {
        detail: { id, markdown: value },
      }),
    );
  };
  const commit = () => {
    window.dispatchEvent(
      new CustomEvent("mozg:canvas-text-commit", {
        detail: { id, markdown: commitTextMarkdown(draft) },
      }),
    );
  };
  const cancel = () => {
    setDraft(data.markdown);
    window.dispatchEvent(
      new CustomEvent("mozg:canvas-text-cancel", { detail: { id } }),
    );
  };
  return (
    <CanvasNodeFrame
      selected={selected}
      minWidth={180}
      minHeight={100}
      className={styles.textNodeFrame}
      connectionHandleLayer={<ConnectionHandleLayer selected={selected} />}
    >
      <div
        className={styles.textNodeContent}
        onDoubleClick={(event) => {
          event.stopPropagation();
          window.dispatchEvent(
            new CustomEvent("mozg:canvas-text-edit", { detail: { id } }),
          );
        }}
      >
        {data.isEditing ? (
          <div className={styles.textEditor}>
            <textarea
              autoFocus
              value={draft}
              aria-label="Markdown text"
              className="nodrag nopan nowheel"
              onChange={(event) => update(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancel();
                } else if (
                  event.key === "Enter" &&
                  (event.ctrlKey || event.metaKey)
                ) {
                  event.preventDefault();
                  commit();
                }
              }}
              onPaste={(event) => event.stopPropagation()}
            />
            <div className={styles.textEditorActions}>
              <button type="button" className={styles.button} onClick={cancel}>
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.primary}`}
                onClick={commit}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.textPreview}>
            <MarkdownStringPreview contentId={id} markdown={data.markdown} />
          </div>
        )}
      </div>
    </CanvasNodeFrame>
  );
}

function TaskNodeBody({
  data,
  id,
  selected,
}: NodeProps<CanvasTaskFlowNode>): React.JSX.Element {
  const runtimeKey = `${data.taskWorkspaceId ?? "none"}:${data.taskId}:${data.taskBridge ? "ready" : "waiting"}`;
  const [projectionState, setProjectionState] = useState<{
    key: string;
    projection: CanvasTaskProjection | null;
  }>({ key: "", projection: null });
  const [mutationState, setMutationState] = useState({
    key: "",
    hasError: false,
  });
  const [contentMinHeight, setContentMinHeight] = useState(120);
  const taskContentRef = useRef<HTMLDivElement | null>(null);
  const reactFlow = useReactFlow<CanvasFlowNode>();
  const projection =
    projectionState.key === runtimeKey ? projectionState.projection : undefined;
  const mutationError =
    mutationState.key === runtimeKey && mutationState.hasError;

  useEffect(() => {
    if (!data.taskBridge || !data.taskWorkspaceId) {
      return;
    }
    let active = true;
    const unsubscribe = data.taskBridge.subscribeToTask(
      data.taskWorkspaceId,
      data.taskId,
      (nextProjection) => {
        if (active)
          setProjectionState({ key: runtimeKey, projection: nextProjection });
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [data.taskBridge, data.taskId, data.taskWorkspaceId, runtimeKey]);

  const resolved = projection !== undefined && projection !== null;
  const title = projection?.title ?? data.lastKnownTitle ?? "Задача";
  const missingLabel = data.taskBridge
    ? "Задача недоступна"
    : "Подключение задач…";

  const toggleCompleted = (): void => {
    if (!data.taskBridge || !data.taskWorkspaceId || !resolved) return;
    setMutationState({ key: runtimeKey, hasError: false });
    void Promise.resolve(
      data.taskBridge.toggleTaskCompleted(data.taskWorkspaceId, data.taskId),
    ).catch(() => setMutationState({ key: runtimeKey, hasError: true }));
  };

  const toggleSubtaskCompleted = (subtaskId: string): void => {
    if (!data.taskBridge || !data.taskWorkspaceId || !resolved) return;
    void Promise.resolve(
      data.taskBridge.toggleSubtaskCompleted(
        data.taskWorkspaceId,
        data.taskId,
        subtaskId,
      ),
    ).catch(() => undefined);
  };

  const activateNode = (): void => {
    reactFlow.setNodes((current) =>
      current.map((node) => {
        const nextSelected = node.id === id;
        return node.selected === nextSelected
          ? node
          : { ...node, selected: nextSelected };
      }),
    );
  };

  const openDetails = (): void => {
    if (!data.taskBridge) return;
    activateNode();
    data.taskBridge.openTask(data.taskId);
  };

  const toggleDetails = (): void => {
    if (!data.taskBridge || !resolved) return;
    if (projection?.detailsOpen) data.taskBridge.closeTaskDetails(data.taskId);
    else openDetails();
  };

  const subtasks = projection?.subtasks ?? [];
  const onContentHeightChange = data.onContentHeightChange;

  const measureContentHeight = useCallback((): void => {
    const content = taskContentRef.current;
    if (!content || !onContentHeightChange) return;
    const requiredHeight = Math.max(120, Math.ceil(content.scrollHeight + 18));
    setContentMinHeight((current) =>
      current === requiredHeight ? current : requiredHeight,
    );
    onContentHeightChange(id, requiredHeight);
  }, [id, onContentHeightChange]);

  useEffect(() => {
    measureContentHeight();
    const content = taskContentRef.current;
    if (!content || !onContentHeightChange) return;
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measureContentHeight);
    observer.observe(content);
    return () => observer.disconnect();
  }, [
    measureContentHeight,
    mutationError,
    onContentHeightChange,
    projection,
    title,
  ]);

  return (
    <CanvasNodeFrame
      selected={selected}
      minWidth={220}
      minHeight={contentMinHeight}
      className={styles.taskNodeFrame}
      connectionHandleLayer={<ConnectionHandleLayer selected={selected} />}
    >
      <div
        ref={taskContentRef}
        className={styles.taskNodeContent}
        onDoubleClick={(event) => {
          event.stopPropagation();
          openDetails();
        }}
      >
        <div className={styles.taskNodeHeader}>
          <span className={styles.taskNodeType}>Задача</span>
          <span className={styles.taskNodeReference} title={data.taskId}>
            {data.taskId}
          </span>
        </div>
        <div className={styles.taskNodeBody}>
          <input
            type="checkbox"
            className="nodrag nopan"
            checked={projection?.completed ?? false}
            disabled={!resolved}
            aria-label={`Завершить задачу «${title}»`}
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => {
              event.stopPropagation();
              toggleCompleted();
            }}
          />
          <strong
            className={resolved ? undefined : styles.taskNodeMissingTitle}
          >
            {title}
          </strong>
        </div>
        {resolved ? (
          <span className={styles.taskNodeStatus}>
            {projection.completed ? "Выполнено" : "В работе"}
          </span>
        ) : (
          <span className={styles.taskNodeMissing} role="status">
            {missingLabel}
          </span>
        )}
        {subtasks.length > 0 ? (
          <ul className={styles.taskNodeSubtasks} aria-label="Подзадачи">
            {subtasks.map((subtask) => (
              <li
                className={`${styles.taskNodeSubtask} ${subtask.completed ? styles.taskNodeSubtaskComplete : ""}`}
                key={subtask.id}
              >
                <input
                  aria-label={`${subtask.completed ? "Отметить невыполненной" : "Отметить выполненной"}: ${subtask.title}`}
                  checked={subtask.completed}
                  className="nodrag nopan"
                  disabled={!resolved}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    event.stopPropagation();
                    toggleSubtaskCompleted(subtask.id);
                  }}
                  type="checkbox"
                />
                <span title={subtask.title}>{subtask.title}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {mutationError ? (
          <span className={styles.taskNodeError} role="alert">
            Не удалось изменить задачу
          </span>
        ) : null}
        <button
          type="button"
          className={`${styles.taskNodeDetails} nodrag nopan`}
          disabled={!data.taskBridge || !resolved}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            toggleDetails();
          }}
        >
          {projection?.detailsOpen ? "Закрыть детали" : "Открыть детали"}
        </button>
      </div>
    </CanvasNodeFrame>
  );
}

export function CanvasEdgeBody({
  id,
  source,
  sourcePosition,
  targetPosition,
  target,
  selected,
  data,
  markerStart,
  markerEnd,
}: EdgeProps<CanvasEdgeFlow>): React.JSX.Element | null {
  const [lineTypeOpen, setLineTypeOpen] = useState(false);
  const sourceNode = useInternalNode<CanvasFlowNode>(source);
  const targetNode = useInternalNode<CanvasFlowNode>(target);
  const sourcePositionSide = sourcePosition as CanvasHandleSide;
  const targetPositionSide = targetPosition as CanvasHandleSide;
  const sourceBounds = canvasInternalNodeBounds(sourceNode);
  const targetBounds = canvasInternalNodeBounds(targetNode);
  if (!sourceBounds || !targetBounds) return null;
  const sourceAnchor = canvasNodePerimeterAnchor(
    sourceBounds,
    sourcePositionSide,
  );
  const targetAnchor = canvasNodePerimeterAnchor(
    targetBounds,
    targetPositionSide,
  );
  const [path, labelX, labelY] =
    data?.routing === "orthogonal"
      ? getSmoothStepPath({
          sourceX: sourceAnchor.x,
          sourceY: sourceAnchor.y,
          sourcePosition,
          targetX: targetAnchor.x,
          targetY: targetAnchor.y,
          targetPosition,
        })
      : data?.routing === "straight"
        ? getStraightPath({
            sourceX: sourceAnchor.x,
            sourceY: sourceAnchor.y,
            targetX: targetAnchor.x,
            targetY: targetAnchor.y,
          })
        : getBezierPath({
            sourceX: sourceAnchor.x,
            sourceY: sourceAnchor.y,
            sourcePosition,
            targetX: targetAnchor.x,
            targetY: targetAnchor.y,
            targetPosition,
          });
  const arrows = data?.arrows ?? "none";
  const endpointArrows = canvasArrowsToEndpointArrows(arrows);
  const routing = data?.routing ?? "curved";
  const stopToolbarEvent = (event: React.SyntheticEvent): void => {
    event.stopPropagation();
  };
  return (
    <>
      <CanvasVisibleEdge
        id={id}
        path={path}
        className={selected ? styles.selectedEdge : styles.canvasEdge}
        markerStart={markerStart}
        markerEnd={markerEnd}
        interactionWidth={24}
      />
      {selected ? (
        <EdgeToolbar
          edgeId={id}
          x={labelX}
          y={labelY}
          isVisible={selected}
          alignY="top"
          className={`${styles.edgeToolbar} nodrag nopan nowheel`}
          onPointerDown={stopToolbarEvent}
          onPointerUp={stopToolbarEvent}
          onClick={stopToolbarEvent}
          onWheel={stopToolbarEvent}
        >
          <button
            type="button"
            className={`${styles.edgeToolButton} nodrag nopan nowheel`}
            aria-label="Переключить стрелку в начале линии"
            aria-pressed={endpointArrows.source}
            title="Стрелка в начале"
            onClick={() =>
              data?.onUpdate?.(id, {
                routing,
                arrows: endpointArrowsToCanvasArrows({
                  source: !endpointArrows.source,
                  target: endpointArrows.target,
                }),
              })
            }
          >
            {endpointArrows.source ? "◀" : "○"}
          </button>
          <button
            type="button"
            className={`${styles.edgeToolButton} nodrag nopan nowheel`}
            aria-label="Поменять стрелки местами"
            title="Поменять стрелки местами"
            onClick={() =>
              data?.onUpdate?.(id, {
                routing,
                arrows: swapCanvasEdgeArrows(arrows),
              })
            }
          >
            ↔
          </button>
          <button
            type="button"
            className={`${styles.edgeToolButton} nodrag nopan nowheel`}
            aria-label="Переключить стрелку в конце линии"
            aria-pressed={endpointArrows.target}
            title="Стрелка в конце"
            onClick={() =>
              data?.onUpdate?.(id, {
                routing,
                arrows: endpointArrowsToCanvasArrows({
                  source: endpointArrows.source,
                  target: !endpointArrows.target,
                }),
              })
            }
          >
            {endpointArrows.target ? "▶" : "○"}
          </button>
          <button
            type="button"
            className={`${styles.edgeToolButton} nodrag nopan nowheel`}
            aria-label="Тип линии: открыть выбор"
            aria-expanded={lineTypeOpen}
            title="Тип линии"
            onClick={(event) => {
              stopToolbarEvent(event);
              setLineTypeOpen((open) => !open);
            }}
          >
            {routing === "orthogonal"
              ? "┐"
              : routing === "straight"
                ? "／"
                : "⌒"}
          </button>
          {lineTypeOpen ? (
            <div className={styles.edgeLinePopover} role="menu">
              {(
                [
                  ["orthogonal", "┐", "Прямоугольная"],
                  ["curved", "⌒", "Дугообразная"],
                  ["straight", "／", "Прямая"],
                ] as const
              ).map(([value, glyph, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.edgeLineOption} nodrag nopan nowheel`}
                  role="menuitemradio"
                  aria-checked={routing === value}
                  onClick={(event) => {
                    stopToolbarEvent(event);
                    setLineTypeOpen(false);
                    data?.onUpdate?.(id, {
                      routing: value,
                      arrows,
                    });
                  }}
                >
                  <span aria-hidden="true">{glyph}</span>
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          <label>
            Линия
            <select
              className="nodrag nopan"
              value={data?.routing ?? "curved"}
              onChange={(event) =>
                data?.onUpdate?.(id, {
                  routing: event.target.value as CanvasEdgeRouting,
                  arrows,
                })
              }
            >
              <option value="orthogonal">Прямоугольная</option>
              <option value="curved">Дугообразная</option>
              <option value="straight">Прямая</option>
            </select>
          </label>
          <label>
            Стрелки
            <select
              className="nodrag nopan"
              value={arrows}
              onChange={(event) =>
                data?.onUpdate?.(id, {
                  routing: data?.routing ?? "curved",
                  arrows: event.target.value as CanvasEdgeArrows,
                })
              }
            >
              <option value="none">Нет</option>
              <option value="start">В начале</option>
              <option value="end">В конце</option>
              <option value="both">С обеих сторон</option>
            </select>
          </label>
        </EdgeToolbar>
      ) : null}
    </>
  );
}

function CanvasConnectionLine({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
  toHandle,
  connectionStatus,
}: ConnectionLineComponentProps<CanvasFlowNode>): React.JSX.Element {
  const source = canvasHandleCenterToPerimeter(
    { x: fromX, y: fromY },
    fromPosition as CanvasHandleSide,
  );
  const target = toHandle
    ? canvasHandleCenterToPerimeter(
        { x: toX, y: toY },
        toPosition as CanvasHandleSide,
      )
    : { x: toX, y: toY };
  const [path] = getBezierPath({
    sourceX: source.x,
    sourceY: source.y,
    sourcePosition: fromPosition,
    targetX: target.x,
    targetY: target.y,
    targetPosition: toPosition,
  });
  return (
    <path
      d={path}
      fill="none"
      className={styles.connectionPreview}
      data-status={connectionStatus ?? "pending"}
    />
  );
}

const nodeTypes = {
  [CANVAS_IMAGE_NODE_TYPE]: ImageNodeBody,
  [CANVAS_TASK_NODE_TYPE]: TaskNodeBody,
  [CANVAS_TEXT_NODE_TYPE]: TextNodeBody,
};

const edgeTypes = {
  [CANVAS_EDGE_TYPE]: CanvasEdgeBody,
};

export type CanvasShellCopy = {
  eyebrow: string;
  defaultTitle: string;
  emptyTitle: string;
  emptyDescription: string;
  create: string;
  rename: string;
  newCanvas: string;
  delete: string;
  addImage: string;
  text: string;
  saved: string;
  saving: string;
  conflict: string;
  loading: string;
  error: string;
  reloadWinner: string;
  isolated: string;
  status: string;
};

type CanvasShellRepository = CanvasRepository &
  CanvasViewStateRepository & {
    close?: () => void;
    setActiveCanvas?: (canvasId: string | null) => void;
  };

type CanvasLoadingLifecycle =
  | "list-loading"
  | "empty-confirmed"
  | "canvas-selected"
  | "document-loading"
  | "skeleton-ready"
  | "content-hydrating"
  | "ready"
  | "error";

function InfiniteCanvasLocalShellSurface({
  activeTaskDetailsTaskId,
  assetRepository,
  embedded = false,
  copy,
  repository: providedRepository,
  runtimeCache,
  showDiagnostics,
  taskBridge,
  taskWorkspaceId,
  userId,
  workspaceId,
}: {
  activeTaskDetailsTaskId?: string;
  assetRepository: CanvasAssetRepository;
  embedded?: boolean;
  copy: CanvasShellCopy;
  repository: CanvasShellRepository;
  runtimeCache?: CloudCanvasRuntimeCache;
  showDiagnostics: boolean;
  taskBridge?: CanvasTaskBridge;
  taskWorkspaceId?: string;
  userId: string;
  workspaceId: string;
}): React.JSX.Element {
  const initialRuntimeRef = useRef<CloudCanvasRuntimeSnapshot | null>(
    runtimeCache?.getActive({ workspaceId, userId }) ?? null,
  );
  const initialRuntime = initialRuntimeRef.current;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const taskBridgeRef = useRef<CanvasTaskBridge | undefined>(taskBridge);
  const taskWorkspaceIdRef = useRef<string | undefined>(taskWorkspaceId);
  taskBridgeRef.current = taskBridge;
  taskWorkspaceIdRef.current = taskWorkspaceId;
  const pointerRef = useRef<FlowPosition | null>(null);
  const nodesRef = useRef<CanvasFlowNode[]>([]);
  const edgesRef = useRef<CanvasEdgeFlow[]>([]);
  const summariesRef = useRef<CanvasSummary[]>([]);
  const shellStateRef = useRef<LocalCanvasShellState>(
    initialRuntime?.shellState ?? emptyShellState(),
  );
  const assetPayloadsRef = useRef<Map<string, CanvasImageRuntimePayload>>(
    new Map(initialRuntime?.assetPayloads),
  );
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreControllerRef = useRef<AbortController | null>(null);
  const pendingContentHeightSaveRef = useRef(false);
  const nodeGeometrySignatureRef = useRef("");
  const hydratingRef = useRef(true);
  const canvasGenerationRef = useRef(0);
  const programmaticViewportRef = useRef<CanvasViewportInitialization | null>(
    null,
  );
  const screenToFlowRef = useRef<
    (point: { x: number; y: number }) => FlowPosition
  >(() => ({ x: 0, y: 0 }));
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasFlowNode>(
    [],
  );
  const [edges, setEdges] = useEdgesState<CanvasEdgeFlow>(
    [],
  );
  const [summaries, setSummaries] = useState<CanvasSummary[]>(
    initialRuntime?.summaries ?? [],
  );
  const [shellState, setShellState] = useState<LocalCanvasShellState>(
    initialRuntime?.shellState ?? emptyShellState,
  );
  const [loadingLifecycle, setLoadingLifecycle] =
    useState<CanvasLoadingLifecycle>(
      initialRuntime?.shellState.canvasId ? "ready" : "list-loading",
    );
  const [restoreStats, setRestoreStats] =
    useState<RestoreStats>(EMPTY_RESTORE_STATS);
  const [dropActive, setDropActive] = useState(false);
  const [newTitle, setNewTitle] = useState(copy.defaultTitle);
  const [renameTitle, setRenameTitle] = useState("");
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [taskQuery, setTaskQuery] = useState("");
  const [taskResults, setTaskResults] = useState<CanvasTaskProjection[]>([]);
  const [taskSearchStatus, setTaskSearchStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [flowInstanceEpoch, setFlowInstanceEpoch] = useState(0);
  const [viewportInitialization, setViewportInitialization] =
    useState<CanvasViewportInitialization | null>(null);
  const [viewportVisible, setViewportVisible] = useState(
    Boolean(initialRuntime?.shellState.canvasId),
  );
  const repository = providedRepository;
  const imageRepository = assetRepository;
  const shellWorkspaceId = workspaceId;
  const shellUserId = userId;
  const [objectUrls] = useState(
    () => initialRuntime?.objectUrls ?? createObjectUrlRegistry(),
  );
  const [controller] = useState(() =>
    (() => {
      const next = new LocalCanvasShellController({
        repository,
        workspaceId: shellWorkspaceId,
        userId: shellUserId,
      });
      if (initialRuntime) next.restoreRuntimeState(initialRuntime.shellState);
      return next;
    })(),
  );
  const reactFlow = useReactFlow<CanvasFlowNode>();

  useEffect(() => {
    const activeTaskId = activeTaskDetailsTaskId;
    if (
      !activeTaskId ||
      !taskBridge ||
      !shouldCloseCanvasTaskDetails(activeTaskId, nodes)
    )
      return;
    taskBridge.closeTaskDetails(activeTaskId);
  }, [activeTaskDetailsTaskId, nodes, taskBridge]);
  const adapterDependencies = useMemo<CanvasImageAdapterDependencies>(
    () => ({
      assetRepository: imageRepository,
      objectUrls,
      workspaceId: shellWorkspaceId,
    }),
    [imageRepository, objectUrls, shellWorkspaceId],
  );

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    summariesRef.current = summaries;
  }, [summaries]);

  useEffect(() => {
    shellStateRef.current = shellState;
  }, [shellState]);

  useEffect(() => {
    screenToFlowRef.current = reactFlow.screenToFlowPosition;
  }, [reactFlow.screenToFlowPosition]);

  useEffect(() => {
    setNodes((current) =>
      current.map((node) =>
        node.type === CANVAS_TASK_NODE_TYPE
          ? {
              ...node,
              data: {
                ...node.data,
                taskBridge,
                taskWorkspaceId,
              },
            }
          : node,
      ),
    );
  }, [setNodes, taskBridge, taskWorkspaceId]);

  useEffect(() => {
    if (!taskPickerOpen || !taskBridge || !taskWorkspaceId) {
      setTaskResults([]);
      setTaskSearchStatus("idle");
      return;
    }
    let active = true;
    setTaskSearchStatus("loading");
    void Promise.resolve(
      taskBridge.searchTasks(taskWorkspaceId, taskQuery),
    ).then(
      (results) => {
        if (!active) return;
        setTaskResults(results);
        setTaskSearchStatus("ready");
      },
      () => {
        if (!active) return;
        setTaskResults([]);
        setTaskSearchStatus("error");
      },
    );
    return () => {
      active = false;
    };
  }, [taskBridge, taskPickerOpen, taskQuery, taskWorkspaceId]);

  useEffect(() => {
    if (!taskPickerOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setTaskPickerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [taskPickerOpen]);

  const syncState = useCallback(
    () => setShellState(controller.state),
    [controller],
  );

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      if (hydratingRef.current) return;
      controller.setRuntimeNodes(nodesRef.current);
      controller.setRuntimeEdges(edgesRef.current);
      void controller.save().then(syncState).catch(syncState);
    }, 260);
  }, [controller, syncState]);

  useEffect(() => {
    const bounds = canvasFlowNodeBoundsRecords(nodes);
    const signature = bounds
      .map(
        (node) => `${node.id}:${node.x}:${node.y}:${node.width}:${node.height}`,
      )
      .join("|");
    if (signature === nodeGeometrySignatureRef.current) return;
    nodeGeometrySignatureRef.current = signature;

    const nextEdges = recomputeCanvasRuntimeEdgeHandles(
      edgesRef.current,
      bounds,
    );
    const handlesChanged = nextEdges.some(
      (edge, index) =>
        edge.sourceHandle !== edgesRef.current[index]?.sourceHandle ||
        edge.targetHandle !== edgesRef.current[index]?.targetHandle,
    );
    if (!handlesChanged) return;
    setEdges((current) => recomputeCanvasRuntimeEdgeHandles(current, bounds));
  }, [nodes, setEdges]);

  const handleEdgeUpdate = useCallback(
    (
      edgeId: string,
      update: Pick<CanvasEdgeFlowData, "routing" | "arrows">,
    ) => {
      const nextState = controller.updateCanvasEdge(edgeId, update);
      setEdges((current) =>
        current.map((edge) =>
          edge.id === edgeId ? updateCanvasEdgeFlowRuntime(edge, update) : edge,
        ),
      );
      setShellState(nextState);
      scheduleSave();
    },
    [controller, scheduleSave, setEdges],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      const edge = createCanvasEdgeFromConnection(connection);
      if (!edge) return;
      const attachedEdge = autoAttachCanvasEdge(
        edge,
        canvasFlowNodeBoundsRecords(nodesRef.current),
      );
      const previousEdgeCount = controller.state.document.edges.length;
      const nextState = controller.insertCanvasEdge(attachedEdge);
      if (nextState.document.edges.length > previousEdgeCount) {
        setEdges(canvasDocumentToEdges(nextState.document, handleEdgeUpdate));
        setShellState(nextState);
        scheduleSave();
      }
    },
    [controller, handleEdgeUpdate, scheduleSave, setEdges],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<CanvasEdgeFlow>[]) => {
      const removed = changes.filter(
        (
          change,
        ): change is Extract<EdgeChange<CanvasEdgeFlow>, { type: "remove" }> =>
          change.type === "remove",
      );
      if (removed.length > 0) {
        const nextState = controller.removeCanvasEdges(
          removed.map((change) => change.id),
        );
        setShellState(nextState);
        scheduleSave();
      }
      setEdges((current) => applyEdgeChanges(changes, current));
    },
    [controller, scheduleSave, setEdges],
  );

  const handleTaskNodeContentHeightChange = useCallback(
    (nodeId: string, requiredHeight: number): void => {
      const node = reactFlow
        .getNodes()
        .find(
          (current) =>
            current.id === nodeId && current.type === CANVAS_TASK_NODE_TYPE,
        );
      if (!node) return;
      const currentHeight = node.height ?? node.style?.height;
      if (typeof currentHeight !== "number") return;
      const nextHeight = Math.ceil(requiredHeight);
      if (nextHeight <= currentHeight) return;
      pendingContentHeightSaveRef.current = hydratingRef.current;
      setNodes((current) =>
        current.map((item) =>
          item.id === nodeId
            ? {
                ...item,
                height: nextHeight,
                style: { ...item.style, height: nextHeight },
              }
            : item,
        ),
      );
      if (!hydratingRef.current) scheduleSave();
    },
    [reactFlow, scheduleSave, setNodes],
  );

  const restoreForCanvas = useCallback(
    async (nextState: LocalCanvasShellState) => {
      restoreControllerRef.current?.abort();
      pendingContentHeightSaveRef.current = false;
      restoreControllerRef.current = new AbortController();
      assetPayloadsRef.current.clear();
      objectUrls.revokeAll();
      const signal = restoreControllerRef.current.signal;
      const placeholders: CanvasFlowNode[] = [
        ...canvasDocumentToImageNodes(nextState.document),
        ...canvasDocumentToTaskNodes(nextState.document, {
          onContentHeightChange: handleTaskNodeContentHeightChange,
          taskBridge: taskBridgeRef.current,
          taskWorkspaceId: taskWorkspaceIdRef.current,
        }),
        ...canvasDocumentToTextNodes(nextState.document),
      ];
      setNodes(placeholders);
      setEdges(canvasDocumentToEdges(nextState.document, handleEdgeUpdate));
      hydratingRef.current = true;
      setRestoreStats(EMPTY_RESTORE_STATS);
      setLoadingLifecycle("skeleton-ready");
      setLoadingLifecycle("content-hydrating");
      const result = await restoreCanvasImageNodes(
        nextState.document,
        adapterDependencies,
        {
          signal,
          cachedAssetPayloads: assetPayloadsRef.current,
          concurrency: 4,
          onNode: (node) => {
            if (signal.aborted) return;
            if (node.type === CANVAS_IMAGE_NODE_TYPE && node.data.objectUrl) {
              assetPayloadsRef.current.set(node.data.assetId, { objectUrl: node.data.objectUrl, mimeType: node.data.mimeType, intrinsicWidth: node.data.intrinsicWidth, intrinsicHeight: node.data.intrinsicHeight, source: node.data.source, variantKind: node.data.variantKind });
            }
            setNodes((current) => {
              const index = current.findIndex((item) => item.id === node.id);
              if (index < 0) return [...current, node];
              const copy = [...current];
              copy[index] = {
                ...node,
                position: { ...copy[index].position },
                style: copy[index].style,
              };
              return copy;
            });
          },
        },
      );
      if (signal.aborted) return;
      setRestoreStats({
        reads: result.assetReadCount,
        maxConcurrency: result.maxConcurrentAssetReads,
        missing: result.missingAssetIds.length,
      });
      hydratingRef.current = false;
      if (pendingContentHeightSaveRef.current) {
        pendingContentHeightSaveRef.current = false;
      }
      scheduleSave();
      setLoadingLifecycle("ready");
    },
    [
      adapterDependencies,
      handleEdgeUpdate,
      handleTaskNodeContentHeightChange,
      objectUrls,
      scheduleSave,
      setEdges,
      setNodes,
    ],
  );

  const openCanvas = useCallback(
    async (canvasId: string) => {
      const generation = ++canvasGenerationRef.current;
      hydratingRef.current = true;
      setLoadingLifecycle("canvas-selected");
      programmaticViewportRef.current = null;
      setViewportInitialization(null);
      setViewportVisible(false);
      setShellState((current) => ({
        ...current,
        status: "loading",
        error: null,
      }));
      setLoadingLifecycle("document-loading");
      const nextState = await controller.openCanvas(canvasId);
      if (generation !== canvasGenerationRef.current) return;
      repository.setActiveCanvas?.(canvasId);
      setShellState(nextState);
      setRenameTitle(nextState.title);
      setViewportInitialization({
        canvasId,
        generation,
        viewport: { ...nextState.viewport },
      });
      void restoreForCanvas(nextState).catch((error: unknown) => {
        if (generation !== canvasGenerationRef.current) return;
        setLoadingLifecycle("error");
        setShellState((current) => ({
          ...current,
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Canvas content loading failed.",
        }));
      });
    },
    [controller, repository, restoreForCanvas],
  );

  const openCanvasRef = useRef(openCanvas);
  openCanvasRef.current = openCanvas;

  const restoreCachedScene = useCallback(
    (snapshot: CloudCanvasRuntimeSnapshot): void => {
      const cachedState = controller.restoreRuntimeState(snapshot.shellState);
      if (!cachedState.canvasId) return;
      const generation = ++canvasGenerationRef.current;
      const skeleton: CanvasFlowNode[] = [...canvasDocumentToImageNodes(cachedState.document), ...canvasDocumentToTaskNodes(cachedState.document, { onContentHeightChange: handleTaskNodeContentHeightChange, taskBridge: taskBridgeRef.current, taskWorkspaceId: taskWorkspaceIdRef.current }), ...canvasDocumentToTextNodes(cachedState.document)];
      setNodes(skeleton.map((node) => node.type === CANVAS_IMAGE_NODE_TYPE && assetPayloadsRef.current.has(node.data.assetId) ? { ...node, data: { ...node.data, ...assetPayloadsRef.current.get(node.data.assetId) } } : node));
      setEdges(canvasDocumentToEdges(cachedState.document, handleEdgeUpdate));
      setShellState(cachedState); setRenameTitle(cachedState.title); hydratingRef.current = false; setLoadingLifecycle("ready");
      setViewportInitialization({ canvasId: cachedState.canvasId, generation, viewport: { ...cachedState.viewport } });
    },
    [controller, handleEdgeUpdate, handleTaskNodeContentHeightChange, setEdges, setNodes],
  );

  useEffect(() => {
    let active = true;
    const assetPayloads = assetPayloadsRef.current;
    if (initialRuntime) restoreCachedScene(initialRuntime);
    void controller
      .listCanvases()
      .then(async (items) => {
        if (!active) return;
        setSummaries(items);
        const cachedCanvasId = initialRuntime?.shellState.canvasId;
        const cachedSummary = cachedCanvasId
          ? items.find((item) => item.id === cachedCanvasId)
          : undefined;
        if (cachedSummary && initialRuntime) {
          const unchanged =
            cachedSummary.revision === initialRuntime.shellState.revision;
          if (unchanged) return;
          if (initialRuntime.shellState.status !== "saved") {
            setLoadingLifecycle("error");
            setShellState((current) => ({
              ...current,
              status: "conflict",
              autosaveBlocked: true,
              conflictRevision: cachedSummary.revision,
              error: "Canvas changed elsewhere. Reload to continue.",
            }));
            return;
          }
          await openCanvasRef.current(cachedSummary.id);
          return;
        }
        if (items[0]) await openCanvasRef.current(items[0].id);
        else {
          hydratingRef.current = false;
          setShellState(emptyShellState());
          setLoadingLifecycle("empty-confirmed");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadingLifecycle("error");
          setShellState((current) => ({
            ...current,
            status: "error",
            error:
              error instanceof Error ? error.message : "Canvas loading failed.",
          }));
        }
      });
    return () => {
      active = false;
      restoreControllerRef.current?.abort();
      let latestState = controller.state;
      if (saveTimerRef.current) {
        controller.setRuntimeNodes(nodesRef.current);
        latestState = controller.setRuntimeEdges(edgesRef.current);
      }
      if (runtimeCache && latestState.canvasId) {
        runtimeCache.set({
          workspaceId: shellWorkspaceId,
          userId: shellUserId,
          canvasId: latestState.canvasId,
          summaries: summariesRef.current,
          shellState: latestState,
          assetPayloads: new Map(assetPayloads),
          objectUrls,
        });
      } else {
        objectUrls.revokeAll();
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
      repository.close?.();
    };
  }, [
    controller,
    initialRuntime,
    objectUrls,
    repository,
    restoreCachedScene,
    runtimeCache,
    shellUserId,
    shellWorkspaceId,
  ]);

  useEffect(() => {
    if (!viewportInitialization) return;
    let active = true;
    let cancelReveal: () => void = () => undefined;
    programmaticViewportRef.current = viewportInitialization;
    void (async () => {
      const applied = await reactFlow.setViewport(
        viewportInitialization.viewport,
        { duration: 0 },
      );
      if (
        !active ||
        !applied ||
        !isCurrentViewportInitialization(
          viewportInitialization,
          canvasGenerationRef.current,
        )
      )
        return;
      cancelReveal = scheduleViewportReveal(() => {
        if (
          !active ||
          !isCurrentViewportInitialization(
            viewportInitialization,
            canvasGenerationRef.current,
          )
        )
          return;
        setViewportVisible(true);
      });
    })();
    return () => {
      active = false;
      cancelReveal();
    };
  }, [flowInstanceEpoch, reactFlow, viewportInitialization]);

  const centerPosition = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    return screenToFlowRef.current({
      x: (rect?.left ?? 0) + (rect?.width ?? 800) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? 600) / 2,
    });
  }, []);

  const setTextEditing = useCallback(
    (id: string, isEditing: boolean) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === id && node.type === CANVAS_TEXT_NODE_TYPE
            ? { ...node, data: { ...node.data, isEditing } }
            : node,
        ),
      );
    },
    [setNodes],
  );

  const commitTextNode = useCallback(
    (id: string, markdown: string) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === id && node.type === CANVAS_TEXT_NODE_TYPE
            ? { ...node, data: { markdown: commitTextMarkdown(markdown) } }
            : node,
        ),
      );
      const node = nodesRef.current.find(
        (candidate): candidate is CanvasTextFlowNode =>
          candidate.id === id && candidate.type === CANVAS_TEXT_NODE_TYPE,
      );
      if (node) {
        controller.setRuntimeNodes(
          nodesRef.current.map((candidate) =>
            candidate.id === id && candidate.type === CANVAS_TEXT_NODE_TYPE
              ? {
                  ...candidate,
                  data: { markdown: commitTextMarkdown(markdown) },
                }
              : candidate,
          ),
        );
        syncState();
        scheduleSave();
      }
    },
    [controller, scheduleSave, setNodes, syncState],
  );

  const createTextNode = useCallback(
    (client: FlowPosition | null, markdown: string, editing = true) => {
      if (!shellState.canvasId) return;
      const position = client
        ? screenToFlowRef.current(client)
        : centerPosition();
      const node = createCanvasTextFlowNode({
        id: createCanvasTextId(),
        markdown: commitTextMarkdown(markdown),
        position,
        isEditing: editing,
      });
      setNodes((current) => [...current, node]);
      controller.insertTextNode(node);
      syncState();
      if (!editing) scheduleSave();
    },
    [
      centerPosition,
      controller,
      scheduleSave,
      setNodes,
      shellState.canvasId,
      syncState,
    ],
  );

  const createTaskNode = useCallback(
    (task: CanvasTaskProjection) => {
      if (!shellState.canvasId || !taskBridge || !taskWorkspaceId) return;
      const position = centerPosition();
      const nextZIndex =
        shellState.document.nodes.reduce(
          (maximum, current) => Math.max(maximum, current.zIndex),
          0,
        ) + 1;
      const node = createCanvasTaskFlowNode({
        id: createCanvasTaskId(),
        taskId: task.id,
        lastKnownTitle: task.title,
        position,
        taskBridge,
        taskWorkspaceId,
        onContentHeightChange: handleTaskNodeContentHeightChange,
        zIndex: nextZIndex,
      });
      setNodes((current) => [
        ...current.map((item) => ({ ...item, selected: false })),
        { ...node, selected: true },
      ]);
      controller.insertTaskNode(node);
      syncState();
      scheduleSave();
      setTaskPickerOpen(false);
      setTaskQuery("");
    },
    [
      centerPosition,
      controller,
      handleTaskNodeContentHeightChange,
      scheduleSave,
      setNodes,
      shellState.canvasId,
      shellState.document.nodes,
      syncState,
      taskBridge,
      taskWorkspaceId,
    ],
  );

  useEffect(() => {
    const onEdit = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) setTextEditing(id, true);
    };
    const onCommit = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; markdown?: string }>)
        .detail;
      if (detail.id && typeof detail.markdown === "string")
        commitTextNode(detail.id, detail.markdown);
    };
    const onCancel = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) setTextEditing(id, false);
    };
    window.addEventListener("mozg:canvas-text-edit", onEdit);
    window.addEventListener("mozg:canvas-text-commit", onCommit);
    window.addEventListener("mozg:canvas-text-cancel", onCancel);
    return () => {
      window.removeEventListener("mozg:canvas-text-edit", onEdit);
      window.removeEventListener("mozg:canvas-text-commit", onCommit);
      window.removeEventListener("mozg:canvas-text-cancel", onCancel);
    };
  }, [commitTextNode, setTextEditing]);

  const ingest = useCallback(
    async (
      payload: CanvasImageTransferPayload,
      source: "clipboard" | "drop" | "file-picker",
      client: FlowPosition | null,
    ) => {
      if (!shellState.canvasId) return;
      const position = client
        ? screenToFlowRef.current(client)
        : centerPosition();
      try {
        const result = await ingestCanvasImageTransferToNodes(
          payload,
          source,
          position,
          adapterDependencies,
        );
        if (result.nodes.length === 0) return;
        setNodes((current) => [...current, ...result.nodes]);
        controller.insertImageNodes(result.nodes);
        syncState();
        scheduleSave();
      } catch (error: unknown) {
        setShellState((current) => ({
          ...current,
          status: "error",
          error:
            error instanceof Error ? error.message : "Image ingestion failed.",
        }));
      }
    },
    [
      adapterDependencies,
      centerPosition,
      controller,
      scheduleSave,
      setNodes,
      shellState.canvasId,
      syncState,
    ],
  );

  const ingestRef = useRef(ingest);
  useEffect(() => {
    ingestRef.current = ingest;
  }, [ingest]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (eventTouchesEditingSurface(event)) return;
      const payload = transferPayload(event);
      if (shouldPreventCanvasImagePaste(event)) {
        event.preventDefault();
        void ingestRef.current(payload, "clipboard", pointerRef.current);
        return;
      }
      if (transferHasSupportedImage(payload)) return;
      const text = plainTextFromClipboard(event);
      if (!hasMeaningfulPlainText(text)) return;
      event.preventDefault();
      createTextNode(pointerRef.current, text, false);
    };
    return attachCanvasImagePasteListener(onPaste);
  }, [createTextNode]);

  useEffect(() => {
    const guard = (event: DragEvent) => {
      const payload = transferPayload(event);
      if (!transferHasFiles(payload)) return;
      const inside = wrapperRef.current
        ? event.composedPath().includes(wrapperRef.current)
        : false;
      if (inside) return;
      event.preventDefault();
      if (event.type === "drop") event.stopPropagation();
    };
    window.addEventListener("dragover", guard, true);
    window.addEventListener("drop", guard, true);
    return () => {
      window.removeEventListener("dragover", guard, true);
      window.removeEventListener("drop", guard, true);
    };
  }, []);

  const handleNodesChange = useCallback(
    (changes: NodeChange<CanvasFlowNode>[]) => {
      const removed = changes.filter(
        (
          change,
        ): change is Extract<NodeChange<CanvasFlowNode>, { type: "remove" }> =>
          change.type === "remove",
      );
      for (const change of removed) {
        const node = nodesRef.current.find((item) => item.id === change.id);
        if (node?.type === CANVAS_IMAGE_NODE_TYPE && node.data.objectUrl)
          objectUrls.revoke(node.data.objectUrl);
      }
      if (removed.length > 0) {
        controller.removeCanvasNodes(removed.map((change) => change.id));
        const removedIds = new Set(removed.map((change) => change.id));
        setEdges((current) =>
          current.filter(
            (edge) =>
              !removedIds.has(edge.source) && !removedIds.has(edge.target),
          ),
        );
        syncState();
      }
      onNodesChange(changes);
      const shouldPersist = changes.some(
        (change) =>
          change.type === "remove" ||
          (change.type === "position" && change.dragging === false) ||
          (change.type === "dimensions" && change.resizing === false),
      );
      if (shouldPersist) scheduleSave();
    },
    [controller, objectUrls, onNodesChange, scheduleSave, setEdges, syncState],
  );

  const onDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDropActive(false);
      if (!shouldPreventFileNavigation(transferPayload(event.nativeEvent)))
        return;
      void ingest(transferPayload(event.nativeEvent), "drop", {
        x: event.clientX,
        y: event.clientY,
      });
    },
    [ingest],
  );

  const onPicker = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (files.length > 0)
        void ingest(
          { files, items: [], types: files.map((file) => file.type) },
          "file-picker",
          null,
        );
    },
    [ingest],
  );

  const createCanvas = useCallback(async () => {
    const title = newTitle.trim();
    if (!title) return;
    const generation = ++canvasGenerationRef.current;
    const created = await controller.createCanvas(title);
    if (!created.canvasId) return;
    repository.setActiveCanvas?.(created.canvasId);
    programmaticViewportRef.current = null;
    setViewportVisible(false);
    setSummaries(await controller.listCanvases());
    setShellState(created);
    setRenameTitle(created.title);
    setNodes([]);
    setEdges([]);
    hydratingRef.current = false;
    setViewportInitialization({
      canvasId: created.canvasId,
      generation,
      viewport: { ...created.viewport },
    });
  }, [controller, newTitle, repository, setEdges, setNodes]);

  const renameCanvas = useCallback(() => {
    if (!renameTitle.trim() || !shellState.canvasId) return;
    controller.setTitle(renameTitle.trim());
    syncState();
    scheduleSave();
  }, [controller, renameTitle, scheduleSave, shellState.canvasId, syncState]);

  const deleteCanvas = useCallback(async () => {
    if (
      !shellState.canvasId ||
      !window.confirm(`Delete “${shellState.title}”?`)
    )
      return;
    restoreControllerRef.current?.abort();
    objectUrls.revokeAll();
    await repository.softDeleteCanvas({
      workspaceId: shellWorkspaceId,
      canvasId: shellState.canvasId,
    });
    repository.setActiveCanvas?.(null);
    const next = await controller.listCanvases();
    setSummaries(next);
    setNodes([]);
    setEdges([]);
    if (next[0]) await openCanvas(next[0].id);
    else {
      hydratingRef.current = false;
      setShellState(emptyShellState());
    }
  }, [
    controller,
    objectUrls,
    openCanvas,
    repository,
    setEdges,
    setNodes,
    shellWorkspaceId,
    shellState.canvasId,
    shellState.title,
  ]);

  const onMoveEnd = useCallback(
    (_: unknown, viewport: { x: number; y: number; zoom: number }) => {
      if (!shellState.canvasId || !viewportVisible) return;
      if (
        isProgrammaticViewportMove({
          canvasId: shellState.canvasId,
          initialization: programmaticViewportRef.current,
          viewport,
        })
      ) {
        programmaticViewportRef.current = null;
        return;
      }
      programmaticViewportRef.current = null;
      setShellState((current) => ({ ...current, viewport: { ...viewport } }));
      if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
      viewportTimerRef.current = setTimeout(() => {
        viewportTimerRef.current = null;
        void controller.saveViewport(viewport).catch((error: unknown) =>
          setShellState((current) => ({
            ...current,
            status: "error",
            error:
              error instanceof Error ? error.message : "Viewport save failed.",
          })),
        );
      }, 240);
    },
    [controller, shellState.canvasId, viewportVisible],
  );

  if (!shellState.canvasId && loadingLifecycle !== "empty-confirmed") {
    const isError = loadingLifecycle === "error";
    return (
      <main className={`${styles.page} ${embedded ? styles.pageEmbedded : ""}`}>
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1 className={styles.title}>Canvas</h1>
            <p className={isError ? styles.statusError : styles.status}>
              {isError ? (shellState.error ?? copy.error) : copy.loading}
            </p>
          </div>
        </header>
        <section className={styles.loadingShell} aria-busy={!isError}>
          {isError ? (
            <button
              className={styles.button}
              onClick={() => window.location.reload()}
              type="button"
            >
              Повторить
            </button>
          ) : (
            <div
              className={styles.loadingGeometry}
              aria-label="Loading Canvas"
              role="status"
            >
              <span />
              <span />
              <span />
            </div>
          )}
        </section>
      </main>
    );
  }

  if (!shellState.canvasId) {
    return (
      <main className={`${styles.page} ${embedded ? styles.pageEmbedded : ""}`}>
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1 className={styles.title}>Infinite Canvas</h1>
            <p className={styles.status}>{copy.status}</p>
          </div>
        </header>
        <section className={styles.empty}>
          <div className={styles.emptyCard}>
            <h2>{copy.emptyTitle}</h2>
            <p>{copy.emptyDescription}</p>
            <div className={styles.createRow}>
              <input
                className={styles.input}
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                aria-label="Canvas title"
              />
              <button
                className={`${styles.button} ${styles.primary}`}
                type="button"
                onClick={() => void createCanvas()}
              >
                {copy.create}
              </button>
            </div>
            {shellState.error ? (
              <p className={styles.statusError}>{shellState.error}</p>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  const statusLabel =
    shellState.status === "saved"
      ? copy.saved
      : shellState.status === "saving"
        ? copy.saving
        : shellState.status === "conflict"
          ? copy.conflict
          : shellState.status === "loading"
            ? copy.loading
            : copy.error;
  return (
    <main className={`${styles.page} ${embedded ? styles.pageEmbedded : ""}`}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1 className={styles.title}>{shellState.title}</h1>
          <p
            className={`${styles.status} ${shellState.status === "conflict" ? styles.statusConflict : shellState.status === "error" ? styles.statusError : ""}`}
          >
            {statusLabel}
            {shellState.error ? ` · ${shellState.error}` : ""}
          </p>
        </div>
        <div className={styles.headerActions}>
          <select
            className={styles.select}
            value={shellState.canvasId}
            onChange={(event) => void openCanvas(event.target.value)}
            aria-label="Canvas selector"
          >
            {summaries.map((summary) => (
              <option key={summary.id} value={summary.id}>
                {summary.title}
              </option>
            ))}
          </select>
          <input
            className={styles.input}
            value={renameTitle}
            onChange={(event) => setRenameTitle(event.target.value)}
            aria-label="Rename Canvas"
          />
          <button
            className={styles.button}
            type="button"
            onClick={renameCanvas}
          >
            {copy.rename}
          </button>
          <button
            className={styles.button}
            type="button"
            onClick={() => void createCanvas()}
          >
            {copy.newCanvas}
          </button>
          <button
            className={`${styles.button} ${styles.danger}`}
            type="button"
            onClick={() => void deleteCanvas()}
          >
            {copy.delete}
          </button>
          {shellState.status === "conflict" ? (
            <button
              className={`${styles.button} ${styles.primary}`}
              type="button"
              onClick={() => void openCanvas(shellState.canvasId!)}
            >
              {copy.reloadWinner}
            </button>
          ) : null}
          {shellState.status === "error" ? (
            <button
              className={styles.button}
              type="button"
              onClick={() => void openCanvas(shellState.canvasId!)}
            >
              Повторить
            </button>
          ) : null}
          <label className={`${styles.button} ${styles.primary}`}>
            {copy.addImage}
            <input
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={onPicker}
            />
          </label>
          <button
            className={styles.button}
            type="button"
            onClick={() => createTextNode(null, "", true)}
          >
            {copy.text}
          </button>
          <div className={styles.taskPicker}>
            <button
              className={`${styles.button} ${styles.primary}`}
              type="button"
              disabled={!taskBridge || !taskWorkspaceId}
              aria-expanded={taskPickerOpen}
              onClick={() => setTaskPickerOpen((current) => !current)}
            >
              Задача
            </button>
            {taskPickerOpen ? (
              <div
                className={styles.taskPickerPanel}
                role="dialog"
                aria-label="Добавить задачу"
              >
                <div className={styles.taskPickerHeader}>
                  <strong>Добавить задачу</strong>
                  <button
                    type="button"
                    className={styles.taskPickerClose}
                    aria-label="Закрыть выбор задачи"
                    onClick={() => setTaskPickerOpen(false)}
                  >
                    ×
                  </button>
                </div>
                <input
                  className={styles.input}
                  type="search"
                  value={taskQuery}
                  autoFocus
                  placeholder="Поиск по названию"
                  aria-label="Поиск задач"
                  onChange={(event) => setTaskQuery(event.target.value)}
                />
                <div className={styles.taskPickerResults}>
                  {taskSearchStatus === "loading" ? (
                    <p className={styles.taskPickerEmpty}>Загрузка задач…</p>
                  ) : taskSearchStatus === "error" ? (
                    <p className={styles.taskPickerError} role="alert">
                      Не удалось загрузить задачи
                    </p>
                  ) : taskResults.length === 0 ? (
                    <p className={styles.taskPickerEmpty}>
                      {taskQuery.trim()
                        ? "Совпадений нет"
                        : "В этом проекте нет задач"}
                    </p>
                  ) : (
                    taskResults.map((task) => (
                      <button
                        type="button"
                        className={styles.taskPickerResult}
                        key={task.id}
                        onClick={() => createTaskNode(task)}
                      >
                        <strong>{task.title}</strong>
                        <span>{task.completed ? "Выполнено" : "В работе"}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <div className={styles.canvasWrap}>
        <div
          ref={wrapperRef}
          className={`${styles.canvas} ${dropActive ? styles.dropActive : ""}`}
          onDragEnter={() => setDropActive(true)}
          onDragLeave={() => setDropActive(false)}
          onDragOver={(event) => {
            if (transferHasFiles(transferPayload(event.nativeEvent)))
              event.preventDefault();
          }}
          onDrop={onDrop}
        >
          <ReactFlow
            className={`${styles.canvasViewport} ${viewportVisible ? "" : styles.canvasViewportHidden}`}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            connectionMode={ConnectionMode.Loose}
            connectionLineComponent={CanvasConnectionLine}
            onMoveEnd={onMoveEnd}
            onInit={() => setFlowInstanceEpoch((current) => current + 1)}
            onPaneClick={(event) => {
              if (event.detail !== 2) return;
              createTextNode({ x: event.clientX, y: event.clientY }, "", true);
            }}
            onPaneMouseMove={(event) => {
              pointerRef.current = { x: event.clientX, y: event.clientY };
            }}
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background gap={24} color="#d6d3d1" />
            <Controls showInteractive={false} />
            <CanvasEdgeMarkerDefinitions />
          </ReactFlow>
          {!viewportVisible ? (
            <div className={styles.canvasLoading} role="status">
              Preparing canvas…
            </div>
          ) : null}
          <div className={styles.canvasHint}>
            {dropActive
              ? "Drop PNG, JPEG or WebP here"
              : "Paste, drop or choose an image · drag and resize are saved"}
          </div>
          {showDiagnostics ? (
            <details className={styles.details}>
              <summary>Details</summary>
              <div className={styles.diagnostics}>
                <span>
                  nodes <strong>{nodes.length}</strong>
                </span>
                <span>
                  revision <strong>{shellState.revision}</strong>
                </span>
                <span>
                  reads <strong>{restoreStats.reads}</strong>
                </span>
                <span>
                  max <strong>{restoreStats.maxConcurrency}</strong>
                </span>
                <span>
                  missing <strong>{restoreStats.missing}</strong>
                </span>
                <span>
                  URLs <strong>{objectUrls.count()}</strong>
                </span>
                <span>
                  canonical <strong>{shellState.document.nodes.length}</strong>
                </span>
                <span>
                  viewport{" "}
                  <strong>{shellState.viewport.zoom.toFixed(2)}×</strong>
                </span>
              </div>
            </details>
          ) : null}
        </div>
      </div>
      {showDiagnostics ? (
        <footer className={styles.footer}>
          <span>{copy.isolated}</span>
          <span>{shellWorkspaceId}</span>
          <span>Canvas revision {shellState.revision}</span>
        </footer>
      ) : null}
    </main>
  );
}

export function InfiniteCanvasLocalShell({
  activeTaskDetailsTaskId,
  assetRepository,
  copy,
  embedded,
  repository,
  runtimeCache,
  showDiagnostics,
  taskBridge,
  taskWorkspaceId,
  userId,
  workspaceId,
}: {
  activeTaskDetailsTaskId?: string;
  assetRepository: CanvasAssetRepository;
  copy: CanvasShellCopy;
  embedded?: boolean;
  repository: CanvasShellRepository;
  runtimeCache?: CloudCanvasRuntimeCache;
  showDiagnostics: boolean;
  taskBridge?: CanvasTaskBridge;
  taskWorkspaceId?: string;
  userId: string;
  workspaceId: string;
}): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <InfiniteCanvasLocalShellSurface
        activeTaskDetailsTaskId={activeTaskDetailsTaskId}
        assetRepository={assetRepository}
        copy={copy}
        embedded={embedded}
        repository={repository}
        runtimeCache={runtimeCache}
        showDiagnostics={showDiagnostics}
        taskBridge={taskBridge}
        taskWorkspaceId={taskWorkspaceId}
        userId={userId}
        workspaceId={workspaceId}
      />
    </ReactFlowProvider>
  );
}
