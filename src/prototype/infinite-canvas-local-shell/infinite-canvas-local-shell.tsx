"use client";

import {
  Background,
  Controls,
  NodeResizer,
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
  CANVAS_TEXT_NODE_TYPE,
  canvasDocumentToImageNodes,
  canvasDocumentToTextNodes,
  createCanvasTextFlowNode,
  ingestCanvasImageTransferToNodes,
  restoreCanvasImageNodes,
  type CanvasImageAdapterDependencies,
  type CanvasFlowNode,
  type CanvasImageFlowNode,
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
import {
  IndexedDbCanvasRepository,
  type CanvasSummary,
} from "@/lib/canvas/local-canvas-repository";
import {
  emptyShellState,
  LocalCanvasShellController,
  type LocalCanvasShellState,
} from "@/lib/canvas/local-canvas-shell-controller";
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

function CanvasImageNodeView({
  data,
  selected,
}: NodeProps<CanvasImageFlowNode>): React.JSX.Element {
  return (
    <div
      className={`${styles.imageNode} ${selected ? styles.selectedNode : ""}`}
    >
      <NodeResizer
        color="#0f766e"
        keepAspectRatio
        minWidth={120}
        minHeight={80}
      />
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
    </div>
  );
}

function CanvasTextNodeView({
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
    <div
      className={`${styles.textNode} ${selected ? styles.selectedNode : ""}`}
      onDoubleClick={(event) => {
        event.stopPropagation();
        window.dispatchEvent(
          new CustomEvent("mozg:canvas-text-edit", { detail: { id } }),
        );
      }}
    >
      <NodeResizer color="#0f766e" minWidth={180} minHeight={100} />
      {data.isEditing ? (
        <div className={styles.textEditor}>
          <textarea
            autoFocus
            value={draft}
            aria-label="Markdown text"
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
  );
}

const nodeTypes = {
  [CANVAS_IMAGE_NODE_TYPE]: CanvasImageNodeView,
  [CANVAS_TEXT_NODE_TYPE]: CanvasTextNodeView,
};

function InfiniteCanvasLocalShellSurface(): React.JSX.Element {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<FlowPosition | null>(null);
  const nodesRef = useRef<CanvasFlowNode[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreControllerRef = useRef<AbortController | null>(null);
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

  const restoreForCanvas = useCallback(
    async (nextState: LocalCanvasShellState) => {
      restoreControllerRef.current?.abort();
      restoreControllerRef.current = new AbortController();
      objectUrls.revokeAll();
      const signal = restoreControllerRef.current.signal;
      const placeholders: CanvasFlowNode[] = [
        ...canvasDocumentToImageNodes(nextState.document),
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
    },
    [adapterDependencies, objectUrls, setNodes],
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

export function InfiniteCanvasLocalShell(): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <InfiniteCanvasLocalShellSurface />
    </ReactFlowProvider>
  );
}
