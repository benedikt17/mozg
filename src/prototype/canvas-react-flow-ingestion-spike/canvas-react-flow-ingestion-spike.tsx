"use client";

import {
  Background,
  Controls,
  MiniMap,
  NodeResizer,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  useViewport,
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
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  CANVAS_IMAGE_INPUT_MAX_BYTES,
  CANVAS_IMAGE_INPUT_MAX_FILES,
  CANVAS_IMAGE_INPUT_MAX_PIXELS,
  attachCanvasImagePasteListener,
  createCanvasImageLabManifestStore,
  createObjectUrlRegistry,
  shouldPreventCanvasImagePaste,
  shouldPreventFileNavigation,
  transferHasFiles,
  type CanvasImageTransferPayload,
} from "@/lib/canvas/canvas-image-ingestion";
import { IndexedDbCanvasRepository } from "@/lib/canvas/local-canvas-repository";
import styles from "./canvas-react-flow-ingestion-spike.module.css";
import {
  CANVAS_IMAGE_NODE_TYPE,
  CANVAS_REACT_FLOW_DATABASE_NAME,
  CANVAS_REACT_FLOW_MANIFEST_KEY,
  CANVAS_REACT_FLOW_WORKSPACE_ID,
  clearReactFlowImageAssets,
  createReactFlowRestorationCoordinator,
  ingestReactFlowTransfer,
  removeReactFlowImageNode,
  restoreReactFlowImageNodesProgressive,
  type CanvasImageNode,
  type FlowPosition,
  type ReactFlowImageIngestionDependencies,
  type ReactFlowRestoreTimings,
} from "./canvas-react-flow-ingestion";

type Diagnostics = {
  lastSource: string;
  accepted: number;
  rejected: number;
  persisted: number;
  restorationRunCount: number;
  restoration: ReactFlowRestoreTimings | null;
  decodedCount: number;
};

const EMPTY_DIAGNOSTICS: Diagnostics = {
  lastSource: "—",
  accepted: 0,
  rejected: 0,
  persisted: 0,
  restorationRunCount: 0,
  restoration: null,
  decodedCount: 0,
};

function memoryStorage(): Storage {
  let value: string | null = null;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
    removeItem: () => {
      value = null;
    },
    clear: () => {
      value = null;
    },
    key: () => null,
    get length() {
      return value === null ? 0 : 1;
    },
  } as Storage;
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

function targetPosition(
  wrapper: HTMLDivElement | null,
  screenToFlowPosition: (position: { x: number; y: number }) => FlowPosition,
  client: FlowPosition | null,
): FlowPosition {
  if (client) return screenToFlowPosition(client);
  const rect = wrapper?.getBoundingClientRect();
  return screenToFlowPosition({
    x: (rect?.left ?? 0) + (rect?.width ?? 800) / 2,
    y: (rect?.top ?? 0) + (rect?.height ?? 600) / 2,
  });
}

