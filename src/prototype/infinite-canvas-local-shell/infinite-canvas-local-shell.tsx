"use client";

import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
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
  CANVAS_IMAGE_NODE_TYPE,
  CANVAS_TASK_NODE_TYPE,
  CANVAS_TEXT_NODE_TYPE,
  canvasDocumentToImageNodes,
  canvasDocumentToTaskNodes,
  canvasDocumentToTextNodes,
  createCanvasTaskFlowNode,
  createCanvasTaskId,
  createCanvasTextFlowNode,
  ingestCanvasImageTransferToNodes,
  restoreCanvasImageNodes,
  type CanvasImageAdapterDependencies,
  type CanvasFlowNode,
  type CanvasImageFlowNode,
  type CanvasTaskFlowNode,
  type CanvasTextFlowNode,
  type FlowPosition,
} from "@/lib/canvas/react-flow-canvas-adapter";
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
  IndexedDbCanvasRepository,
  type CanvasSummary,
} from "@/lib/canvas/local-canvas-repository";
import {
  emptyShellState,
  LocalCanvasShellController,
  type LocalCanvasShellState,
} from "@/lib/canvas/local-canvas-shell-controller";
import { shouldCloseCanvasTaskDetails } from "@/lib/canvas/canvas-task-selection";
import { CanvasNodeFrame } from "./canvas-node-frame";
import styles from "./infinite-canvas-local-shell.module.css";

export const INFINITE_CANVAS_LOCAL_SHELL_WORKSPACE_ID =
  "__mozg_infinite_canvas_local_shell__";
export const INFINITE_CANVAS_LOCAL_SHELL_USER_ID =
  "__mozg_infinite_canvas_local_shell_user__";
export const INFINITE_CANVAS_LOCAL_SHELL_DATABASE_NAME =
  "mozg-infinite-canvas-local-shell";

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
      <div className={styles.caption}>
        <span>{data.mimeType.replace("image/", "")}</span>
        <span>
          {data.intrinsicWidth} × {data.intrinsicHeight}
        </span>
      </div>
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

const nodeTypes = {
  [CANVAS_IMAGE_NODE_TYPE]: ImageNodeBody,
  [CANVAS_TASK_NODE_TYPE]: TaskNodeBody,
  [CANVAS_TEXT_NODE_TYPE]: TextNodeBody,
};

