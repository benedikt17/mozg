"use client";

import {
  Background,
  ConnectionMode,
  Controls,
  SelectionMode,
  EdgeToolbar,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
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
  CanvasDesktopSidebar,
  CanvasDesktopToolbar,
} from "@/prototype/canvases/canvas-desktop-composition";
import { UiIcon } from "@/prototype/desktop-icons";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
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
  isExplicitCanvasResize,
  projectExplicitCanvasResizes,
} from "@/lib/canvas/canvas-runtime-projection";
import {
  advanceCanvasPanInertia,
  canvasPanReleaseVelocity,
  type CanvasPanSample,
  type CanvasPanVelocity,
  type CanvasPanViewport,
} from "@/lib/canvas/canvas-pan-inertia";
import { canvasMiniMapNodeColor } from "@/lib/canvas/canvas-minimap";
import {
  CANVAS_TEXT_FONT_FAMILIES,
  CANVAS_TEXT_FONT_SIZES,
  canvasTextFontFamilyCss,
  nextCanvasTextFontSize,
  previousCanvasTextFontSize,
  type CanvasTextFontFamily,
  type CanvasTextFontSize,
  type CanvasTextStyle,
} from "@/lib/canvas/canvas-text-style";
import {
  DEFAULT_CANVAS_SHAPE_STYLE,
  canvasShapeStyleAsTextStyle,
  canvasTextStylePatchToShapeStyle,
  type CanvasShapeStyle,
} from "@/lib/canvas/canvas-shape-style";
import {
  CANVAS_NODE_CLIPBOARD_MIME,
  createCanvasNodeClipboardPayload,
  materializeCanvasNodeClipboardPaste,
  parseCanvasNodeClipboardPayload,
  serializeCanvasNodeClipboardPayload,
  type CanvasNodeClipboardPayload,
} from "@/lib/canvas/canvas-node-clipboard";
import {
  createCanvasAltDragDuplicate,
  createCanvasAltDragRuntimeNode,
  finalizeCanvasAltDragDuplicate,
  redirectCanvasAltDragNodeChanges,
  type CanvasAltDragDuplicateSession,
} from "@/lib/canvas/canvas-alt-drag-duplicate";
import {
  CANVAS_BRANCH_COLLAPSE_EVENT,
  canvasBranchCollapsedNodeIds,
  projectCanvasBranchCollapse,
  type CanvasBranchCollapseEventDetail,
} from "@/lib/canvas/canvas-branch-collapse";
import {
  CANVAS_IMAGE_NODE_TYPE,
  CANVAS_PDF_NODE_TYPE,
  CANVAS_SHAPE_NODE_TYPE,
  CANVAS_TASK_NODE_TYPE,
  CANVAS_TEXT_NODE_TYPE,
  CANVAS_EDGE_TYPE,
  canvasDocumentToEdges,
  canvasDocumentToImageNodes,
  canvasDocumentToPdfNodes,
  canvasDocumentToShapeNodes,
  canvasDocumentToTaskNodes,
  canvasDocumentToTextNodes,
  canvasImageAdapterDependenciesForCanvas,
  createCanvasPdfFlowNode,
  createCanvasPdfId,
  createCanvasTaskFlowNode,
  createCanvasTaskId,
  createCanvasEdgeFromConnection,
  createCanvasShapeFlowNode,
  createCanvasShapeId,
  createCanvasTextFlowNode,
  findCachedCanvasImagePayload,
  ingestCanvasImageTransferToNodes,
  restoreCanvasImageNodes,
  updateCanvasEdgeFlowRuntime,
  type CanvasImageAdapterDependencies,
  type CanvasFlowNode,
  type CanvasEdgeFlow,
  type CanvasEdgeFlowData,
  type CanvasImageFlowNode,
  type CanvasShapeFlowNode,
  type CanvasTaskFlowNode,
  type CanvasPdfFlowNode,
  type CanvasTextFlowNode,
  type FlowPosition,
} from "@/lib/canvas/react-flow-canvas-adapter";
import { CanvasImageLoadCache } from "@/lib/canvas/canvas-image-load-cache";
import {
  CANVAS_DOCUMENT_LIMITS,
  CANVAS_VIEWPORT_LIMITS,
  type CanvasEdgeArrows,
  type CanvasEdgeV2,
  type CanvasEdgeRouting,
  type CanvasHandleSide,
  type CanvasShapeNode,
  type CanvasShapeVariant,
} from "@/lib/canvas/canvas-document";
import type { CanvasAssetVariantRepository } from "@/lib/canvas/canvas-image-variants";
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
import type {
  CanvasGroup,
  CanvasGroupRepository,
} from "@/lib/canvas/canvas-group-repository";
import {
  type CanvasAssetRepository,
  type CanvasRepository,
  type CanvasSummary,
  type CanvasViewStateRepository,
} from "@/lib/canvas/local-canvas-repository";
import {
  emptyShellState,
  LocalCanvasShellController,
  type LocalCanvasConflictDraft,
  type LocalCanvasShellState,
} from "@/lib/canvas/local-canvas-shell-controller";
import type {
  CloudCanvasRuntimeCache,
  CanvasImageRuntimePayload,
  CloudCanvasRuntimeSnapshot,
} from "@/lib/canvas/cloud-canvas-runtime-cache";
import {
  canvasImageResolutionSourceCacheKey,
  canvasImageResolutionSourceFromLegacyKind,
} from "@/lib/canvas/canvas-image-variants";
import { CanvasImagePyramidScheduler } from "@/lib/canvas/canvas-image-pyramid";
import {
  createCanvasProjectFileImageNode,
  restoreProjectFileCanvasImageNodes,
} from "@/lib/canvas/project-file-canvas-image-adapter";
import type { ProjectFileImageVariantRepository } from "@/lib/files/project-file-image-variants";
import {
  isProjectFileImageMimeType,
  type ProjectFileRecord,
  type ProjectFileRepository,
} from "@/lib/files/project-file-repository";
import { prepareProjectFileBrowserUpload } from "@/lib/files/project-file-browser-upload";
import { shouldCloseCanvasTaskDetails } from "@/lib/canvas/canvas-task-selection";
import {
  reconcileCachedRuntimeWithServer,
  serverCanvasMatchesCachedRuntime,
} from "@/lib/canvas/canvas-runtime-cache-reconciliation";
import {
  partitionCanvasDropFiles,
  resolveCanvasDropFlowPosition,
  runCanvasMixedDrop,
} from "@/lib/canvas/canvas-file-drop-routing";
import { canvasDocumentToRuntimeSkeleton } from "@/lib/canvas/canvas-runtime-skeleton";
import {
  CanvasEdgeMarkerDefinitions,
  CanvasVisibleEdge,
} from "@/lib/canvas/canvas-visible-edge";
import {
  CanvasNodeFrame,
  ConnectionHandleLayer,
  TextAlignmentControls,
} from "./canvas-node-frame";
import { CanvasColorPicker } from "./canvas-color-picker";
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

function rememberImageRuntimePayload(
  payloads: Map<string, CanvasImageRuntimePayload>,
  node: CanvasImageFlowNode,
  scope: { workspaceId: string; canvasId: string },
): void {
  if (!node.data.objectUrl) return;
  payloads.set(
    canvasImageResolutionSourceCacheKey({
      workspaceId: scope.workspaceId,
      canvasId: scope.canvasId,
      assetId: node.data.assetId,
      source:
        node.data.resolutionSource ??
        canvasImageResolutionSourceFromLegacyKind(
          node.data.variantKind ?? "original",
        ),
    }),
    {
      objectUrl: node.data.objectUrl,
      mimeType: node.data.mimeType,
      intrinsicWidth: node.data.intrinsicWidth,
      intrinsicHeight: node.data.intrinsicHeight,
      source: node.data.source,
      variantKind: node.data.variantKind,
      resolutionSource: node.data.resolutionSource,
    },
  );
}

function renderedImageCssSizes(): Map<
  string,
  { width: number; height: number }
> {
  if (typeof document === "undefined") return new Map();
  const sizes = new Map<string, { width: number; height: number }>();
  for (const image of document.querySelectorAll<HTMLImageElement>(
    "img[data-canvas-image-node-id]",
  )) {
    const nodeId = image.dataset.canvasImageNodeId;
    const rect = image.getBoundingClientRect();
    if (!nodeId || rect.width <= 0 || rect.height <= 0) continue;
    sizes.set(nodeId, { width: rect.width, height: rect.height });
  }
  return sizes;
}

function withCachedAssetPayloads(
  nodes: readonly CanvasFlowNode[],
  assetPayloads: ReadonlyMap<string, CanvasImageRuntimePayload>,
  scope: { workspaceId: string; canvasId: string },
): CanvasFlowNode[] {
  return nodes.map((node) => {
    if (node.type !== CANVAS_IMAGE_NODE_TYPE) return node;
    const requestedSource =
      node.data.resolutionSource ??
      canvasImageResolutionSourceFromLegacyKind(
        node.data.variantKind ?? "original",
      );
    const cached = findCachedCanvasImagePayload({
      payloads: assetPayloads,
      workspaceId: scope.workspaceId,
      canvasId: scope.canvasId,
      assetId: node.data.assetId,
      requestedSource,
    });
    return cached
      ? { ...node, data: { ...node.data, ...cached.payload } }
      : node;
  });
}

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

function snapshotCanvasTouchGestureNodes(
  nodes: readonly CanvasFlowNode[],
): CanvasFlowNode[] {
  return nodes.map((node) => ({
    ...node,
    position: { ...node.position },
    ...(node.measured ? { measured: { ...node.measured } } : {}),
    ...(node.style ? { style: { ...node.style } } : {}),
  }));
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

function DecodedCanvasImage({
  nodeId,
  assetId,
  sourceUrl,
}: {
  nodeId: string;
  assetId: string;
  sourceUrl: string;
}): React.JSX.Element {
  const [activeUrl, setActiveUrl] = useState(sourceUrl);

  useEffect(() => {
    if (sourceUrl === activeUrl) return;
    let cancelled = false;
    const image = new Image();
    const commit = () => {
      if (!cancelled) setActiveUrl(sourceUrl);
    };
    image.onload = () => {
      if (typeof image.decode !== "function") {
        commit();
        return;
      }
      void image.decode().then(commit, () => undefined);
    };
    image.onerror = () => undefined;
    image.src = sourceUrl;
    return () => {
      cancelled = true;
    };
  }, [activeUrl, sourceUrl]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={styles.image}
      src={activeUrl}
      alt={`Canvas asset ${assetId}`}
      data-canvas-image-node-id={nodeId}
      draggable={false}
    />
  );
}

function ImageNodeBody({
  id,
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
        <DecodedCanvasImage
          nodeId={id}
          assetId={data.assetId}
          sourceUrl={data.objectUrl}
        />
      ) : (
        <div className={styles.image} aria-label="Loading canvas image" />
      )}
    </CanvasNodeFrame>
  );
}

const CANVAS_TEXT_FONT_LABELS: Record<CanvasTextFontFamily, string> = {
  system: "System",
  arial: "Arial",
  georgia: "Georgia",
  "times-new-roman": "Times New Roman",
  "courier-new": "Courier New",
  verdana: "Verdana",
};

function dispatchCanvasTextStylePatch(
  id: string,
  patch: Partial<CanvasTextStyle>,
): void {
  window.dispatchEvent(
    new CustomEvent("mozg:canvas-text-style", { detail: { id, patch } }),
  );
}

function dispatchCanvasStyleEyedropperStart(id: string): void {
  window.dispatchEvent(
    new CustomEvent("mozg:canvas-style-eyedropper-start", {
      detail: { id },
    }),
  );
}