function formatMs(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}ms`;
}

function CanvasImageNodeView({ data, selected }: NodeProps<CanvasImageNode>) {
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
      {/* Blob-backed Object URLs are intentionally rendered with native img in this spike. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.image}
        src={data.objectUrl}
        alt={`Canvas asset ${data.assetId}`}
        draggable={false}
        onLoad={() => data.onPreviewReady?.(data.assetId)}
      />
      <div className={styles.nodeCaption}>
        <span>{data.mimeType.replace("image/", "")}</span>
        <span>
          {data.intrinsicWidth} × {data.intrinsicHeight}
        </span>
      </div>
    </div>
  );
}

const nodeTypes = { [CANVAS_IMAGE_NODE_TYPE]: CanvasImageNodeView };

function ReactFlowImageIngestionSurface(): React.JSX.Element {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const lastPointerRef = useRef<FlowPosition | null>(null);
  const nodesRef = useRef<CanvasImageNode[]>([]);
  const ingestRef = useRef<
    (
      payload: CanvasImageTransferPayload,
      source: "clipboard" | "drop" | "file-picker",
      client: FlowPosition | null,
    ) => Promise<void>
  >(async () => undefined);
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasImageNode>([]);
  const [repository] = useState(
    () =>
      new IndexedDbCanvasRepository({
        databaseName: CANVAS_REACT_FLOW_DATABASE_NAME,
      }),
  );
  const [manifest] = useState(() =>
    createCanvasImageLabManifestStore(
      typeof window === "undefined" ? memoryStorage() : window.localStorage,
      CANVAS_REACT_FLOW_MANIFEST_KEY,
    ),
  );
  const [objectUrls] = useState(() => createObjectUrlRegistry());
  const [restorationCoordinator] = useState(() =>
    createReactFlowRestorationCoordinator(repository),
  );
  const restorationRunRef = useRef(0);
  const restorationDecodedRef = useRef(new Set<string>());
  const [diagnostics, setDiagnostics] =
    useState<Diagnostics>(EMPTY_DIAGNOSTICS);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const reactFlow = useReactFlow<CanvasImageNode>();
  const viewport = useViewport();
  const screenToFlowPositionRef = useRef(reactFlow.screenToFlowPosition);
  const dependencies = useMemo<ReactFlowImageIngestionDependencies>(
    () => ({
      repository,
      manifest,
      objectUrls,
      workspaceId: CANVAS_REACT_FLOW_WORKSPACE_ID,
      restorationCoordinator,
    }),
    [manifest, objectUrls, repository, restorationCoordinator],
  );

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    screenToFlowPositionRef.current = reactFlow.screenToFlowPosition;
  }, [reactFlow.screenToFlowPosition]);

  const centerPosition = useCallback(
    () =>
      targetPosition(wrapperRef.current, screenToFlowPositionRef.current, null),
    [],
  );

  const ingest = useCallback(
    async (
      payload: CanvasImageTransferPayload,
      source: "clipboard" | "drop" | "file-picker",
      client: FlowPosition | null,
    ) => {
      setBusy(true);
      setLastError(null);
      try {
        const response = await ingestReactFlowTransfer(
          payload,
          source,
          targetPosition(
            wrapperRef.current,
            reactFlow.screenToFlowPosition,
            client,
          ),
          dependencies,
        );
        setNodes((current) => [...current, ...response.nodes]);
        setDiagnostics((current) => ({
          ...current,
          lastSource: source,
          accepted: current.accepted + response.result.accepted.length,
          rejected: current.rejected + response.result.rejected.length,
          persisted: manifest.list().length,
        }));
      } catch {
        setLastError("Image ingestion failed; no node was added.");
      } finally {
        setBusy(false);
      }
    },
    [dependencies, manifest, reactFlow.screenToFlowPosition, setNodes],
  );

  useEffect(() => {
    ingestRef.current = ingest;
  }, [ingest]);

  useEffect(() => {
    const controller = new AbortController();
    const runId = ++restorationRunRef.current;
    restorationDecodedRef.current = new Set<string>();
    const runNodeIds = new Set<string>();
    const runObjectUrls = new Set<string>();
    const startedAt =
      typeof performance === "undefined" ? Date.now() : performance.now();
    const updatePreviewTiming = (assetId: string) => {
      if (controller.signal.aborted) return;
      const decoded = restorationDecodedRef.current;
      if (decoded.has(assetId)) return;
      decoded.add(assetId);
      const elapsed =
        (typeof performance === "undefined" ? Date.now() : performance.now()) -
        startedAt;
      setDiagnostics((current) => {
        const restoration = current.restoration
          ? {
              ...current.restoration,
              firstPreviewMs: current.restoration.firstPreviewMs ?? elapsed,
              allPreviewsMs:
                decoded.size >= current.persisted
                  ? elapsed
                  : current.restoration.allPreviewsMs,
            }
          : current.restoration;
        return { ...current, decodedCount: decoded.size, restoration };
      });
    };
    void restoreReactFlowImageNodesProgressive(dependencies, centerPosition(), {
      runId,
      signal: controller.signal,
      concurrency: 4,
      onPreviewReady: updatePreviewTiming,
      onNode: ({ node, timings }) => {
        if (controller.signal.aborted) return;
        runNodeIds.add(node.id);
        runObjectUrls.add(node.data.objectUrl);
        setNodes((current) =>
          current.some((existing) => existing.id === node.id)
            ? current
            : [...current, node],
        );
        setDiagnostics((current) => ({
          ...current,
          lastSource: "restored",
          persisted: manifest.list().length,
          restorationRunCount: runId,
          restoration: timings,
        }));
      },
    }).then(({ timings }) => {
      if (controller.signal.aborted) return;
      setDiagnostics((current) => ({
        ...current,
        restorationRunCount: runId,
        restoration: timings ?? null,
        persisted: manifest.list().length,
      }));
    });
    return () => {
      controller.abort();
      for (const objectUrl of runObjectUrls) objectUrls.revoke(objectUrl);
      if (runNodeIds.size > 0)
        setNodes((current) =>
          current.filter((node) => !runNodeIds.has(node.id)),
        );
    };
  }, [centerPosition, dependencies, manifest, objectUrls, setNodes]);

  useEffect(() => () => objectUrls.revokeAll(), [objectUrls]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (!shouldPreventCanvasImagePaste(event)) return;
      event.preventDefault();
      ingestRef.current(
        transferPayload(event),
        "clipboard",
        lastPointerRef.current,
      );
    };
    return attachCanvasImagePasteListener(onPaste);
  }, []);

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
    (changes: NodeChange<CanvasImageNode>[]) => {
      const removed = changes
        .filter(
          (
            change,
          ): change is Extract<
            NodeChange<CanvasImageNode>,
            { type: "remove" }
          > => change.type === "remove",
        )
        .map((change) => nodesRef.current.find((node) => node.id === change.id))
        .filter((node): node is CanvasImageNode => node !== undefined);
      onNodesChange(changes);
      for (const node of removed) {
        void removeReactFlowImageNode(node, dependencies).then(() => {
          setDiagnostics((current) => ({
            ...current,
            persisted: manifest.list().length,
          }));
        });
      }
    },
    [dependencies, manifest, onNodesChange],
  );

  const onDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      if (!shouldPreventFileNavigation(transferPayload(event.nativeEvent)))
        return;
      void ingest(transferPayload(event.nativeEvent), "drop", {
        x: event.clientX,
        y: event.clientY,
      });
    },
    [ingest],
  );

  const onFilePicker = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (files.length === 0) return;
      void ingest(
        { files, items: [], types: files.map((file) => file.type) },
        "file-picker",
        null,
      );
    },
    [ingest],
  );

  const clearNodes = useCallback(async () => {
    setBusy(true);
    try {
      await clearReactFlowImageAssets(nodesRef.current, dependencies);
      setNodes([]);
      setDiagnostics((current) => ({ ...current, persisted: 0 }));
    } finally {
      setBusy(false);
    }
  }, [dependencies, setNodes]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Disposable integration spike</p>
          <h1>React Flow × Canvas image ingestion</h1>
          <p className={styles.lede}>
            Browser File/Blob → shared ingestion service → isolated assetId →
            React Flow image node.
          </p>
        </div>
        <div className={styles.actions}>
          <label className={styles.fileButton}>
            Choose images
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={onFilePicker}
            />
          </label>
          <button
            type="button"
            onClick={() => void clearNodes()}
            disabled={busy || nodes.length === 0}
          >
            Clear spike
          </button>
        </div>
      </header>
      <section className={styles.diagnostics} aria-label="Spike diagnostics">
        <span>
          <strong>{nodes.length}</strong> nodes
        </span>
        <span>
          <strong>{diagnostics.persisted}</strong> persisted assets
        </span>
        <span>
          <strong>{objectUrls.count()}</strong> active Object URLs
        </span>
        <span>
          last <strong>{diagnostics.lastSource}</strong>
        </span>
        <span>
          <strong>{diagnostics.accepted}</strong> accepted /{" "}
          <strong>{diagnostics.rejected}</strong> rejected
        </span>
        <span>
          zoom <strong>{viewport.zoom.toFixed(2)}×</strong>
        </span>
        {diagnostics.restoration ? (
          <>
            <span>
              restore manifest{" "}
              <strong>{formatMs(diagnostics.restoration.manifestMs)}</strong>
            </span>
            <span>
              first node{" "}
              <strong>{formatMs(diagnostics.restoration.firstNodeMs)}</strong>
            </span>
            <span>
              all nodes{" "}
              <strong>{formatMs(diagnostics.restoration.allNodesMs)}</strong>
            </span>
            <span>
              previews <strong>{diagnostics.decodedCount}</strong> · first{" "}
              <strong>
                {formatMs(diagnostics.restoration.firstPreviewMs)}
              </strong>
            </span>
            <span>
              reads <strong>{diagnostics.restoration.assetReadCount}</strong> ·
              max{" "}
              <strong>{diagnostics.restoration.maxConcurrentAssetReads}</strong>
            </span>
            <span>
              restore run <strong>{diagnostics.restorationRunCount}</strong>
            </span>
          </>
        ) : null}
      </section>
      <div
        ref={wrapperRef}
        className={`${styles.canvas} ${dragActive ? styles.dragActive : ""}`}
        onDragEnter={() => setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
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
          deleteKeyCode={["Backspace", "Delete"]}
          fitView
          onPaneMouseMove={(event: ReactMouseEvent) => {
            lastPointerRef.current = { x: event.clientX, y: event.clientY };
          }}
        >
          <Background gap={24} color="#d6d3d1" />
          <Controls showInteractive={false} />
          <MiniMap nodeColor="#0f766e" pannable zoomable />
        </ReactFlow>
        <div className={styles.canvasHint}>
          {dragActive
            ? "Drop PNG, JPEG or WebP here"
            : "Paste, drop or choose an image — nodes stay session-only"}
        </div>
        {lastError ? <div className={styles.error}>{lastError}</div> : null}
      </div>
      <footer className={styles.footer}>
        <span>{busy ? "Ingesting…" : "Ready"}</span>
        <span>{CANVAS_REACT_FLOW_WORKSPACE_ID}</span>
        <span>
          {CANVAS_IMAGE_INPUT_MAX_FILES} files ·{" "}
          {Math.round(CANVAS_IMAGE_INPUT_MAX_BYTES / 1024 / 1024)} MB ·{" "}
          {CANVAS_IMAGE_INPUT_MAX_PIXELS / 1_000_000} MP
        </span>
      </footer>
    </main>
  );
}

export function CanvasReactFlowIngestionSpike(): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <ReactFlowImageIngestionSurface />
    </ReactFlowProvider>
  );
}