function InfiniteCanvasLocalShellSurface({
  activeTaskDetailsTaskId,
  taskBridge,
  taskWorkspaceId,
}: {
  activeTaskDetailsTaskId?: string;
  taskBridge?: CanvasTaskBridge;
  taskWorkspaceId?: string;
}): React.JSX.Element {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const taskBridgeRef = useRef<CanvasTaskBridge | undefined>(taskBridge);
  const taskWorkspaceIdRef = useRef<string | undefined>(taskWorkspaceId);
  taskBridgeRef.current = taskBridge;
  taskWorkspaceIdRef.current = taskWorkspaceId;
  const pointerRef = useRef<FlowPosition | null>(null);
  const nodesRef = useRef<CanvasFlowNode[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreControllerRef = useRef<AbortController | null>(null);
  const pendingContentHeightSaveRef = useRef(false);
  const hydratingRef = useRef(true);
  const viewportApplyRef = useRef<string | null>(null);
  const suppressViewportSaveRef = useRef(false);
  const screenToFlowRef = useRef<
    (point: { x: number; y: number }) => FlowPosition
  >(() => ({ x: 0, y: 0 }));
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasFlowNode>([]);
  const [summaries, setSummaries] = useState<CanvasSummary[]>([]);
  const [shellState, setShellState] =
    useState<LocalCanvasShellState>(emptyShellState);
  const [restoreStats, setRestoreStats] =
    useState<RestoreStats>(EMPTY_RESTORE_STATS);
  const [dropActive, setDropActive] = useState(false);
  const [newTitle, setNewTitle] = useState("First Canvas");
  const [renameTitle, setRenameTitle] = useState("");
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [taskQuery, setTaskQuery] = useState("");
  const [taskResults, setTaskResults] = useState<CanvasTaskProjection[]>([]);
  const [taskSearchStatus, setTaskSearchStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [repository] = useState(
    () =>
      new IndexedDbCanvasRepository({
        databaseName: INFINITE_CANVAS_LOCAL_SHELL_DATABASE_NAME,
      }),
  );
  const [objectUrls] = useState(() => createObjectUrlRegistry());
  const [controller] = useState(
    () =>
      new LocalCanvasShellController({
        repository,
        workspaceId: INFINITE_CANVAS_LOCAL_SHELL_WORKSPACE_ID,
        userId: INFINITE_CANVAS_LOCAL_SHELL_USER_ID,
      }),
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
      assetRepository: repository,
      objectUrls,
      workspaceId: INFINITE_CANVAS_LOCAL_SHELL_WORKSPACE_ID,
    }),
    [objectUrls, repository],
  );

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

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
      void controller.save().then(syncState).catch(syncState);
    }, 260);
  }, [controller, syncState]);

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
      hydratingRef.current = true;
      setRestoreStats(EMPTY_RESTORE_STATS);
      const result = await restoreCanvasImageNodes(
        nextState.document,
        adapterDependencies,
        {
          signal,
          concurrency: 4,
          onNode: (node) => {
            if (signal.aborted) return;
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
        scheduleSave();
      }
    },
    [
      adapterDependencies,
      handleTaskNodeContentHeightChange,
      objectUrls,
      scheduleSave,
      setNodes,
    ],
  );

  const openCanvas = useCallback(
    async (canvasId: string) => {
      hydratingRef.current = true;
      setShellState((current) => ({
        ...current,
        status: "loading",
        error: null,
      }));
      const nextState = await controller.openCanvas(canvasId);
      setShellState(nextState);
      setRenameTitle(nextState.title);
      viewportApplyRef.current = null;
      await restoreForCanvas(nextState);
    },
    [controller, restoreForCanvas],
  );

  useEffect(() => {
    let active = true;
    void controller
      .listCanvases()
      .then(async (items) => {
        if (!active) return;
        setSummaries(items);
        if (items[0]) await openCanvas(items[0].id);
        else {
          hydratingRef.current = false;
          setShellState(emptyShellState());
        }
      })
      .catch((error: unknown) => {
        if (active)
          setShellState((current) => ({
            ...current,
            status: "error",
            error:
              error instanceof Error ? error.message : "Canvas loading failed.",
          }));
      });
    return () => {
      active = false;
      restoreControllerRef.current?.abort();
      objectUrls.revokeAll();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
      repository.close();
    };
  }, [controller, objectUrls, openCanvas, repository]);

  useEffect(() => {
    if (!shellState.canvasId || shellState.status === "loading") return;
    if (viewportApplyRef.current === shellState.canvasId) return;
    viewportApplyRef.current = shellState.canvasId;
    suppressViewportSaveRef.current = true;
    reactFlow.setViewport(shellState.viewport, { duration: 0 });
    window.setTimeout(() => {
      suppressViewportSaveRef.current = false;
    }, 0);
  }, [reactFlow, shellState.canvasId, shellState.status, shellState.viewport]);

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
    [controller, objectUrls, onNodesChange, scheduleSave, syncState],
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
    const created = await controller.createCanvas(title);
    setSummaries(await controller.listCanvases());
    setShellState(created);
    setRenameTitle(created.title);
    setNodes([]);
    hydratingRef.current = false;
  }, [controller, newTitle, setNodes]);

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
      workspaceId: INFINITE_CANVAS_LOCAL_SHELL_WORKSPACE_ID,
      canvasId: shellState.canvasId,
    });
    const next = await controller.listCanvases();
    setSummaries(next);
    setNodes([]);
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
    setNodes,
    shellState.canvasId,
    shellState.title,
  ]);

  const onMoveEnd = useCallback(
    (_: unknown, viewport: { x: number; y: number; zoom: number }) => {
      if (!shellState.canvasId || suppressViewportSaveRef.current) return;
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
    [controller, shellState.canvasId],
  );

  if (!shellState.canvasId) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <p className={styles.eyebrow}>Local Canvas</p>
            <h1 className={styles.title}>Infinite Canvas</h1>
            <p className={styles.status}>
              Private local workspace · no production data
            </p>
          </div>
        </header>
        <section className={styles.empty}>
          <div className={styles.emptyCard}>
            <h2>Create your first Canvas</h2>
            <p>
              Canvas documents, image assets and your personal viewport stay in
              this isolated local shell.
            </p>
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
                Create Canvas
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
      ? "Saved"
      : shellState.status === "saving"
        ? "Saving…"
        : shellState.status === "conflict"
          ? "Conflict"
          : shellState.status === "loading"
            ? "Loading"
            : "Error";
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <p className={styles.eyebrow}>Local Canvas</p>
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
            Rename
          </button>
          <button
            className={styles.button}
            type="button"
            onClick={() => void createCanvas()}
          >
            New
          </button>
          <button
            className={`${styles.button} ${styles.danger}`}
            type="button"
            onClick={() => void deleteCanvas()}
          >
            Delete
          </button>
          {shellState.status === "conflict" ? (
            <button
              className={`${styles.button} ${styles.primary}`}
              type="button"
              onClick={() => void openCanvas(shellState.canvasId!)}
            >
              Reload winner
            </button>
          ) : null}
          <label className={`${styles.button} ${styles.primary}`}>
            Add image
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
            Text
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
            nodes={nodes}
            edges={[]}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onMoveEnd={onMoveEnd}
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
          </ReactFlow>
          <div className={styles.canvasHint}>
            {dropActive
              ? "Drop PNG, JPEG or WebP here"
              : "Paste, drop or choose an image · drag and resize are saved"}
          </div>
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
                viewport <strong>{shellState.viewport.zoom.toFixed(2)}×</strong>
              </span>
            </div>
          </details>
        </div>
      </div>
      <footer className={styles.footer}>
        <span>Workspace isolated</span>
        <span>{INFINITE_CANVAS_LOCAL_SHELL_WORKSPACE_ID}</span>
        <span>Canvas revision {shellState.revision}</span>
      </footer>
    </main>
  );
}

export function InfiniteCanvasLocalShell({
  activeTaskDetailsTaskId,
  taskBridge,
  taskWorkspaceId,
}: {
  activeTaskDetailsTaskId?: string;
  taskBridge?: CanvasTaskBridge;
  taskWorkspaceId?: string;
} = {}): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <InfiniteCanvasLocalShellSurface
        activeTaskDetailsTaskId={activeTaskDetailsTaskId}
        taskBridge={taskBridge}
        taskWorkspaceId={taskWorkspaceId}
      />
    </ReactFlowProvider>
  );
}