function TextSelectionToolbar({
  id,
  style,
  onPatchStyle,
  toolbarLabel = "Панель форматирования текста",
  typeLabel = "Текст",
  typeGlyph = "T",
  fillLabel = "Цвет фона",
  eyedropperTitle = "Скопировать цвет текста и фона",
  resetLabel = "Убрать цвет фона",
  resetTitle = "Убрать фон",
}: {
  id: string;
  style: CanvasTextStyle;
  onPatchStyle?: (patch: Partial<CanvasTextStyle>) => void;
  toolbarLabel?: string;
  typeLabel?: string;
  typeGlyph?: string;
  fillLabel?: string;
  eyedropperTitle?: string;
  resetLabel?: string;
  resetTitle?: string;
}): React.JSX.Element {
  const patchStyle =
    onPatchStyle ??
    ((patch: Partial<CanvasTextStyle>) =>
      dispatchCanvasTextStylePatch(id, patch));
  return (
    <div
      className={`${styles.textSelectionToolbar} nodrag nopan nowheel`}
      aria-label={toolbarLabel}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className={styles.textToolbarButton}
        aria-label={typeLabel}
        title={typeLabel}
        disabled
      >
        {typeGlyph}
      </button>
      <span className={styles.textToolbarDivider} aria-hidden="true" />
      <select
        className={`${styles.textToolbarSelect} ${styles.textToolbarFontSelect}`}
        aria-label="Шрифт"
        value={style.fontFamily}
        onChange={(event) =>
          patchStyle({ fontFamily: event.target.value as CanvasTextFontFamily })
        }
      >
        {CANVAS_TEXT_FONT_FAMILIES.map((fontFamily) => (
          <option key={fontFamily} value={fontFamily}>
            {CANVAS_TEXT_FONT_LABELS[fontFamily]}
          </option>
        ))}
      </select>
      <span className={styles.textToolbarDivider} aria-hidden="true" />
      <button
        type="button"
        className={styles.textToolbarButton}
        aria-label="Уменьшить размер шрифта"
        title="Уменьшить размер"
        onClick={() =>
          patchStyle({ fontSize: previousCanvasTextFontSize(style.fontSize) })
        }
      >
        −
      </button>
      <select
        className={`${styles.textToolbarSelect} ${styles.textToolbarSizeSelect}`}
        aria-label="Размер шрифта"
        value={style.fontSize}
        onChange={(event) =>
          patchStyle({
            fontSize: Number(event.target.value) as CanvasTextFontSize,
          })
        }
      >
        {CANVAS_TEXT_FONT_SIZES.map((fontSize) => (
          <option key={fontSize} value={fontSize}>
            {fontSize}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={styles.textToolbarButton}
        aria-label="Увеличить размер шрифта"
        title="Увеличить размер"
        onClick={() =>
          patchStyle({ fontSize: nextCanvasTextFontSize(style.fontSize) })
        }
      >
        +
      </button>
      <span className={styles.textToolbarDivider} aria-hidden="true" />
      <button
        type="button"
        className={styles.textToolbarButton}
        aria-label="Полужирный"
        aria-pressed={style.bold}
        title="Полужирный"
        onClick={() => patchStyle({ bold: !style.bold })}
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        className={styles.textToolbarButton}
        aria-label="Курсив"
        aria-pressed={style.italic}
        title="Курсив"
        onClick={() => patchStyle({ italic: !style.italic })}
      >
        <em>I</em>
      </button>
      <button
        type="button"
        className={styles.textToolbarButton}
        aria-label="Подчеркнутый"
        aria-pressed={style.underline}
        title="Подчеркнутый"
        onClick={() => patchStyle({ underline: !style.underline })}
      >
        <u>U</u>
      </button>
      <button
        type="button"
        className={styles.textToolbarButton}
        aria-label="Перечеркнутый"
        aria-pressed={style.strikethrough}
        title="Перечеркнутый"
        onClick={() => patchStyle({ strikethrough: !style.strikethrough })}
      >
        <s>S</s>
      </button>
      <span className={styles.textToolbarDivider} aria-hidden="true" />
      <CanvasColorPicker
        label="Цвет текста"
        value={style.color}
        onCommit={(color) => patchStyle({ color })}
      />
      <CanvasColorPicker
        label={fillLabel}
        value={
          style.backgroundColor === "transparent"
            ? "#ffffff"
            : style.backgroundColor
        }
        onCommit={(backgroundColor) => patchStyle({ backgroundColor })}
      />
      <button
        type="button"
        className={`${styles.textToolbarButton} ${styles.styleEyedropperButton}`}
        aria-label="Пипетка"
        title={eyedropperTitle}
        onClick={() => dispatchCanvasStyleEyedropperStart(id)}
      >
        <svg
          className={styles.styleEyedropperIcon}
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="m14.5 5.5 4-4a2.12 2.12 0 0 1 3 3l-4 4m-3-3 4 4m-4-4-9.8 9.8a2 2 0 0 0-.5.8L3 21l4.9-1.2a2 2 0 0 0 .8-.5l9.8-9.8"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <span className={styles.textToolbarDivider} aria-hidden="true" />
      <TextAlignmentControls
        id={id}
        value={style.textAlign}
        onChange={(textAlign) => patchStyle({ textAlign })}
      />
      <button
        type="button"
        className={styles.textToolbarButton}
        aria-label={resetLabel}
        title={resetTitle}
        disabled={style.backgroundColor === "transparent"}
        onClick={() => patchStyle({ backgroundColor: "transparent" })}
      >
        ×
      </button>
    </div>
  );
}

function dispatchCanvasShapeStylePatch(
  id: string,
  patch: Partial<CanvasShapeStyle>,
): void {
  window.dispatchEvent(
    new CustomEvent("mozg:canvas-shape-style", { detail: { id, patch } }),
  );
}

function ShapeSelectionToolbar({
  id,
  style,
}: {
  id: string;
  style: CanvasShapeStyle;
}): React.JSX.Element {
  return (
    <TextSelectionToolbar
      id={id}
      style={canvasShapeStyleAsTextStyle(style)}
      onPatchStyle={(patch) =>
        dispatchCanvasShapeStylePatch(
          id,
          canvasTextStylePatchToShapeStyle(patch),
        )
      }
      toolbarLabel="Панель форматирования фигуры"
      typeLabel="Фигура"
      typeGlyph="◇"
      fillLabel="Цвет заливки"
      eyedropperTitle="Скопировать цвет текста и заливки"
      resetLabel="Убрать заливку"
      resetTitle="Убрать заливку"
    />
  );
}

function canvasTextCss(style: CanvasTextStyle): CSSProperties {
  const decorations = [
    style.underline ? "underline" : "",
    style.strikethrough ? "line-through" : "",
  ].filter(Boolean);
  return {
    fontFamily: canvasTextFontFamilyCss(style.fontFamily),
    fontSize: `${style.fontSize}px`,
    fontWeight: style.bold ? 700 : 400,
    fontStyle: style.italic ? "italic" : "normal",
    textDecoration: decorations.length > 0 ? decorations.join(" ") : "none",
    color: style.color,
    backgroundColor: style.backgroundColor,
    textAlign: style.textAlign,
  };
}

function CanvasTextEditor({
  id,
  markdown,
  eventKind = "text",
}: {
  id: string;
  markdown: string;
  eventKind?: "text" | "shape";
}): React.JSX.Element {
  const [draft, setDraft] = useState(markdown);
  const skipNextBlurCommitRef = useRef(false);
  const update = (value: string) => {
    setDraft(value);
    window.dispatchEvent(
      new CustomEvent(`mozg:canvas-${eventKind}-draft`, {
        detail: { id, markdown: value },
      }),
    );
  };
  const commit = () => {
    window.dispatchEvent(
      new CustomEvent(`mozg:canvas-${eventKind}-commit`, {
        detail: { id, markdown: commitTextMarkdown(draft) },
      }),
    );
  };
  const cancel = () => {
    skipNextBlurCommitRef.current = true;
    window.dispatchEvent(
      new CustomEvent(`mozg:canvas-${eventKind}-cancel`, { detail: { id } }),
    );
  };
  return (
    <textarea
      autoFocus
      value={draft}
      placeholder="Type something"
      aria-label="Canvas text"
      className={`${styles.textEditorInput} nodrag nopan nowheel`}
      onBlur={() => {
        if (skipNextBlurCommitRef.current) {
          skipNextBlurCommitRef.current = false;
          return;
        }
        commit();
      }}
      onChange={(event) => update(event.target.value)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      onPaste={(event) => event.stopPropagation()}
    />
  );
}

function PdfNodeBody({
  data,
  selected,
}: NodeProps<CanvasPdfFlowNode>): React.JSX.Element {
  return (
    <CanvasNodeFrame
      selected={selected}
      minWidth={160}
      minHeight={100}
      className={`${styles.pdfNodeFrame} ${
        data.readerOpen ? styles.pdfNodeFrameReaderOpen : ""
      }`.trim()}
      connectionHandleLayer={<ConnectionHandleLayer selected={selected} />}
    >
      <div className={styles.pdfNodeContent}>
        <span className={styles.pdfNodeBadge}>PDF</span>
        <span
          className={styles.pdfNodeName}
          title={data.lastKnownName ?? "PDF"}
        >
          {data.lastKnownName ?? "PDF"}
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
  const textStyle = canvasTextCss(data.style);
  return (
    <CanvasNodeFrame
      selected={selected}
      minWidth={120}
      minHeight={32}
      className={styles.textNodeFrame}
      toolbar={<TextSelectionToolbar id={id} style={data.style} />}
      connectionHandleLayer={<ConnectionHandleLayer selected={selected} />}
    >
      <div
        className={styles.textNodeContent}
        style={textStyle}
        onDoubleClick={(event) => {
          event.stopPropagation();
          window.dispatchEvent(
            new CustomEvent("mozg:canvas-text-edit", { detail: { id } }),
          );
        }}
      >
        {data.isEditing ? (
          <CanvasTextEditor id={id} markdown={data.markdown} />
        ) : data.markdown.trim() ? (
          <div className={styles.textPreview}>
            <MarkdownStringPreview contentId={id} markdown={data.markdown} />
          </div>
        ) : (
          <span className={styles.textPlaceholder}>Type something</span>
        )}
      </div>
    </CanvasNodeFrame>
  );
}

function ShapeNodeBody({
  data,
  selected,
  id,
}: NodeProps<CanvasShapeFlowNode>): React.JSX.Element {
  const visualStyle = canvasTextCss(canvasShapeStyleAsTextStyle(data.style));
  return (
    <CanvasNodeFrame
      selected={selected}
      minWidth={data.shape === "circle" ? 80 : 100}
      minHeight={data.shape === "circle" ? 80 : 60}
      keepAspectRatio={data.shape === "circle"}
      centerTextContent
      className={styles.shapeNodeFrame}
      toolbar={<ShapeSelectionToolbar id={id} style={data.style} />}
      connectionHandleLayer={<ConnectionHandleLayer selected={selected} />}
    >
      <div
        className={`${styles.shapeNodeContent} ${
          data.shape === "circle"
            ? styles.shapeNodeCircle
            : styles.shapeNodeRectangle
        }`}
        style={visualStyle}
        data-canvas-shape={data.shape}
        onDoubleClick={(event) => {
          event.stopPropagation();
          window.dispatchEvent(
            new CustomEvent("mozg:canvas-shape-edit", { detail: { id } }),
          );
        }}
      >
        {data.isEditing ? (
          <CanvasTextEditor
            id={id}
            markdown={data.markdown}
            eventKind="shape"
          />
        ) : data.markdown.trim() ? (
          <div className={styles.textPreview}>
            <MarkdownStringPreview contentId={id} markdown={data.markdown} />
          </div>
        ) : (
          <span className={styles.textPlaceholder}>Введите текст</span>
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
  const [lastPath, setLastPath] = useState("M0,0 L0,0");
  const sourceNode = useInternalNode<CanvasFlowNode>(source);
  const targetNode = useInternalNode<CanvasFlowNode>(target);
  const sourcePositionSide = sourcePosition as CanvasHandleSide;
  const targetPositionSide = targetPosition as CanvasHandleSide;
  const sourceBounds = canvasInternalNodeBounds(sourceNode);
  const targetBounds = canvasInternalNodeBounds(targetNode);
  const geometry =
    sourceBounds && targetBounds
      ? {
          sourceAnchor: canvasNodePerimeterAnchor(
            sourceBounds,
            sourcePositionSide,
          ),
          targetAnchor: canvasNodePerimeterAnchor(
            targetBounds,
            targetPositionSide,
          ),
        }
      : null;
  const computedPath = geometry
    ? data?.routing === "orthogonal"
      ? getSmoothStepPath({
          sourceX: geometry.sourceAnchor.x,
          sourceY: geometry.sourceAnchor.y,
          sourcePosition,
          targetX: geometry.targetAnchor.x,
          targetY: geometry.targetAnchor.y,
          targetPosition,
        })
      : data?.routing === "straight"
        ? getStraightPath({
            sourceX: geometry.sourceAnchor.x,
            sourceY: geometry.sourceAnchor.y,
            targetX: geometry.targetAnchor.x,
            targetY: geometry.targetAnchor.y,
          })
        : getBezierPath({
            sourceX: geometry.sourceAnchor.x,
            sourceY: geometry.sourceAnchor.y,
            sourcePosition,
            targetX: geometry.targetAnchor.x,
            targetY: geometry.targetAnchor.y,
            targetPosition,
          })
    : null;
  const computedPathValue = computedPath?.[0] ?? null;
  useEffect(() => {
    if (!computedPathValue || computedPathValue === lastPath) return;
    const timer = window.setTimeout(() => setLastPath(computedPathValue), 0);
    return () => window.clearTimeout(timer);
  }, [computedPathValue, lastPath]);
  if (!computedPath) {
    return (
      <g
        data-canvas-edge-id={id}
        data-source-node-id={source}
        data-target-node-id={target}
      >
        <CanvasVisibleEdge
          id={id}
          path={lastPath}
          className={selected ? styles.selectedEdge : styles.canvasEdge}
          markerStart={markerStart}
          markerEnd={markerEnd}
          interactionWidth={24}
        />
      </g>
    );
  }
  const [path, labelX, labelY] = computedPath;
  const arrows = data?.arrows ?? "none";
  const endpointArrows = canvasArrowsToEndpointArrows(arrows);
  const routing = data?.routing ?? "curved";
  const stopToolbarEvent = (event: React.SyntheticEvent): void => {
    event.stopPropagation();
  };
  return (
    <>
      <g
        data-canvas-edge-id={id}
        data-source-node-id={source}
        data-target-node-id={target}
      >
        <CanvasVisibleEdge
          id={id}
          path={path}
          className={selected ? styles.selectedEdge : styles.canvasEdge}
          markerStart={markerStart}
          markerEnd={markerEnd}
          interactionWidth={24}
        />
      </g>
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
  [CANVAS_PDF_NODE_TYPE]: PdfNodeBody,
  [CANVAS_TASK_NODE_TYPE]: TaskNodeBody,
  [CANVAS_TEXT_NODE_TYPE]: TextNodeBody,
  [CANVAS_SHAPE_NODE_TYPE]: ShapeNodeBody,
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
  keepLocalChanges: string;
  restoreLocalDraft: string;
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
  groupRepository,
  projectFileRepository,
  projectFileVariantRepository,
  projectId,
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
  groupRepository?: CanvasGroupRepository;
  projectFileRepository?: ProjectFileRepository;
  projectFileVariantRepository?: ProjectFileImageVariantRepository;
  projectId?: string;
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
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pdfUploadInFlightRef = useRef(new Map<string, Promise<void>>());
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreControllerRef = useRef<AbortController | null>(null);
  const variantRefreshControllerRef = useRef<AbortController | null>(null);
  const variantRefreshSequenceRef = useRef(0);
  const variantRefreshFrameRef = useRef<number | null>(null);
  const variantDowngradeTimerRef = useRef<number | null>(null);
  const imageLoadCacheRef = useRef(new CanvasImageLoadCache());
  const pyramidSchedulerRef = useRef(new CanvasImagePyramidScheduler());
  const imageLoadCacheCanvasIdRef = useRef<string | null>(
    initialRuntime?.shellState.canvasId ?? null,
  );
  const refreshImageVariantsRef = useRef<
    (viewportZoom: number, allowDowngrade: boolean) => void
  >(() => undefined);
  const variantPayloadsRef = useRef<Map<string, CanvasImageRuntimePayload>>(
    new Map(initialRuntime?.assetPayloads),
  );
  const pendingContentHeightSaveRef = useRef(false);
  const nodeGeometrySignatureRef = useRef("");
  const nodeDragActiveRef = useRef(false);
  const altDragDuplicateRef = useRef<CanvasAltDragDuplicateSession | null>(
    null,
  );
  const middlePanActiveRef = useRef(false);
  const activeTouchPointersRef = useRef(new Set<number>());
  const touchGestureNodesRef = useRef<CanvasFlowNode[] | null>(null);
  const touchViewportGestureActiveRef = useRef(false);
  const panSamplesRef = useRef<CanvasPanSample[]>([]);
  const panInertiaFrameRef = useRef<number | null>(null);
  const panInertiaActiveRef = useRef(false);
  const panInertiaVelocityRef = useRef<CanvasPanVelocity | null>(null);
  const panInertiaViewportRef = useRef<CanvasPanViewport | null>(null);
  const panInertiaLastFrameRef = useRef<number | null>(null);
  const edgeRemovalSuppressionUntilRef = useRef(0);
  const hydratingRef = useRef(true);
  const canvasGenerationRef = useRef(0);
  const programmaticViewportRef = useRef<CanvasViewportInitialization | null>(
    null,
  );
  const screenToFlowRef = useRef<
    (point: { x: number; y: number }) => FlowPosition
  >(() => ({ x: 0, y: 0 }));
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasFlowNode>([]);
  const [edges, setEdges] = useEdgesState<CanvasEdgeFlow>([]);
  const [summaries, setSummaries] = useState<CanvasSummary[]>(
    initialRuntime?.summaries ?? [],
  );
  const [groups, setGroups] = useState<CanvasGroup[]>([]);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [shellState, setShellState] = useState<LocalCanvasShellState>(
    initialRuntime?.shellState ?? emptyShellState,
  );
  const [conflictDraftAvailable, setConflictDraftAvailable] = useState(false);
  const [loadingLifecycle, setLoadingLifecycle] =
    useState<CanvasLoadingLifecycle>(
      initialRuntime?.shellState.canvasId ? "ready" : "list-loading",
    );
  const [restoreStats, setRestoreStats] =
    useState<RestoreStats>(EMPTY_RESTORE_STATS);
  const [dropActive, setDropActive] = useState(false);
  const [newTitle, setNewTitle] = useState(copy.defaultTitle);
  const [renameTitle, setRenameTitle] = useState("");
  const renameInFlightRef = useRef(new Set<string>());
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [taskQuery, setTaskQuery] = useState("");
  const [taskResults, setTaskResults] = useState<CanvasTaskProjection[]>([]);
  const [filePickerOpen, setFilePickerOpen] = useState(false);
  const [openPdf, setOpenPdf] = useState<{
    fileId: string;
    name: string;
    nodeId: string;
    objectUrl: string;
  } | null>(null);
  const [pdfFullscreen, setPdfFullscreen] = useState(false);
  const renderedNodes = useMemo<CanvasFlowNode[]>(() => {
    const openNodeId = openPdf?.nodeId;
    if (!openNodeId) return nodes;
    return nodes.map((node) =>
      node.id === openNodeId && node.type === CANVAS_PDF_NODE_TYPE
        ? { ...node, data: { ...node.data, readerOpen: true } }
        : node,
    );
  }, [nodes, openPdf?.nodeId]);
  const [fileQuery, setFileQuery] = useState("");
  const [fileCatalog, setFileCatalog] = useState<ProjectFileRecord[]>([]);
  const [fileSearchStatus, setFileSearchStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [taskSearchStatus, setTaskSearchStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [touchPrimaryInput, setTouchPrimaryInput] = useState(false);
  const [touchViewportGestureActive, setTouchViewportGestureActive] =
    useState(false);
  const [styleEyedropperSourceId, setStyleEyedropperSourceId] = useState<
    string | null
  >(null);
  useEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const frame = window.requestAnimationFrame(() => {
      setDesktopSidebarOpen(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const syncPrimaryTouchInput = (): void => {
      setTouchPrimaryInput(media.matches);
    };
    syncPrimaryTouchInput();
    media.addEventListener("change", syncPrimaryTouchInput);
    return () => media.removeEventListener("change", syncPrimaryTouchInput);
  }, []);
  const [flowInstanceEpoch, setFlowInstanceEpoch] = useState(0);
  const [viewportInitialization, setViewportInitialization] =
    useState<CanvasViewportInitialization | null>(null);
  const [viewportVisible, setViewportVisible] = useState(
    Boolean(initialRuntime?.shellState.canvasId),
  );
  const repository = providedRepository;
  const groupsRepository = groupRepository;
  const imageRepository = assetRepository;
  const shellWorkspaceId = workspaceId;
  const shellUserId = userId;
  const conflictDraftStorageKey = useMemo(
    () =>
      `mozg:canvas-conflict-draft:v1:${shellUserId}:${shellWorkspaceId}:${projectId ?? "default"}:${shellState.canvasId ?? "none"}`,
    [projectId, shellState.canvasId, shellUserId, shellWorkspaceId],
  );
  const imageLoadCacheUserIdRef = useRef(shellUserId);
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
  const adapterDependencies = useMemo<CanvasImageAdapterDependencies>(() => {
    const reportVariantError = (label: string, error: unknown): void => {
      if (process.env.NODE_ENV === "production") return;
      if (error instanceof Error && "code" in error) {
        const diagnostic = error as Error & {
          code?: unknown;
          details?: unknown;
        };
        console.warn(
          label,
          JSON.stringify({
            code: diagnostic.code,
            details: diagnostic.details,
            message: diagnostic.message,
          }),
        );
        return;
      }
      console.warn(label, error);
    };
    const variantRepository =
      "loadVariant" in imageRepository
        ? (imageRepository as unknown as CanvasAssetVariantRepository)
        : undefined;
    return {
      assetRepository: imageRepository,
      ...(variantRepository === undefined ? {} : { variantRepository }),
      objectUrls,
      userId: shellUserId,
      workspaceId: shellWorkspaceId,
      canvasId: shellState.canvasId ?? undefined,
      loadCache: imageLoadCacheRef.current,
      pyramidScheduler: pyramidSchedulerRef.current,
      onPyramidComplete: ({ result }) => {
        if (result.stored.length === 0) return;
        refreshImageVariantsRef.current(
          shellStateRef.current.viewport.zoom,
          false,
        );
      },
      onVariantError: (error: unknown) => {
        reportVariantError("Canvas image variant generation failed.", error);
      },
    };
  }, [
    imageRepository,
    objectUrls,
    shellState.canvasId,
    shellUserId,
    shellWorkspaceId,
  ]);

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
    if (imageLoadCacheUserIdRef.current === shellUserId) return;
    imageLoadCacheUserIdRef.current = shellUserId;
    imageLoadCacheRef.current.clear();
    imageLoadCacheCanvasIdRef.current = shellStateRef.current.canvasId;
  }, [shellUserId]);

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

  useEffect(() => {
    if (!filePickerOpen || !projectFileRepository || !projectId) {
      setFileCatalog([]);
      setFileSearchStatus("idle");
      return;
    }
    let active = true;
    setFileSearchStatus("loading");
    void projectFileRepository
      .listFiles({ workspaceId: shellWorkspaceId, projectId })
      .then(
        (files) => {
          if (!active) return;
          setFileCatalog(
            files.filter(
              (file) =>
                file.readyAt !== null &&
                file.deletedAt === null &&
                (file.mimeType === "application/pdf" ||
                  (file.width !== null &&
                    file.height !== null &&
                    isProjectFileImageMimeType(file.mimeType))),
            ),
          );
          setFileSearchStatus("ready");
        },
        () => {
          if (!active) return;
          setFileCatalog([]);
          setFileSearchStatus("error");
        },
      );
    return () => {
      active = false;
    };
  }, [filePickerOpen, projectFileRepository, projectId, shellWorkspaceId]);

  useEffect(() => {
    if (!filePickerOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setFilePickerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filePickerOpen]);

  const fileResults = useMemo(() => {
    const query = fileQuery.trim().toLocaleLowerCase("ru");
    if (!query) return fileCatalog;
    return fileCatalog.filter((file) =>
      file.name.toLocaleLowerCase("ru").includes(query),
    );
  }, [fileCatalog, fileQuery]);

  const projectFileImageDependenciesForCanvas = useCallback(
    (canvasId: string) =>
      projectFileRepository && projectFileVariantRepository && projectId
        ? {
            fileRepository: projectFileRepository,
            variantRepository: projectFileVariantRepository,
            objectUrls,
            workspaceId: shellWorkspaceId,
            projectId,
            canvasId,
          }
        : null,
    [
      objectUrls,
      projectFileRepository,
      projectFileVariantRepository,
      projectId,
      shellWorkspaceId,
    ],
  );

  const syncState = useCallback(
    () => setShellState(controller.state),
    [controller],
  );

  const saveConflictDraft = useCallback(
    (state: LocalCanvasShellState): void => {
      if (!state.canvasId || typeof window === "undefined") return;
      const draft: LocalCanvasConflictDraft = {
        canvasId: state.canvasId,
        title: state.title,
        document: state.document,
        viewport: state.viewport,
      };
      try {
        window.localStorage.setItem(
          conflictDraftStorageKey,
          JSON.stringify(draft),
        );
        setConflictDraftAvailable(true);
      } catch {
        // The controller still holds the draft if browser storage is unavailable.
      }
    },
    [conflictDraftStorageKey],
  );

  const readConflictDraft = useCallback((): LocalCanvasConflictDraft | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(conflictDraftStorageKey);
      if (!raw) return null;
      const draft = JSON.parse(raw) as LocalCanvasConflictDraft;
      return draft && typeof draft.canvasId === "string" ? draft : null;
    } catch {
      return null;
    }
  }, [conflictDraftStorageKey]);

  const clearConflictDraft = useCallback((): void => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(conflictDraftStorageKey);
    } finally {
      setConflictDraftAvailable(false);
    }
  }, [conflictDraftStorageKey]);

  useEffect(() => {
    setConflictDraftAvailable(readConflictDraft() !== null);
  }, [readConflictDraft]);

  useEffect(() => {
    // A rejected save is just as recoverable as a CAS conflict.  Persist the
    // canonical draft before the user can navigate or reload the page.
    if (
      (shellState.status === "conflict" || shellState.status === "error") &&
      controller.hasPendingSave
    ) {
      saveConflictDraft(shellState);
    }
  }, [controller, saveConflictDraft, shellState]);

  const refreshCatalog = useCallback(async (): Promise<{
    summaries: CanvasSummary[];
    groups: CanvasGroup[];
  }> => {
    const [nextSummaries, nextGroups] = await Promise.all([
      controller.listCanvases(),
      groupsRepository?.listCanvasGroups(shellWorkspaceId) ??
        Promise.resolve([] as CanvasGroup[]),
    ]);
    setSummaries(nextSummaries);
    setGroups(nextGroups);
    setGroupsError(null);
    return { summaries: nextSummaries, groups: nextGroups };
  }, [controller, groupsRepository, shellWorkspaceId]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      if (hydratingRef.current) return;
      void controller.save().then(syncState).catch(syncState);
    }, 260);
  }, [controller, syncState]);

  useEffect(() => {
    const persistBranchCollapse = (event: Event): void => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as CanvasBranchCollapseEventDetail;
      if (
        !detail ||
        typeof detail.nodeId !== "string" ||
        typeof detail.collapsed !== "boolean"
      )
        return;
      controller.setCanvasBranchCollapsed(detail.nodeId, detail.collapsed);
      syncState();
      scheduleSave();
    };
    window.addEventListener(
      CANVAS_BRANCH_COLLAPSE_EVENT,
      persistBranchCollapse,
    );
    return () =>
      window.removeEventListener(
        CANVAS_BRANCH_COLLAPSE_EVENT,
        persistBranchCollapse,
      );
  }, [controller, scheduleSave, syncState]);

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
      if (touchViewportGestureActiveRef.current) return;
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
      const suppressRemoval =
        nodeDragActiveRef.current ||
        edgeRemovalSuppressionUntilRef.current > Date.now();
      const safeChanges = suppressRemoval
        ? changes.filter((change) => change.type !== "remove")
        : changes;
      const removed = changes.filter(
        (
          change,
        ): change is Extract<EdgeChange<CanvasEdgeFlow>, { type: "remove" }> =>
          change.type === "remove",
      );
      if (removed.length > 0 && !suppressRemoval) {
        const nextState = controller.removeCanvasEdges(
          removed.map((change) => change.id),
        );
        setShellState(nextState);
        scheduleSave();
      }
      setEdges((current) => {
        const next = applyEdgeChanges(safeChanges, current);
        if (!suppressRemoval) return next;
        const canonical = canvasDocumentToEdges(
          controller.state.document,
          handleEdgeUpdate,
        );
        const known = new Set(next.map((edge) => edge.id));
        return [...next, ...canonical.filter((edge) => !known.has(edge.id))];
      });
    },
    [controller, handleEdgeUpdate, scheduleSave, setEdges],
  );

  const handleNodeDragStart = useCallback(
    (event: MouseEvent | TouchEvent, node: CanvasFlowNode): void => {
      if (touchViewportGestureActiveRef.current) return;
      nodeDragActiveRef.current = true;
      edgeRemovalSuppressionUntilRef.current = Date.now() + 5000;
      altDragDuplicateRef.current = null;
      if (!event.altKey) return;
      if (
        nodesRef.current.some(
          (candidate) => candidate.selected && candidate.id !== node.id,
        )
      )
        return;

      const document = controller.state.document;
      if (document.nodes.length >= CANVAS_DOCUMENT_LIMITS.maxNodes) return;
      const canonical = document.nodes.find(
        (candidate) => candidate.id === node.id,
      );
      if (!canonical) return;
      const highestZIndex = document.nodes.reduce(
        (maximum, candidate) => Math.max(maximum, candidate.zIndex),
        0,
      );
      const duplicate = createCanvasAltDragDuplicate(canonical, {
        zIndex: highestZIndex + 1,
      });
      if (!duplicate) return;

      const runtimeDuplicate = createCanvasAltDragRuntimeNode(node, duplicate);
      altDragDuplicateRef.current = {
        sourceNodeId: node.id,
        duplicateNodeId: duplicate.id,
        duplicate,
        finalPosition: { ...duplicate.position },
      };
      const nextNodes = [...nodesRef.current, runtimeDuplicate];
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
    },
    [controller, setNodes],
  );

  const handleNodeDragStop = useCallback((): void => {
    nodeDragActiveRef.current = false;
    edgeRemovalSuppressionUntilRef.current = Date.now() + 5000;
    if (touchViewportGestureActiveRef.current) return;

    const duplicateSession = altDragDuplicateRef.current;
    altDragDuplicateRef.current = null;
    if (duplicateSession) {
      const duplicate = finalizeCanvasAltDragDuplicate(duplicateSession);
      const nextNodes = nodesRef.current.map((candidate) => {
        if (candidate.id === duplicateSession.sourceNodeId)
          return { ...candidate, selected: false };
        if (candidate.id === duplicateSession.duplicateNodeId)
          return {
            ...candidate,
            position: { ...duplicate.position },
            selected: true,
          };
        return candidate;
      });
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
      controller.insertCanvasNodes([duplicate]);
      controller.setRuntimeEdges(edgesRef.current);
      syncState();
      scheduleSave();
      return;
    }

    window.setTimeout(() => {
      if (!shellStateRef.current.canvasId) return;
      controller.setRuntimeEdges(edgesRef.current);
      syncState();
      scheduleSave();
    }, 0);
  }, [controller, scheduleSave, setNodes, syncState]);

  const handleTaskNodeContentHeightChange = useCallback((): void => {
    // Task projection is runtime-only; it must never resize canonical bounds.
  }, []);

  const restoreForCanvas = useCallback(
    async (nextState: LocalCanvasShellState) => {
      restoreControllerRef.current?.abort();
      variantRefreshControllerRef.current?.abort();
      pendingContentHeightSaveRef.current = false;
      if (variantRefreshFrameRef.current !== null) {
        window.cancelAnimationFrame(variantRefreshFrameRef.current);
        variantRefreshFrameRef.current = null;
      }
      if (variantDowngradeTimerRef.current !== null) {
        clearTimeout(variantDowngradeTimerRef.current);
        variantDowngradeTimerRef.current = null;
      }
      if (imageLoadCacheCanvasIdRef.current !== nextState.canvasId) {
        if (imageLoadCacheCanvasIdRef.current) {
          pyramidSchedulerRef.current.cancelScope(
            {
              userId: shellUserId,
              workspaceId: shellWorkspaceId,
              canvasId: imageLoadCacheCanvasIdRef.current,
            },
            true,
          );
        }
        imageLoadCacheRef.current.clear();
        imageLoadCacheCanvasIdRef.current = nextState.canvasId;
      }
      restoreControllerRef.current = new AbortController();
      variantPayloadsRef.current.clear();
      objectUrls.revokeAll();
      const signal = restoreControllerRef.current.signal;
      const placeholders: CanvasFlowNode[] = [
        ...canvasDocumentToImageNodes(nextState.document),
        ...canvasDocumentToPdfNodes(nextState.document),
        ...canvasDocumentToTaskNodes(nextState.document, {
          onContentHeightChange: handleTaskNodeContentHeightChange,
          taskBridge: taskBridgeRef.current,
          taskWorkspaceId: taskWorkspaceIdRef.current,
        }),
        ...canvasDocumentToTextNodes(nextState.document),
        ...canvasDocumentToShapeNodes(nextState.document),
      ];
      const restoredEdges = canvasDocumentToEdges(
        nextState.document,
        handleEdgeUpdate,
      );
      const projected = projectCanvasBranchCollapse(
        placeholders,
        restoredEdges,
        undefined,
        canvasBranchCollapsedNodeIds(nextState.document.nodes),
      );
      setNodes(projected.nodes);
      setEdges(projected.edges);
      hydratingRef.current = true;
      setRestoreStats(EMPTY_RESTORE_STATS);
      setLoadingLifecycle("skeleton-ready");
      setLoadingLifecycle("content-hydrating");
      const restoreDependencies = canvasImageAdapterDependenciesForCanvas(
        adapterDependencies,
        nextState.canvasId,
      );
      const applyRestoredNode = (node: CanvasImageFlowNode): void => {
        if (signal.aborted) return;
        setNodes((current) => {
          const index = current.findIndex((item) => item.id === node.id);
          if (index < 0) return [...current, node];
          const copy = [...current];
          const existing = copy[index];
          if (existing?.type !== CANVAS_IMAGE_NODE_TYPE) return current;
          rememberImageRuntimePayload(variantPayloadsRef.current, node, {
            workspaceId: shellWorkspaceId,
            canvasId: nextState.canvasId ?? "",
          });
          copy[index] = {
            ...existing,
            data: { ...existing.data, ...node.data },
          };
          return copy;
        });
      };
      const result = await restoreCanvasImageNodes(
        nextState.document,
        restoreDependencies,
        {
          signal,
          concurrency: 4,
          viewportZoom: nextState.viewport.zoom,
          onNode: applyRestoredNode,
        },
      );
      const projectFileDependencies = nextState.canvasId
        ? projectFileImageDependenciesForCanvas(nextState.canvasId)
        : null;
      const projectFileResult = projectFileDependencies
        ? await restoreProjectFileCanvasImageNodes(
            nextState.document,
            projectFileDependencies,
            {
              signal,
              concurrency: 4,
              viewportZoom: nextState.viewport.zoom,
              cachedAssetPayloads: variantPayloadsRef.current,
              onNode: applyRestoredNode,
            },
          )
        : {
            nodes: [],
            missingFileIds: [],
            fileReadCount: 0,
            maxConcurrentFileReads: 0,
          };
      if (signal.aborted) return;
      setRestoreStats({
        reads: result.assetReadCount + projectFileResult.fileReadCount,
        maxConcurrency: Math.max(
          result.maxConcurrentAssetReads,
          projectFileResult.maxConcurrentFileReads,
        ),
        missing:
          result.missingAssetIds.length +
          projectFileResult.missingFileIds.length,
      });
      hydratingRef.current = false;
      if (pendingContentHeightSaveRef.current) {
        pendingContentHeightSaveRef.current = false;
      }
      setLoadingLifecycle("ready");
    },
    [
      adapterDependencies,
      handleEdgeUpdate,
      handleTaskNodeContentHeightChange,
      objectUrls,
      projectFileImageDependenciesForCanvas,
      setEdges,
      setNodes,
      shellUserId,
      shellWorkspaceId,
    ],
  );

  const restoreForCanvasRef = useRef(restoreForCanvas);
  restoreForCanvasRef.current = restoreForCanvas;

  const applyCanvasHistory = useCallback(
    (direction: "undo" | "redo") => {
      const nextState =
        direction === "undo"
          ? controller.undoDocument()
          : controller.redoDocument();
      if (!nextState) return;
      setShellState(nextState);
      void restoreForCanvas(nextState)
        .then(() => {
          syncState();
          scheduleSave();
        })
        .catch((error: unknown) => {
          hydratingRef.current = false;
          setLoadingLifecycle("error");
          setShellState({
            ...controller.state,
            status: "error",
            error:
              error instanceof Error
                ? error.message
                : "Canvas history restore failed.",
          });
        });
    },
    [controller, restoreForCanvas, scheduleSave, syncState],
  );

  useEffect(() => {
    const onHistoryKeyDown = (event: KeyboardEvent): void => {
      if (
        eventTouchesEditingSurface(event) ||
        !(event.ctrlKey || event.metaKey)
      )
        return;
      const key = event.key.toLowerCase();
      const direction =
        key === "y" || (key === "z" && event.shiftKey)
          ? "redo"
          : key === "z"
            ? "undo"
            : null;
      if (!direction) return;
      if (direction === "undo" ? !controller.canUndo : !controller.canRedo)
        return;
      event.preventDefault();
      applyCanvasHistory(direction);
    };
    window.addEventListener("keydown", onHistoryKeyDown, true);
    return () => window.removeEventListener("keydown", onHistoryKeyDown, true);
  }, [applyCanvasHistory, controller]);

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

  const refreshImageVariants = useCallback(
    (viewportZoom: number, allowDowngrade: boolean): void => {
      if (
        hydratingRef.current ||
        !adapterDependencies.variantRepository ||
        !adapterDependencies.canvasId
      )
        return;
      variantRefreshControllerRef.current?.abort();
      const controller = new AbortController();
      const sequence = ++variantRefreshSequenceRef.current;
      variantRefreshControllerRef.current = controller;
      const projectFileDependencies = adapterDependencies.canvasId
        ? projectFileImageDependenciesForCanvas(adapterDependencies.canvasId)
        : null;
      if (projectFileDependencies) {
        void restoreProjectFileCanvasImageNodes(
          shellStateRef.current.document,
          projectFileDependencies,
          {
            signal: controller.signal,
            viewportZoom,
            devicePixelRatio: window.devicePixelRatio,
            renderedCssSizes: renderedImageCssSizes(),
            currentResolutionSources: new Map(
              nodesRef.current.flatMap((node) =>
                node.type === CANVAS_IMAGE_NODE_TYPE && node.data.fileId
                  ? [
                      [
                        node.id,
                        node.data.resolutionSource ??
                          canvasImageResolutionSourceFromLegacyKind(
                            node.data.variantKind ?? "original",
                          ),
                      ] as const,
                    ]
                  : [],
              ),
            ),
            cachedAssetPayloads: variantPayloadsRef.current,
            allowDowngrade,
            concurrency: 4,
            onNode: (node) => {
              if (
                controller.signal.aborted ||
                sequence !== variantRefreshSequenceRef.current
              )
                return;
              setNodes((current) => {
                const index = current.findIndex((item) => item.id === node.id);
                const existing = current[index];
                if (index < 0 || existing?.type !== CANVAS_IMAGE_NODE_TYPE)
                  return current;
                rememberImageRuntimePayload(variantPayloadsRef.current, node, {
                  workspaceId: shellWorkspaceId,
                  canvasId: adapterDependencies.canvasId ?? "",
                });
                const next = [...current];
                next[index] = {
                  ...existing,
                  data: { ...existing.data, ...node.data },
                };
                return next;
              });
            },
          },
        ).catch(() => undefined);
      }
      void restoreCanvasImageNodes(
        shellStateRef.current.document,
        adapterDependencies,
        {
          signal: controller.signal,
          viewportZoom,
          devicePixelRatio: window.devicePixelRatio,
          renderedCssSizes: renderedImageCssSizes(),
          currentResolutionSources: new Map(
            nodesRef.current.flatMap((node) =>
              node.type === CANVAS_IMAGE_NODE_TYPE
                ? [
                    [
                      node.id,
                      node.data.resolutionSource ??
                        canvasImageResolutionSourceFromLegacyKind(
                          node.data.variantKind ?? "original",
                        ),
                    ] as const,
                  ]
                : [],
            ),
          ),
          cachedAssetPayloads: variantPayloadsRef.current,
          allowDowngrade,
          concurrency: 4,
          onNode: (node) => {
            if (
              controller.signal.aborted ||
              sequence !== variantRefreshSequenceRef.current
            )
              return;
            setNodes((current) => {
              const index = current.findIndex((item) => item.id === node.id);
              const existing = current[index];
              if (index < 0 || existing?.type !== CANVAS_IMAGE_NODE_TYPE)
                return current;
              rememberImageRuntimePayload(variantPayloadsRef.current, node, {
                workspaceId: shellWorkspaceId,
                canvasId: adapterDependencies.canvasId ?? "",
              });
              const next = [...current];
              next[index] = {
                ...existing,
                data: { ...existing.data, ...node.data },
              };
              return next;
            });
          },
        },
      )
        .catch(() => undefined)
        .finally(() => {
          if (variantRefreshControllerRef.current === controller)
            variantRefreshControllerRef.current = null;
        });
    },
    [
      adapterDependencies,
      projectFileImageDependenciesForCanvas,
      setNodes,
      shellWorkspaceId,
    ],
  );
  refreshImageVariantsRef.current = refreshImageVariants;

  const scheduleImageVariantRefresh = useCallback(
    (viewportZoom: number, allowDowngrade: boolean): void => {
      if (variantRefreshFrameRef.current !== null)
        window.cancelAnimationFrame(variantRefreshFrameRef.current);
      variantRefreshFrameRef.current = window.requestAnimationFrame(() => {
        variantRefreshFrameRef.current = null;
        refreshImageVariants(viewportZoom, allowDowngrade);
      });
    },
    [refreshImageVariants],
  );

  const restoreCachedScene = useCallback(
    (snapshot: CloudCanvasRuntimeSnapshot): void => {
      const cachedState = controller.restoreRuntimeState(snapshot.shellState);
      if (!cachedState.canvasId) return;
      const generation = ++canvasGenerationRef.current;
      variantPayloadsRef.current = new Map(snapshot.assetPayloads);
      const skeleton = canvasDocumentToRuntimeSkeleton(cachedState.document, {
        onContentHeightChange: handleTaskNodeContentHeightChange,
        taskBridge: taskBridgeRef.current,
        taskWorkspaceId: taskWorkspaceIdRef.current,
      });
      // Keep the runtime-cache composition contract explicit for desktop-shell checks:
      // setNodes(withCachedAssetPayloads(skeleton, snapshot.assetPayloads))
      const cachedEdges = canvasDocumentToEdges(
        cachedState.document,
        handleEdgeUpdate,
      );
      const projected = projectCanvasBranchCollapse(
        withCachedAssetPayloads(skeleton, snapshot.assetPayloads, {
          workspaceId: shellWorkspaceId,
          canvasId: cachedState.canvasId,
        }),
        cachedEdges,
        undefined,
        canvasBranchCollapsedNodeIds(cachedState.document.nodes),
      );
      setNodes(projected.nodes);
      setEdges(projected.edges);
      setShellState(cachedState);
      setRenameTitle(cachedState.title);
      hydratingRef.current = false;
      setLoadingLifecycle("ready");
      setViewportInitialization({
        canvasId: cachedState.canvasId,
        generation,
        viewport: { ...cachedState.viewport },
      });
    },
    [
      controller,
      handleEdgeUpdate,
      handleTaskNodeContentHeightChange,
      shellWorkspaceId,
      setEdges,
      setNodes,
    ],
  );

  useEffect(
    () => () => {
      setOpenPdf((current) => {
        if (current) URL.revokeObjectURL(current.objectUrl);
        return null;
      });
    },
    [],
  );

  useEffect(() => {
    let active = true;
    const pyramidScheduler = pyramidSchedulerRef.current;
    if (initialRuntime) restoreCachedScene(initialRuntime);
    const groupLoad = groupsRepository
      ? groupsRepository
          .listCanvasGroups(shellWorkspaceId)
          .catch((error: unknown) => {
            if (active) {
              setGroupsError(
                error instanceof Error
                  ? error.message
                  : "Canvas groups failed to load.",
              );
            }
            return [] as CanvasGroup[];
          })
      : Promise.resolve([] as CanvasGroup[]);
    void Promise.all([controller.listCanvases(), groupLoad])
      .then(async ([items, nextGroups]) => {
        if (!active) return;
        setSummaries(items);
        setGroups(nextGroups);
        const cachedCanvasId = initialRuntime?.shellState.canvasId;
        const cachedSummary = cachedCanvasId
          ? items.find((item) => item.id === cachedCanvasId)
          : undefined;
        if (cachedSummary && initialRuntime) {
          const unchanged =
            cachedSummary.revision === initialRuntime.shellState.revision;

          if (initialRuntime.shellState.status !== "saved" && unchanged) {
            const saveResult = await controller.save();
            if (
              saveResult?.status !== "conflict" &&
              controller.state.status === "saved"
            ) {
              const savedState = controller.state;
              setShellState(savedState);
              setRenameTitle(savedState.title);
              await restoreForCanvasRef.current(savedState);
              return;
            }
          }

          if (initialRuntime.shellState.status !== "saved") {
            const latest = await repository.loadCanvas({
              workspaceId: shellWorkspaceId,
              canvasId: cachedSummary.id,
            });
            if (
              serverCanvasMatchesCachedRuntime(
                latest,
                initialRuntime.shellState,
              )
            ) {
              const reconciled = controller.restoreRuntimeState(
                reconcileCachedRuntimeWithServer(
                  latest,
                  initialRuntime.shellState,
                ),
              );
              setShellState(reconciled);
              setRenameTitle(reconciled.title);
              await restoreForCanvasRef.current(reconciled);
              return;
            }
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

          if (unchanged) {
            await restoreForCanvasRef.current(controller.state);
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
      variantRefreshControllerRef.current?.abort();
      if (variantRefreshFrameRef.current !== null) {
        window.cancelAnimationFrame(variantRefreshFrameRef.current);
        variantRefreshFrameRef.current = null;
      }
      if (variantDowngradeTimerRef.current !== null) {
        clearTimeout(variantDowngradeTimerRef.current);
        variantDowngradeTimerRef.current = null;
      }
      let latestState = controller.state;
      if (saveTimerRef.current) {
        controller.setRuntimeNodes(nodesRef.current);
        latestState = controller.setRuntimeEdges(edgesRef.current);
      }
      if (latestState.canvasId) {
        pyramidScheduler.cancelScope(
          {
            userId: shellUserId,
            workspaceId: shellWorkspaceId,
            canvasId: latestState.canvasId,
          },
          true,
        );
      }
      // Keep in-flight work alive across a StrictMode-style cleanup/setup pair.
      // The cache is component-owned and becomes unreachable on a real unmount;
      // clearing it here would allow an aborted original request to be started
      // again while the first browser request is still downloading.
      if (runtimeCache && latestState.canvasId) {
        runtimeCache.set({
          workspaceId: shellWorkspaceId,
          userId: shellUserId,
          canvasId: latestState.canvasId,
          summaries: summariesRef.current,
          shellState: latestState,
          assetPayloads: new Map(variantPayloadsRef.current),
          objectUrls,
        });
      } else {
        objectUrls.revokeAll();
      }
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
      repository.close?.();
    };
  }, [
    controller,
    groupsRepository,
    shellWorkspaceId,
    initialRuntime,
    objectUrls,
    repository,
    restoreCachedScene,
    runtimeCache,
    shellUserId,
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

  useEffect(() => {
    const root = wrapperRef.current;
    const viewport = root?.querySelector<HTMLElement>(".react-flow__viewport");
    if (!root || !viewport) return;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let previousTransition = viewport.style.transition;
    const clearSmoothing = (): void => {
      if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
      viewport.style.transition = previousTransition;
    };
    const onWheel = (): void => {
      if (settleTimer === null) previousTransition = viewport.style.transition;
      viewport.style.transition = "transform 55ms linear";
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(clearSmoothing, 75);
    };
    const onPointerDown = (): void => clearSmoothing();
    root.addEventListener("wheel", onWheel, { capture: true, passive: true });
    root.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      clearSmoothing();
      root.removeEventListener("wheel", onWheel, true);
      root.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [flowInstanceEpoch]);

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
            ? {
                ...node,
                data: {
                  ...node.data,
                  markdown: commitTextMarkdown(markdown),
                  isEditing: false,
                },
              }
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
                  data: {
                    ...candidate.data,
                    markdown: commitTextMarkdown(markdown),
                    isEditing: false,
                  },
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

  const updateTextStyle = useCallback(
    (id: string, patch: Partial<CanvasTextStyle>) => {
      let found = false;
      const nextNodes = nodesRef.current.map((node) => {
        if (node.id !== id || node.type !== CANVAS_TEXT_NODE_TYPE) return node;
        found = true;
        return {
          ...node,
          data: {
            ...node.data,
            style: { ...node.data.style, ...patch },
          },
        };
      });
      if (!found) return;
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
      controller.setRuntimeNodes(nextNodes);
      syncState();
      scheduleSave();
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
      setNodes((current) => [
        ...current.map((item) =>
          item.selected ? { ...item, selected: false } : item,
        ),
        { ...node, selected: true },
      ]);
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

  const setShapeEditing = useCallback(
    (id: string, isEditing: boolean) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === id && node.type === CANVAS_SHAPE_NODE_TYPE
            ? { ...node, data: { ...node.data, isEditing } }
            : node,
        ),
      );
    },
    [setNodes],
  );

  const commitShapeNode = useCallback(
    (id: string, markdown: string) => {
      const committedMarkdown = commitTextMarkdown(markdown);
      const nextNodes = nodesRef.current.map((node) =>
        node.id === id && node.type === CANVAS_SHAPE_NODE_TYPE
          ? {
              ...node,
              data: {
                ...node.data,
                markdown: committedMarkdown,
                isEditing: false,
              },
            }
          : node,
      );
      if (
        !nextNodes.some(
          (node) => node.id === id && node.type === CANVAS_SHAPE_NODE_TYPE,
        )
      )
        return;
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
      controller.setRuntimeNodes(nextNodes);
      syncState();
      scheduleSave();
    },
    [controller, scheduleSave, setNodes, syncState],
  );

  const updateShapeStyle = useCallback(
    (id: string, patch: Partial<CanvasShapeStyle>) => {
      let found = false;
      const nextNodes = nodesRef.current.map((node) => {
        if (node.id !== id || node.type !== CANVAS_SHAPE_NODE_TYPE) return node;
        found = true;
        return {
          ...node,
          data: {
            ...node.data,
            style: { ...node.data.style, ...patch },
          },
        };
      });
      if (!found) return;
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
      controller.setRuntimeNodes(nextNodes);
      syncState();
      scheduleSave();
    },
    [controller, scheduleSave, setNodes, syncState],
  );

  const createShapeNode = useCallback(
    (shape: CanvasShapeVariant) => {
      if (!shellState.canvasId) return;
      const size =
        shape === "circle"
          ? { width: 160, height: 160 }
          : { width: 220, height: 120 };
      const center = centerPosition();
      const position = {
        x: center.x - size.width / 2,
        y: center.y - size.height / 2,
      };
      const zIndex =
        shellState.document.nodes.reduce(
          (maximum, current) => Math.max(maximum, current.zIndex),
          0,
        ) + 1;
      const canonical: CanvasShapeNode = {
        id: createCanvasShapeId(),
        kind: "shape",
        shape,
        markdown: "",
        position,
        size,
        zIndex,
        style: { ...DEFAULT_CANVAS_SHAPE_STYLE },
      };
      const runtime = createCanvasShapeFlowNode({
        id: canonical.id,
        shape: canonical.shape,
        markdown: canonical.markdown,
        position: canonical.position,
        size: canonical.size,
        zIndex: canonical.zIndex,
        style: canonical.style,
        isEditing: true,
      });
      setNodes((current) => [
        ...current.map((item) =>
          item.selected ? { ...item, selected: false } : item,
        ),
        { ...runtime, selected: true },
      ]);
      controller.insertCanvasNodes([canonical]);
      syncState();
    },
    [
      centerPosition,
      controller,
      setNodes,
      shellState.canvasId,
      shellState.document.nodes,
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
    const onStyle = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          id?: string;
          patch?: Partial<CanvasTextStyle>;
        }>
      ).detail;
      if (detail.id && detail.patch) updateTextStyle(detail.id, detail.patch);
    };
    const onShapeEdit = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) setShapeEditing(id, true);
    };
    const onShapeCommit = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; markdown?: string }>)
        .detail;
      if (detail.id && typeof detail.markdown === "string")
        commitShapeNode(detail.id, detail.markdown);
    };
    const onShapeCancel = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) setShapeEditing(id, false);
    };
    const onShapeStyle = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          id?: string;
          patch?: Partial<CanvasShapeStyle>;
        }>
      ).detail;
      if (detail.id && detail.patch) updateShapeStyle(detail.id, detail.patch);
    };
    const onEyedropperStart = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) setStyleEyedropperSourceId(id);
    };
    window.addEventListener("mozg:canvas-text-edit", onEdit);
    window.addEventListener("mozg:canvas-text-commit", onCommit);
    window.addEventListener("mozg:canvas-text-cancel", onCancel);
    window.addEventListener("mozg:canvas-text-style", onStyle);
    window.addEventListener("mozg:canvas-shape-edit", onShapeEdit);
    window.addEventListener("mozg:canvas-shape-commit", onShapeCommit);
    window.addEventListener("mozg:canvas-shape-cancel", onShapeCancel);
    window.addEventListener("mozg:canvas-shape-style", onShapeStyle);
    window.addEventListener(
      "mozg:canvas-style-eyedropper-start",
      onEyedropperStart,
    );
    return () => {
      window.removeEventListener("mozg:canvas-text-edit", onEdit);
      window.removeEventListener("mozg:canvas-text-commit", onCommit);
      window.removeEventListener("mozg:canvas-text-cancel", onCancel);
      window.removeEventListener("mozg:canvas-text-style", onStyle);
      window.removeEventListener("mozg:canvas-shape-edit", onShapeEdit);
      window.removeEventListener("mozg:canvas-shape-commit", onShapeCommit);
      window.removeEventListener("mozg:canvas-shape-cancel", onShapeCancel);
      window.removeEventListener("mozg:canvas-shape-style", onShapeStyle);
      window.removeEventListener(
        "mozg:canvas-style-eyedropper-start",
        onEyedropperStart,
      );
    };
  }, [
    commitShapeNode,
    commitTextNode,
    setShapeEditing,
    setTextEditing,
    updateShapeStyle,
    updateTextStyle,
  ]);

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

  const pasteCanvasNodes = useCallback(
    async (payload: CanvasNodeClipboardPayload) => {
      const canvasId = shellStateRef.current.canvasId;
      if (!canvasId) return;
      const highestZIndex = shellStateRef.current.document.nodes.reduce(
        (maximum, node) => Math.max(maximum, node.zIndex),
        0,
      );
      const target = pointerRef.current
        ? screenToFlowRef.current(pointerRef.current)
        : centerPosition();
      const canonicalNodes = materializeCanvasNodeClipboardPaste(payload, {
        target,
        zIndexStart: highestZIndex + 1,
      });

      try {
        const runtimeNodes: CanvasFlowNode[] = [];
        for (const node of canonicalNodes) {
          if (node.kind === "text") {
            runtimeNodes.push(
              createCanvasTextFlowNode({
                id: node.id,
                markdown: node.markdown,
                position: node.position,
                size: node.size,
                style: node.style,
                zIndex: node.zIndex,
              }),
            );
          } else if (node.kind === "pdf") {
            runtimeNodes.push(
              createCanvasPdfFlowNode({
                id: node.id,
                fileId: node.fileId,
                lastKnownName: node.lastKnownName,
                position: node.position,
                size: node.size,
                zIndex: node.zIndex,
              }),
            );
          } else if (node.kind === "shape") {
            runtimeNodes.push(
              createCanvasShapeFlowNode({
                id: node.id,
                shape: node.shape,
                markdown: node.markdown,
                position: node.position,
                size: node.size,
                style: node.style,
                zIndex: node.zIndex,
              }),
            );
          } else if (node.kind === "task") {
            runtimeNodes.push(
              createCanvasTaskFlowNode({
                id: node.id,
                taskId: node.taskId,
                lastKnownTitle: node.lastKnownTitle,
                position: node.position,
                size: node.size,
                zIndex: node.zIndex,
                taskBridge,
                taskWorkspaceId,
                onContentHeightChange: handleTaskNodeContentHeightChange,
              }),
            );
          }
        }

        const imageNodes = canonicalNodes.filter(
          (node) => node.kind === "image",
        );
        const restoredImages =
          imageNodes.length === 0
            ? { nodes: [] }
            : await restoreCanvasImageNodes(
                { schemaVersion: 2 as const, nodes: imageNodes, edges: [] },
                canvasImageAdapterDependenciesForCanvas(
                  adapterDependencies,
                  canvasId,
                ),
                {
                  cachedAssetPayloads: variantPayloadsRef.current,
                  viewportZoom: shellStateRef.current.viewport.zoom,
                  allowDowngrade: false,
                },
              );
        const projectFileDependencies =
          projectFileImageDependenciesForCanvas(canvasId);
        const restoredProjectFileImages = projectFileDependencies
          ? await restoreProjectFileCanvasImageNodes(
              { schemaVersion: 2 as const, nodes: imageNodes, edges: [] },
              projectFileDependencies,
              {
                cachedAssetPayloads: variantPayloadsRef.current,
                viewportZoom: shellStateRef.current.viewport.zoom,
                allowDowngrade: false,
              },
            )
          : { nodes: [] };
        const canonicalImagesById = new Map(
          imageNodes.map((node) => [node.id, node]),
        );
        for (const image of [
          ...restoredImages.nodes,
          ...restoredProjectFileImages.nodes,
        ]) {
          const canonical = canonicalImagesById.get(image.id);
          const runtimeImage = canonical
            ? { ...image, zIndex: canonical.zIndex }
            : image;
          runtimeNodes.push(runtimeImage);
          rememberImageRuntimePayload(
            variantPayloadsRef.current,
            runtimeImage,
            { workspaceId: shellWorkspaceId, canvasId },
          );
        }

        const runtimeIds = new Set(runtimeNodes.map((node) => node.id));
        const persistedNodes = canonicalNodes.filter((node) =>
          runtimeIds.has(node.id),
        );
        if (persistedNodes.length === 0) return;
        setNodes((current) => [
          ...current.map((node) =>
            node.selected ? { ...node, selected: false } : node,
          ),
          ...runtimeNodes.map((node) => ({ ...node, selected: true })),
        ]);
        controller.insertCanvasNodes(persistedNodes);
        syncState();
        scheduleSave();
      } catch (error: unknown) {
        setShellState((current) => ({
          ...current,
          status: "error",
          error:
            error instanceof Error ? error.message : "Canvas paste failed.",
        }));
      }
    },
    [
      adapterDependencies,
      centerPosition,
      controller,
      handleTaskNodeContentHeightChange,
      projectFileImageDependenciesForCanvas,
      scheduleSave,
      setNodes,
      shellWorkspaceId,
      syncState,
      taskBridge,
      taskWorkspaceId,
    ],
  );

  const createPdfNodeFromProjectFile = useCallback(
    async (file: ProjectFileRecord, position?: FlowPosition) => {
      if (
        file.mimeType !== "application/pdf" ||
        !shellStateRef.current.canvasId
      )
        return;
      const confirmAttachmentSaved = async (): Promise<void> => {
        if (!controller.hasPendingSave) return;
        try {
          const result = await controller.flushPendingSave();
          const saved = controller.state;
          syncState();
          if (result?.status !== "saved" || saved.status !== "saved") {
            throw new Error(
              saved.error ?? "Не удалось сохранить PDF-узел на холсте.",
            );
          }
        } catch (error) {
          // File upload and Canvas attachment are separate network operations.
          // Keep a recoverable canonical draft if the second one fails.
          saveConflictDraft(controller.state);
          syncState();
          throw error;
        }
      };
      // Retrying the direct "Add PDF" action should focus on the already
      // attached document, not make a second node for the same file. If its
      // first Canvas save failed, this also retries the pending attachment.
      if (
        controller.state.document.nodes.some(
          (node) => node.kind === "pdf" && node.fileId === file.id,
        )
      ) {
        setNodes((current) =>
          current.map((node) => ({
            ...node,
            selected:
              node.type === CANVAS_PDF_NODE_TYPE &&
              node.data.fileId === file.id,
          })),
        );
        await confirmAttachmentSaved();
        return;
      }
      const zIndex =
        Math.max(
          0,
          ...controller.state.document.nodes.map((node) => node.zIndex),
        ) + 1;
      const canonical = {
        id: createCanvasPdfId(),
        kind: "pdf" as const,
        fileId: file.id,
        lastKnownName: file.name,
        position: position ?? centerPosition(),
        size: { width: 300, height: 180 },
        zIndex,
      };
      const runtime = createCanvasPdfFlowNode(canonical);
      setNodes((current) => [
        ...current.map((node) =>
          node.selected ? { ...node, selected: false } : node,
        ),
        { ...runtime, selected: true },
      ]);
      controller.insertCanvasNodes([canonical]);
      syncState();
      await confirmAttachmentSaved();
      setFilePickerOpen(false);
    },
    [centerPosition, controller, saveConflictDraft, setNodes, syncState],
  );

  const createProjectFileNode = useCallback(
    async (file: ProjectFileRecord) => {
      if (file.mimeType === "application/pdf") {
        await createPdfNodeFromProjectFile(file);
        return;
      }
      const canvasId = shellStateRef.current.canvasId;
      if (!canvasId) return;
      const dependencies = projectFileImageDependenciesForCanvas(canvasId);
      if (!dependencies) return;
      try {
        const zIndex =
          Math.max(
            0,
            ...controller.state.document.nodes.map((node) => node.zIndex),
          ) + 1;
        const canonical = createCanvasProjectFileImageNode({
          file,
          position: centerPosition(),
          zIndex,
        });
        const restored = await restoreProjectFileCanvasImageNodes(
          { schemaVersion: 2, nodes: [canonical], edges: [] },
          dependencies,
          {
            cachedAssetPayloads: variantPayloadsRef.current,
            viewportZoom: shellStateRef.current.viewport.zoom,
            allowDowngrade: false,
          },
        );
        const runtime = restored.nodes[0];
        if (!runtime) throw new Error("Project File image is unavailable.");
        rememberImageRuntimePayload(variantPayloadsRef.current, runtime, {
          workspaceId: shellWorkspaceId,
          canvasId,
        });
        setNodes((current) => [
          ...current.map((node) =>
            node.selected ? { ...node, selected: false } : node,
          ),
          { ...runtime, selected: true },
        ]);
        controller.insertCanvasNodes([canonical]);
        syncState();
        scheduleSave();
        setFilePickerOpen(false);
      } catch (error: unknown) {
        setShellState((current) => ({
          ...current,
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Не удалось добавить файл на холст.",
        }));
      }
    },
    [
      centerPosition,
      controller,
      createPdfNodeFromProjectFile,
      projectFileImageDependenciesForCanvas,
      scheduleSave,
      setNodes,
      shellWorkspaceId,
      syncState,
    ],
  );

  useEffect(() => {
    const onCopy = (event: ClipboardEvent) => {
      if (eventTouchesEditingSurface(event) || !event.clipboardData) return;
      const selectedNodeIds = new Set(
        nodesRef.current.filter((node) => node.selected).map((node) => node.id),
      );
      const payload = createCanvasNodeClipboardPayload(
        controller.state.document,
        selectedNodeIds,
      );
      if (!payload) return;
      event.preventDefault();
      event.clipboardData.setData(
        CANVAS_NODE_CLIPBOARD_MIME,
        serializeCanvasNodeClipboardPayload(payload),
      );
    };
    window.addEventListener("copy", onCopy);
    return () => window.removeEventListener("copy", onCopy);
  }, [controller]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (eventTouchesEditingSurface(event)) return;
      const canvasPayload = parseCanvasNodeClipboardPayload(
        event.clipboardData?.getData(CANVAS_NODE_CLIPBOARD_MIME) ?? "",
      );
      if (canvasPayload) {
        event.preventDefault();
        void pasteCanvasNodes(canvasPayload);
        return;
      }
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
  }, [createTextNode, pasteCanvasNodes]);

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
      const touchGuardedChanges = touchViewportGestureActiveRef.current
        ? changes.filter(
            (change) =>
              change.type !== "position" && change.type !== "dimensions",
          )
        : changes;
      const guardedChanges = redirectCanvasAltDragNodeChanges(
        touchGuardedChanges,
        altDragDuplicateRef.current,
      );
      if (guardedChanges.length === 0) return;
      const requestedRemovals = guardedChanges.filter(
        (
          change,
        ): change is Extract<NodeChange<CanvasFlowNode>, { type: "remove" }> =>
          change.type === "remove",
      );
      // The open reader is a visual state, not a selection. This guard also
      // protects an already-open PDF from a stale React Flow selection when
      // deleting a group of other nodes.
      const safeChanges =
        openPdf?.nodeId &&
        requestedRemovals.length > 1 &&
        requestedRemovals.some((change) => change.id === openPdf.nodeId)
          ? guardedChanges.filter(
              (change) =>
                change.type !== "remove" || change.id !== openPdf.nodeId,
            )
          : guardedChanges;
      if (safeChanges.length === 0) return;
      if (
        safeChanges.some(
          (change) => change.type === "position" && change.dragging === true,
        )
      ) {
        nodeDragActiveRef.current = true;
        edgeRemovalSuppressionUntilRef.current = Date.now() + 5000;
      }
      if (
        safeChanges.some(
          (change) => change.type === "position" && change.dragging === false,
        )
      ) {
        nodeDragActiveRef.current = false;
        edgeRemovalSuppressionUntilRef.current = Date.now() + 5000;
      }
      const removed = safeChanges.filter(
        (
          change,
        ): change is Extract<NodeChange<CanvasFlowNode>, { type: "remove" }> =>
          change.type === "remove",
      );
      for (const change of removed) {
        const node = nodesRef.current.find((item) => item.id === change.id);
        if (node?.type !== CANVAS_IMAGE_NODE_TYPE) continue;
        const canvasId = shellStateRef.current.canvasId;
        const prefix = canvasId
          ? `${shellWorkspaceId}/${canvasId}/${node.data.assetId}/`
          : null;
        for (const [key, payload] of variantPayloadsRef.current) {
          if (!prefix || !key.startsWith(prefix)) continue;
          objectUrls.revoke(payload.objectUrl);
          variantPayloadsRef.current.delete(key);
        }
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
      const renderChanges = safeChanges.filter(
        (change) =>
          change.type !== "dimensions" || change.setAttributes === true,
      );
      if (safeChanges.some((change) => change.type === "position")) {
        const transientNodes = applyNodeChanges(
          renderChanges,
          nodesRef.current,
        );
        const transientBounds = canvasFlowNodeBoundsRecords(transientNodes);
        setEdges((current) => {
          const canonical = canvasDocumentToEdges(
            controller.state.document,
            handleEdgeUpdate,
          );
          const source = current.length > 0 ? current : canonical;
          const known = new Set(source.map((edge) => edge.id));
          return recomputeCanvasRuntimeEdgeHandles(
            [...source, ...canonical.filter((edge) => !known.has(edge.id))],
            transientBounds,
          );
        });
      }
      // React Flow must receive dimensions changes as well as positions. Filtering
      // them here leaves nodes uninitialized during a drag and causes connected
      // edges to be removed by the library's connection lifecycle.
      onNodesChange(safeChanges);
      const shouldPersist = safeChanges.some(
        (change) =>
          change.type === "remove" ||
          (change.type === "position" && change.dragging === false) ||
          isExplicitCanvasResize(change),
      );
      if (shouldPersist) {
        controller.setRuntimeNodes(
          projectExplicitCanvasResizes(
            applyNodeChanges(renderChanges, nodesRef.current),
            safeChanges,
          ),
        );
        if (
          safeChanges.some(
            (change) => change.type === "position" && change.dragging === false,
          )
        ) {
          controller.setRuntimeEdges(edgesRef.current);
        }
        syncState();
        scheduleSave();
      }
    },
    [
      controller,
      handleEdgeUpdate,
      objectUrls,
      openPdf?.nodeId,
      onNodesChange,
      scheduleSave,
      setEdges,
      shellWorkspaceId,
      syncState,
    ],
  );

  const openPdfNode = useCallback(
    async (node: CanvasFlowNode) => {
      if (
        node.type !== CANVAS_PDF_NODE_TYPE ||
        !projectFileRepository ||
        !projectId
      )
        return;
      try {
        const downloaded = await projectFileRepository.downloadFile({
          workspaceId: shellWorkspaceId,
          projectId,
          fileId: node.data.fileId,
        });
        setPdfFullscreen(false);
        setOpenPdf((current) => {
          if (current) URL.revokeObjectURL(current.objectUrl);
          return {
            fileId: node.data.fileId,
            name: downloaded.name || node.data.lastKnownName || "PDF",
            nodeId: node.id,
            objectUrl: URL.createObjectURL(downloaded.blob),
          };
        });
      } catch (error: unknown) {
        setShellState((current) => ({
          ...current,
          status: "error",
          error: error instanceof Error ? error.message : "PDF failed to open.",
        }));
      }
    },
    [projectFileRepository, projectId, shellWorkspaceId],
  );

  const closePdfReader = useCallback(() => {
    setPdfFullscreen(false);
    setOpenPdf((current) => {
      if (current) URL.revokeObjectURL(current.objectUrl);
      return null;
    });
  }, []);

  const uploadPdfFiles = useCallback(
    async (files: File[], position?: FlowPosition) => {
      if (!projectFileRepository || !projectId || files.length === 0) return;
      for (const file of files) {
        if (
          file.type !== "application/pdf" &&
          !file.name.toLowerCase().endsWith(".pdf")
        )
          continue;
        try {
          const prepared = await prepareProjectFileBrowserUpload(file);
          if (prepared.mimeType !== "application/pdf") continue;
          const canvasId = shellStateRef.current.canvasId;
          if (!canvasId) return;
          const key = `${canvasId}:${prepared.checksum}`;
          const existing = pdfUploadInFlightRef.current.get(key);
          if (existing) {
            await existing;
            continue;
          }
          const pending = (async () => {
            const uploaded = await projectFileRepository.uploadFile({
              workspaceId: shellWorkspaceId,
              projectId,
              ...prepared,
            });
            await createPdfNodeFromProjectFile(uploaded, position);
          })();
          pdfUploadInFlightRef.current.set(key, pending);
          try {
            await pending;
          } finally {
            if (pdfUploadInFlightRef.current.get(key) === pending) {
              pdfUploadInFlightRef.current.delete(key);
            }
          }
        } catch (error: unknown) {
          setShellState((current) => ({
            ...current,
            status: "error",
            error:
              error instanceof Error ? error.message : "PDF upload failed.",
          }));
        }
      }
    },
    [
      createPdfNodeFromProjectFile,
      projectFileRepository,
      projectId,
      shellWorkspaceId,
    ],
  );

  const onDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDropActive(false);
      const payload = transferPayload(event.nativeEvent);
      if (!shouldPreventFileNavigation(payload)) return;
      const client = { x: event.clientX, y: event.clientY };
      const { imageFiles, pdfFiles } = partitionCanvasDropFiles(payload.files);
      if (pdfFiles.length === 0) {
        void ingest(payload, "drop", client);
        return;
      }
      const pdfPosition = resolveCanvasDropFlowPosition(
        client,
        screenToFlowRef.current,
      );
      void runCanvasMixedDrop(
        { imageFiles, pdfFiles },
        {
          ingestImages: async (files) => {
            await ingest(
              {
                files: Array.from(files),
                items: [],
                types: files.map((file) => file.type),
              },
              "drop",
              client,
            );
          },
          uploadPdfs: async (files) => {
            await uploadPdfFiles(Array.from(files), pdfPosition);
          },
        },
      );
    },
    [ingest, uploadPdfFiles],
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

  const createCanvas = useCallback(
    async (requestedTitle?: string, groupId: string | null = null) => {
      const title = (requestedTitle ?? newTitle).trim();
      if (!title) return;
      const generation = ++canvasGenerationRef.current;
      const created = await controller.createCanvas(title, groupId);
      if (!created.canvasId) return;
      restoreControllerRef.current?.abort();
      variantRefreshControllerRef.current?.abort();
      if (variantRefreshFrameRef.current !== null) {
        window.cancelAnimationFrame(variantRefreshFrameRef.current);
        variantRefreshFrameRef.current = null;
      }
      if (variantDowngradeTimerRef.current !== null) {
        clearTimeout(variantDowngradeTimerRef.current);
        variantDowngradeTimerRef.current = null;
      }
      repository.setActiveCanvas?.(created.canvasId);
      programmaticViewportRef.current = null;
      setViewportVisible(false);
      await refreshCatalog();
      setShellState(created);
      setRenameTitle(created.title);
      setNodes([]);
      setEdges([]);
      hydratingRef.current = false;
      setLoadingLifecycle("ready");
      setViewportInitialization({
        canvasId: created.canvasId,
        generation,
        viewport: { ...created.viewport },
      });
    },
    [controller, newTitle, refreshCatalog, repository, setEdges, setNodes],
  );

  const renameCanvas = useCallback(() => {
    if (!renameTitle.trim() || !shellState.canvasId) return;
    controller.setTitle(renameTitle.trim());
    syncState();
    scheduleSave();
  }, [controller, renameTitle, scheduleSave, shellState.canvasId, syncState]);

  const createCanvasGroup = useCallback(
    async (title: string, parentGroupId: string | null = null) => {
      if (!groupsRepository) return;
      await groupsRepository.createCanvasGroup({
        workspaceId: shellWorkspaceId,
        title,
        parentGroupId,
      });
      await refreshCatalog();
    },
    [groupsRepository, refreshCatalog, shellWorkspaceId],
  );

  const renameCanvasGroup = useCallback(
    async (groupId: string, title: string) => {
      if (!groupsRepository) return;
      const previousTitle = groups.find((group) => group.id === groupId)?.title;
      setGroups((current) =>
        current.map((group) =>
          group.id === groupId ? { ...group, title } : group,
        ),
      );
      try {
        await groupsRepository.renameCanvasGroup({
          workspaceId: shellWorkspaceId,
          groupId,
          title,
        });
        await refreshCatalog();
      } catch (error: unknown) {
        if (previousTitle !== undefined) {
          setGroups((current) =>
            current.map((group) =>
              group.id === groupId ? { ...group, title: previousTitle } : group,
            ),
          );
        }
        setGroupsError(
          error instanceof Error
            ? error.message
            : "Не удалось переименовать группу.",
        );
      }
    },
    [groups, groupsRepository, refreshCatalog, shellWorkspaceId],
  );

  const deleteCanvasGroup = useCallback(
    async (groupId: string) => {
      if (!groupsRepository) return;
      await groupsRepository.softDeleteCanvasGroup({
        workspaceId: shellWorkspaceId,
        groupId,
      });
      await refreshCatalog();
    },
    [groupsRepository, refreshCatalog, shellWorkspaceId],
  );

  const moveCanvasGroup = useCallback(
    async (groupId: string, parentGroupId: string | null) => {
      if (!groupsRepository) return;
      await groupsRepository.moveCanvasGroup({
        workspaceId: shellWorkspaceId,
        groupId,
        parentGroupId,
      });
      await refreshCatalog();
    },
    [groupsRepository, refreshCatalog, shellWorkspaceId],
  );

  const moveCanvasToGroup = useCallback(
    async (canvasId: string, groupId: string | null) => {
      if (!groupsRepository) return;
      await groupsRepository.moveCanvasToGroup({
        workspaceId: shellWorkspaceId,
        canvasId,
        groupId,
      });
      await refreshCatalog();
    },
    [groupsRepository, refreshCatalog, shellWorkspaceId],
  );

  const deleteCanvasById = useCallback(
    async (canvasId: string) => {
      const summary = summariesRef.current.find((item) => item.id === canvasId);
      if (!summary || !window.confirm(`Удалить «${summary.title}»?`)) return;
      const wasActive = shellStateRef.current.canvasId === canvasId;
      if (wasActive) {
        restoreControllerRef.current?.abort();
        variantRefreshControllerRef.current?.abort();
        objectUrls.revokeAll();
      }
      await repository.softDeleteCanvas({
        workspaceId: shellWorkspaceId,
        canvasId,
      });
      const next = await refreshCatalog();
      if (!wasActive) return;
      repository.setActiveCanvas?.(null);
      setNodes([]);
      setEdges([]);
      if (next.summaries[0]) await openCanvas(next.summaries[0].id);
      else {
        hydratingRef.current = false;
        setShellState(emptyShellState());
      }
    },
    [
      objectUrls,
      openCanvas,
      refreshCatalog,
      repository,
      setEdges,
      setNodes,
      shellWorkspaceId,
      variantRefreshControllerRef,
    ],
  );

  const deleteCanvas = useCallback(async () => {
    if (!shellState.canvasId) return;
    await deleteCanvasById(shellState.canvasId);
  }, [deleteCanvasById, shellState.canvasId]);

  const renameCanvasById = useCallback(
    (canvasId: string, title: string): void => {
      const nextTitle = title.trim();
      if (!nextTitle || renameInFlightRef.current.has(canvasId)) return;
      const previousTitle =
        summariesRef.current.find((item) => item.id === canvasId)?.title ??
        shellStateRef.current.title;
      renameInFlightRef.current.add(canvasId);
      setSummaries((current) =>
        current.map((summary) =>
          summary.id === canvasId ? { ...summary, title: nextTitle } : summary,
        ),
      );
      void (async () => {
        try {
          if (canvasId !== shellStateRef.current.canvasId)
            await openCanvas(canvasId);
          controller.setTitle(nextTitle);
          if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
          }
          const result = await controller.save();
          if (result?.status === "conflict")
            throw new Error("Canvas changed elsewhere. Reload to continue.");
          const saved = controller.state;
          setSummaries((current) =>
            current.map((summary) =>
              summary.id === canvasId
                ? { ...summary, title: nextTitle, revision: saved.revision }
                : summary,
            ),
          );
          syncState();
        } catch (error: unknown) {
          controller.setTitle(previousTitle);
          setSummaries((current) =>
            current.map((summary) =>
              summary.id === canvasId
                ? { ...summary, title: previousTitle }
                : summary,
            ),
          );
          setShellState({
            ...controller.state,
            status: "error",
            error:
              error instanceof Error
                ? error.message
                : "Failed to rename Canvas.",
          });
        } finally {
          renameInFlightRef.current.delete(canvasId);
        }
      })().catch(syncState);
    },
    [controller, openCanvas, syncState],
  );

  const commitViewportMove = useCallback(
    (viewport: CanvasPanViewport) => {
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
      // Upgrades must begin immediately. A lower-resolution source is only
      // considered after the zoom has remained still for one debounce window.
      scheduleImageVariantRefresh(viewport.zoom, false);
      if (variantDowngradeTimerRef.current !== null)
        clearTimeout(variantDowngradeTimerRef.current);
      variantDowngradeTimerRef.current = window.setTimeout(() => {
        variantDowngradeTimerRef.current = null;
        scheduleImageVariantRefresh(viewport.zoom, true);
      }, 900);
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
    [
      controller,
      scheduleImageVariantRefresh,
      shellState.canvasId,
      viewportVisible,
    ],
  );

  const cancelPanInertia = useCallback(
    (commitCurrentViewport: boolean) => {
      const wasActive = panInertiaActiveRef.current;
      if (panInertiaFrameRef.current !== null) {
        cancelAnimationFrame(panInertiaFrameRef.current);
        panInertiaFrameRef.current = null;
      }
      panInertiaActiveRef.current = false;
      panInertiaVelocityRef.current = null;
      panInertiaViewportRef.current = null;
      panInertiaLastFrameRef.current = null;
      if (wasActive && commitCurrentViewport)
        commitViewportMove(reactFlow.getViewport());
    },
    [commitViewportMove, reactFlow],
  );

  const startPanInertia = useCallback(
    (initialVelocity: CanvasPanVelocity) => {
      cancelPanInertia(false);
      panInertiaActiveRef.current = true;
      panInertiaVelocityRef.current = initialVelocity;
      panInertiaViewportRef.current = reactFlow.getViewport();
      panInertiaLastFrameRef.current = performance.now();

      const tick = (now: number): void => {
        const velocity = panInertiaVelocityRef.current;
        const viewport = panInertiaViewportRef.current;
        const lastFrameAt = panInertiaLastFrameRef.current;
        if (
          !panInertiaActiveRef.current ||
          !velocity ||
          !viewport ||
          lastFrameAt === null
        )
          return;
        const step = advanceCanvasPanInertia({
          viewport,
          velocity,
          elapsedMs: now - lastFrameAt,
        });
        panInertiaVelocityRef.current = step.velocity;
        panInertiaViewportRef.current = step.viewport;
        panInertiaLastFrameRef.current = now;
        void reactFlow.setViewport(step.viewport, { duration: 0 });

        if (step.done) {
          panInertiaFrameRef.current = requestAnimationFrame(() => {
            panInertiaFrameRef.current = null;
            panInertiaActiveRef.current = false;
            panInertiaVelocityRef.current = null;
            panInertiaViewportRef.current = null;
            panInertiaLastFrameRef.current = null;
            commitViewportMove(reactFlow.getViewport());
          });
          return;
        }
        panInertiaFrameRef.current = requestAnimationFrame(tick);
      };

      panInertiaFrameRef.current = requestAnimationFrame(tick);
    },
    [cancelPanInertia, commitViewportMove, reactFlow],
  );

  const handleViewportMove = useCallback(
    (_: unknown, viewport: CanvasPanViewport) => {
      if (!middlePanActiveRef.current || panInertiaActiveRef.current) return;
      const now = performance.now();
      panSamplesRef.current = [
        ...panSamplesRef.current.filter((sample) => now - sample.at <= 120),
        { x: viewport.x, y: viewport.y, at: now },
      ].slice(-8);
    },
    [],
  );

  const beginTouchViewportGesture = useCallback((): void => {
    if (touchViewportGestureActiveRef.current) return;
    touchViewportGestureActiveRef.current = true;
    nodeDragActiveRef.current = false;
    edgeRemovalSuppressionUntilRef.current = Date.now() + 5000;
    setTouchViewportGestureActive(true);

    const snapshot = touchGestureNodesRef.current;
    if (snapshot) {
      nodesRef.current = snapshot;
      setNodes(snapshot);
    }
    const canonicalEdges = canvasDocumentToEdges(
      controller.state.document,
      handleEdgeUpdate,
    );
    edgesRef.current = canonicalEdges;
    setEdges(canonicalEdges);
  }, [controller, handleEdgeUpdate, setEdges, setNodes]);

  const handleCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (styleEyedropperSourceId && event.button === 0) {
        const targetElement =
          event.target instanceof Element
            ? event.target.closest<HTMLElement>(".react-flow__node")
            : null;
        if (!targetElement) {
          setStyleEyedropperSourceId(null);
        } else {
          event.preventDefault();
          event.stopPropagation();
          const sourceId = styleEyedropperSourceId;
          const targetId = targetElement.dataset.id;
          if (!targetId || targetId === sourceId) return;
          const runtimeNodes = reactFlow.getNodes();
          const sourceNode = runtimeNodes.find((node) => node.id === sourceId);
          const targetNode = runtimeNodes.find((node) => node.id === targetId);
          if (
            sourceNode?.type === CANVAS_TEXT_NODE_TYPE &&
            targetNode?.type === CANVAS_TEXT_NODE_TYPE
          ) {
            updateTextStyle(sourceId, {
              color: targetNode.data.style.color,
              backgroundColor: targetNode.data.style.backgroundColor,
            });
            setStyleEyedropperSourceId(null);
            return;
          }
          if (
            sourceNode?.type === CANVAS_SHAPE_NODE_TYPE &&
            targetNode?.type === CANVAS_SHAPE_NODE_TYPE
          ) {
            updateShapeStyle(sourceId, {
              color: targetNode.data.style.color,
              fillColor: targetNode.data.style.fillColor,
            });
            setStyleEyedropperSourceId(null);
            return;
          }
          return;
        }
      }
      if (event.pointerType === "touch") {
        const activeTouchPointers = activeTouchPointersRef.current;
        if (activeTouchPointers.size === 0) {
          touchGestureNodesRef.current = snapshotCanvasTouchGestureNodes(
            nodesRef.current,
          );
        }
        activeTouchPointers.add(event.pointerId);
        if (activeTouchPointers.size >= 2) beginTouchViewportGesture();
      }
      cancelPanInertia(true);
      if (event.button !== 1) return;
      middlePanActiveRef.current = true;
      const viewport = reactFlow.getViewport();
      panSamplesRef.current = [
        { x: viewport.x, y: viewport.y, at: performance.now() },
      ];
    },
    [
      beginTouchViewportGesture,
      cancelPanInertia,
      reactFlow,
      styleEyedropperSourceId,
      updateShapeStyle,
      updateTextStyle,
    ],
  );

  const handleCanvasPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
    },
    [],
  );

  const handleCanvasWheel = useCallback(() => {
    cancelPanInertia(true);
  }, [cancelPanInertia]);

  useEffect(() => {
    const releaseTouchPointer = (event: PointerEvent): void => {
      if (event.pointerType !== "touch") return;
      activeTouchPointersRef.current.delete(event.pointerId);
      if (activeTouchPointersRef.current.size > 0) return;
      window.requestAnimationFrame(() => {
        if (activeTouchPointersRef.current.size > 0) return;
        touchGestureNodesRef.current = null;
        if (!touchViewportGestureActiveRef.current) return;
        touchViewportGestureActiveRef.current = false;
        setTouchViewportGestureActive(false);
      });
    };
    const onPointerUp = (event: PointerEvent): void => {
      releaseTouchPointer(event);
      if (event.button !== 1 || !middlePanActiveRef.current) return;
      middlePanActiveRef.current = false;
      const velocity = canvasPanReleaseVelocity(panSamplesRef.current);
      panSamplesRef.current = [];
      if (velocity) startPanInertia(velocity);
      else commitViewportMove(reactFlow.getViewport());
    };
    const onPointerCancel = (event: PointerEvent): void => {
      releaseTouchPointer(event);
      if (!middlePanActiveRef.current) return;
      middlePanActiveRef.current = false;
      panSamplesRef.current = [];
      commitViewportMove(reactFlow.getViewport());
    };
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerCancel, true);
    return () => {
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerCancel, true);
    };
  }, [commitViewportMove, reactFlow, startPanInertia]);

  useEffect(
    () => () => {
      if (panInertiaFrameRef.current !== null)
        cancelAnimationFrame(panInertiaFrameRef.current);
    },
    [],
  );

  const onMoveEnd = useCallback(
    (_: unknown, viewport: CanvasPanViewport) => {
      if (middlePanActiveRef.current || panInertiaActiveRef.current) return;
      commitViewportMove(viewport);
    },
    [commitViewportMove],
  );

  const keepLocalChanges = useCallback(() => {
    void controller
      .keepLocalChanges()
      .then(async (result) => {
        syncState();
        if (result?.status !== "saved") return;
        clearConflictDraft();
        await refreshCatalog();
      })
      .catch(syncState);
  }, [clearConflictDraft, controller, refreshCatalog, syncState]);

  const reloadLatestVersion = useCallback(() => {
    const current = controller.state;
    saveConflictDraft(current);
    if (current.canvasId) void openCanvas(current.canvasId);
  }, [controller, openCanvas, saveConflictDraft]);

  const restoreLocalConflictDraft = useCallback(() => {
    const draft = readConflictDraft();
    if (!draft) return;
    const restored = controller.restoreConflictDraft(draft);
    if (!restored) return;
    setShellState(restored);
    setRenameTitle(restored.title);
    void restoreForCanvas(restored).catch(syncState);
  }, [controller, readConflictDraft, restoreForCanvas, syncState]);

  const desktopListState =
    loadingLifecycle === "list-loading"
      ? "loading"
      : loadingLifecycle === "empty-confirmed"
        ? "empty"
        : loadingLifecycle === "error" && summaries.length === 0
          ? "error"
          : "ready";
  const desktopSidebar = embedded ? (
    <CanvasDesktopSidebar
      activeCanvasId={shellState.canvasId}
      copy={copy}
      error={shellState.error}
      groups={groups}
      groupsError={groupsError}
      listState={desktopListState}
      onCreateCanvas={(title, groupId) => void createCanvas(title, groupId)}
      onCreateGroup={(title, parentGroupId) =>
        void createCanvasGroup(title, parentGroupId)
      }
      onDeleteCanvas={(canvasId) => void deleteCanvasById(canvasId)}
      onDeleteGroup={(groupId) => void deleteCanvasGroup(groupId)}
      onMoveCanvas={(canvasId, groupId) =>
        void moveCanvasToGroup(canvasId, groupId)
      }
      onMoveGroup={(groupId, parentGroupId) =>
        void moveCanvasGroup(groupId, parentGroupId)
      }
      onRenameCanvas={renameCanvasById}
      onRenameGroup={(groupId, title) => void renameCanvasGroup(groupId, title)}
      onRetry={() => window.location.reload()}
      onSelectCanvas={(canvasId) => void openCanvas(canvasId)}
      summaries={summaries}
    />
  ) : null;

  const desktopToolbar = embedded ? (
    <CanvasDesktopToolbar
      canRedo={controller.canRedo}
      canUndo={controller.canUndo}
      interactive={Boolean(shellState.canvasId) && loadingLifecycle === "ready"}
      copy={copy}
      error={shellState.error}
      conflictDraftAvailable={conflictDraftAvailable}
      onAddPdf={(files) => void uploadPdfFiles(files)}
      onAddImage={(files) =>
        void ingest(
          { files, items: [], types: files.map((file) => file.type) },
          "file-picker",
          null,
        )
      }
      onAddText={() => createTextNode(null, "", true)}
      onAddRectangle={() => createShapeNode("rectangle")}
      onAddCircle={() => createShapeNode("circle")}
      onCloseFilePicker={() => setFilePickerOpen(false)}
      onCloseTaskPicker={() => setTaskPickerOpen(false)}
      onFileQueryChange={setFileQuery}
      onKeepLocalChanges={keepLocalChanges}
      onRedo={() => applyCanvasHistory("redo")}
      onReloadWinner={reloadLatestVersion}
      onRestoreLocalDraft={restoreLocalConflictDraft}
      onRetry={() => {
        if (shellState.canvasId) void openCanvas(shellState.canvasId);
        else window.location.reload();
      }}
      onSelectFile={(file) => void createProjectFileNode(file)}
      onSelectTask={createTaskNode}
      onTaskQueryChange={setTaskQuery}
      onToggleFilePicker={() => {
        setTaskPickerOpen(false);
        setFilePickerOpen((current) => !current);
      }}
      onToggleSidebar={() => setDesktopSidebarOpen((current) => !current)}
      onToggleTaskPicker={() => {
        setFilePickerOpen(false);
        setTaskPickerOpen((current) => !current);
      }}
      onUndo={() => applyCanvasHistory("undo")}
      filePickerOpen={filePickerOpen}
      fileQuery={fileQuery}
      fileResults={fileResults}
      fileSearchStatus={fileSearchStatus}
      fileToolsReady={Boolean(
        projectFileRepository && projectFileVariantRepository && projectId,
      )}
      sidebarOpen={desktopSidebarOpen}
      status={shellState.status}
      taskPickerOpen={taskPickerOpen}
      taskQuery={taskQuery}
      taskResults={taskResults}
      taskSearchStatus={taskSearchStatus}
      taskToolsReady={Boolean(taskBridge && taskWorkspaceId)}
    />
  ) : null;

  const desktopLayout = (content: React.ReactNode): React.JSX.Element => (
    <main
      className={`${styles.page} ${styles.pageEmbedded} ${styles.desktopCanvasPage} ${desktopSidebarOpen ? "" : styles.desktopCanvasPageSidebarCollapsed}`}
    >
      {desktopSidebar}
      <section className={styles.desktopCanvasMain} aria-label="Холст">
        {desktopToolbar}
        {content}
      </section>
    </main>
  );

  if (!shellState.canvasId && loadingLifecycle !== "empty-confirmed") {
    const isError = loadingLifecycle === "error";
    if (embedded) {
      return desktopLayout(
        <div className={styles.canvasWrap}>
          <div className={styles.canvas}>
            <section className={styles.canvasLoading} aria-busy={!isError}>
              {isError ? (
                <button
                  className={styles.button}
                  onClick={() => window.location.reload()}
                  type="button"
                >
                  Повторить
                </button>
              ) : (
                <div aria-label="Loading Canvas" role="status" />
              )}
            </section>
          </div>
        </div>,
      );
    }
    return (
      <main className={styles.page}>
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
    if (embedded) {
      return desktopLayout(
        <section className={styles.empty}>
          <div className={styles.emptyCard}>
            <h2>{copy.emptyTitle}</h2>
            <p>{copy.emptyDescription}</p>
            {shellState.error ? (
              <p className={styles.statusError}>{shellState.error}</p>
            ) : null}
          </div>
        </section>,
      );
    }
    return (
      <main className={styles.page}>
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
  if (embedded) {
    return desktopLayout(
      <div className={styles.canvasWorkspace}>
        <div className={styles.canvasWrap}>
          <div
            ref={wrapperRef}
            className={`${styles.canvas} ${dropActive ? styles.dropActive : ""} ${styleEyedropperSourceId ? styles.canvasStyleEyedropperActive : ""}`}
            onDragEnter={() => setDropActive(true)}
            onDragLeave={() => setDropActive(false)}
            onDragOver={(event) => {
              if (transferHasFiles(transferPayload(event.nativeEvent)))
                event.preventDefault();
            }}
            onDrop={onDrop}
            onPointerDownCapture={handleCanvasPointerDown}
            onPointerMoveCapture={handleCanvasPointerMove}
            onWheelCapture={handleCanvasWheel}
          >
            <ReactFlow
              className={`${styles.canvasViewport} ${viewportVisible ? "" : styles.canvasViewportHidden}`}
              nodes={renderedNodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onNodeDragStart={handleNodeDragStart}
              onNodeDragStop={handleNodeDragStop}
              onNodeDoubleClick={(event, node) => {
                if (node.type !== CANVAS_PDF_NODE_TYPE) return;
                event.preventDefault();
                void openPdfNode(node);
              }}
              onConnect={handleConnect}
              connectionMode={ConnectionMode.Loose}
              connectionLineComponent={CanvasConnectionLine}
              minZoom={CANVAS_VIEWPORT_LIMITS.minZoom}
              maxZoom={CANVAS_VIEWPORT_LIMITS.maxZoom}
              panOnDrag={touchPrimaryInput ? [0, 1] : [1]}
              selectionOnDrag={!touchPrimaryInput}
              selectionMode={SelectionMode.Partial}
              nodesDraggable={!touchViewportGestureActive}
              nodesConnectable={!touchViewportGestureActive}
              elementsSelectable={!touchViewportGestureActive}
              nodeDragThreshold={touchPrimaryInput ? 8 : 1}
              zoomOnPinch
              onMove={handleViewportMove}
              onMoveEnd={onMoveEnd}
              onInit={() => setFlowInstanceEpoch((current) => current + 1)}
              onPaneClick={(event) => {
                if (touchViewportGestureActiveRef.current || event.detail !== 2)
                  return;
                createTextNode(
                  { x: event.clientX, y: event.clientY },
                  "",
                  true,
                );
              }}
              deleteKeyCode={["Backspace", "Delete"]}
            >
              <Background gap={24} color="#d6d3d1" />
              <Controls showInteractive={false} />
              <MiniMap
                className={styles.minimap}
                position="bottom-right"
                maskColor="rgba(28, 25, 23, 0.08)"
                nodeColor={canvasMiniMapNodeColor}
                nodeStrokeColor="#78716c"
                nodeStrokeWidth={1}
                pannable
                zoomable
              />
              <CanvasEdgeMarkerDefinitions />
            </ReactFlow>
            {!viewportVisible ? (
              <div className={styles.canvasLoading} role="status">
                Preparing canvas…
              </div>
            ) : null}
            <div className={styles.canvasHint}>
              {dropActive
                ? "Drop PNG, JPEG, WebP or PDF here"
                : "Paste, drop or choose a file · drag and resize are saved"}
            </div>
          </div>
        </div>
        {openPdf ? (
          <aside
            className={`${styles.pdfReader} canvas-pdf-reader ${pdfFullscreen ? `${styles.pdfReaderFullscreen} canvas-pdf-reader-fullscreen` : ""}`}
            aria-label="Просмотр PDF"
          >
            <header className={styles.pdfReaderHeader}>
              <strong title={openPdf.name}>{openPdf.name}</strong>
              <div className={styles.pdfReaderHeaderActions}>
                <button
                  type="button"
                  onClick={() => setPdfFullscreen((current) => !current)}
                  aria-label={
                    pdfFullscreen
                      ? "Вернуть PDF в боковую панель"
                      : "Развернуть PDF на весь экран"
                  }
                  aria-pressed={pdfFullscreen}
                  title={pdfFullscreen ? "Вернуть в панель" : "На весь экран"}
                >
                  <UiIcon
                    name={pdfFullscreen ? "fullscreen-exit" : "fullscreen"}
                  />
                </button>
                <button
                  type="button"
                  onClick={closePdfReader}
                  aria-label="Закрыть PDF"
                  title="Закрыть PDF"
                >
                  <UiIcon name="close" />
                </button>
              </div>
            </header>
            <iframe
              src={openPdf.objectUrl}
              title={openPdf.name}
              className={styles.pdfReaderFrame}
            />
          </aside>
        ) : null}
      </div>,
    );
  }
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
            <>
              <button
                className={`${styles.button} ${styles.primary}`}
                type="button"
                onClick={keepLocalChanges}
              >
                {copy.keepLocalChanges}
              </button>
              <button
                className={styles.button}
                type="button"
                onClick={reloadLatestVersion}
              >
                {copy.reloadWinner}
              </button>
            </>
          ) : conflictDraftAvailable ? (
            <button
              className={styles.button}
              type="button"
              onClick={restoreLocalConflictDraft}
            >
              {copy.restoreLocalDraft}
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
          <button
            className={styles.button}
            type="button"
            onClick={() => createShapeNode("rectangle")}
          >
            Прямоугольник
          </button>
          <button
            className={styles.button}
            type="button"
            onClick={() => createShapeNode("circle")}
          >
            Круг
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
          className={`${styles.canvas} ${dropActive ? styles.dropActive : ""} ${styleEyedropperSourceId ? styles.canvasStyleEyedropperActive : ""}`}
          onDragEnter={() => setDropActive(true)}
          onDragLeave={() => setDropActive(false)}
          onDragOver={(event) => {
            if (transferHasFiles(transferPayload(event.nativeEvent)))
              event.preventDefault();
          }}
          onDrop={onDrop}
          onPointerDownCapture={handleCanvasPointerDown}
          onPointerMoveCapture={handleCanvasPointerMove}
          onWheelCapture={handleCanvasWheel}
        >
          <ReactFlow
            className={`${styles.canvasViewport} ${viewportVisible ? "" : styles.canvasViewportHidden}`}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onNodeDragStart={handleNodeDragStart}
            onNodeDragStop={handleNodeDragStop}
            onNodeDoubleClick={(event, node) => {
              if (node.type !== CANVAS_PDF_NODE_TYPE) return;
              event.preventDefault();
              void openPdfNode(node);
            }}
            onConnect={handleConnect}
            connectionMode={ConnectionMode.Loose}
            connectionLineComponent={CanvasConnectionLine}
            minZoom={CANVAS_VIEWPORT_LIMITS.minZoom}
            maxZoom={CANVAS_VIEWPORT_LIMITS.maxZoom}
            panOnDrag={touchPrimaryInput ? [0, 1] : [1]}
            selectionOnDrag={!touchPrimaryInput}
            selectionMode={SelectionMode.Partial}
            nodesDraggable={!touchViewportGestureActive}
            nodesConnectable={!touchViewportGestureActive}
            elementsSelectable={!touchViewportGestureActive}
            nodeDragThreshold={touchPrimaryInput ? 8 : 1}
            zoomOnPinch
            onMove={handleViewportMove}
            onMoveEnd={onMoveEnd}
            onInit={() => setFlowInstanceEpoch((current) => current + 1)}
            onPaneClick={(event) => {
              if (touchViewportGestureActiveRef.current || event.detail !== 2)
                return;
              createTextNode({ x: event.clientX, y: event.clientY }, "", true);
            }}
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background gap={24} color="#d6d3d1" />
            <Controls showInteractive={false} />
            <MiniMap
              className={styles.minimap}
              position="bottom-right"
              maskColor="rgba(28, 25, 23, 0.08)"
              nodeColor={canvasMiniMapNodeColor}
              nodeStrokeColor="#78716c"
              nodeStrokeWidth={1}
              pannable
              zoomable
            />
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
  groupRepository,
  projectFileRepository,
  projectFileVariantRepository,
  projectId,
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
  groupRepository?: CanvasGroupRepository;
  projectFileRepository?: ProjectFileRepository;
  projectFileVariantRepository?: ProjectFileImageVariantRepository;
  projectId?: string;
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
        groupRepository={groupRepository}
        projectFileRepository={projectFileRepository}
        projectFileVariantRepository={projectFileVariantRepository}
        projectId={projectId}
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
