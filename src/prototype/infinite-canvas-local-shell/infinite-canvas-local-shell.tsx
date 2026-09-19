Warning: truncated output (original token count: 58906)
Total output lines: 7030

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
  ViewportPortal,
  applyEdgeChanges,
  applyNodeChanges,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useEdgesState,
  useNodesState,
  useInternalNode,
  useReactFlow,
  useStore,
  type Connection,
  type ConnectionLineComponentProps,
  type EdgeChange,
  type EdgeProps,
  type InternalNode,
  type NodeChange,
  type NodeProps,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import {
  CanvasDesktopSidebar,
  CanvasDesktopToolbar,
} from "@/prototype/canvases/canvas-desktop-composition";
import { getCanvasBreadcrumb } from "@/prototype/canvases/canvas-breadcrumb";
import { createCanvasPortableBackup } from "@/prototype/canvases/canvas-portable-export";
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
  type ReactNode,
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
  CANVAS_CONTENT_AUTO_SIZE_EVENT,
  nextCanvasContentSize,
  type CanvasContentAutoSizeDetail,
} from "@/lib/canvas/canvas-content-auto-size";
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
import type { CanvasArticleStyle } from "@/lib/canvas/canvas-article-style";
import {
  CANVAS_NODE_CLIPBOARD_MIME,
  createCanvasNodeClipboardPayload,
  materializeCanvasClipboardPaste,
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
  canvasBranchDescendantNodeIds,
  canvasBranchCollapsedNodeIds,
  canvasBranchRuntimeState,
  projectCanvasBranchCollapse,
  translateCanvasBranchDescendants,
  type CanvasBranchCollapseEventDetail,
} from "@/lib/canvas/canvas-branch-collapse";
import {
  CANVAS_ARTICLE_NODE_TYPE,
  CANVAS_IMAGE_NODE_TYPE,
  CANVAS_PDF_NODE_TYPE,
  CANVAS_SHAPE_NODE_TYPE,
  CANVAS_SUMMARY_NODE_TYPE,
  CANVAS_TASK_NODE_TYPE,
  CANVAS_TEXT_NODE_TYPE,
  CANVAS_EDGE_TYPE,
  canvasDocumentToEdges,
  canvasDocumentToArticleNodes,
  canvasDocumentToImageNodes,
  canvasDocumentToPdfNodes,
  canvasDocumentToShapeNodes,
  canvasDocumentToSummaryNodes,
  canvasDocumentToTaskNodes,
  canvasDocumentToTextNodes,
  canvasImageAdapterDependenciesForCanvas,
  createCanvasPdfFlowNode,
  createCanvasPdfId,
  createCanvasArticleFlowNode,
  createCanvasArticleId,
  createCanvasTaskFlowNode,
  createCanvasTaskId,
  createCanvasEdgeFromConnection,
  createCanvasShapeFlowNode,
  createCanvasShapeId,
  createCanvasSummaryFlowNode,
  createCanvasSummaryId,
  createCanvasTextFlowNode,
  findCachedCanvasImagePayload,
  ingestCanvasImageTransferToNodes,
  restoreCanvasImageNodes,
  updateCanvasEdgeFlowRuntime,
  type CanvasImageAdapterDependencies,
  type CanvasFlowNode,
  type CanvasEdgeFlow,
  type CanvasEdgeFlowUpdate,
  type CanvasImageFlowNode,
  type CanvasArticleFlowNode,
  type CanvasShapeFlowNode,
  type CanvasSummaryFlowNode,
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
  type CanvasEdgeRouting,
  type CanvasHandleSide,
  type CanvasImagePin,
  type CanvasShapeNode,
  type CanvasShapeVariant,
  type CanvasSummaryNode,
} from "@/lib/canvas/canvas-document";
import {
  canvasSummaryEntries,
  isCanvasSummarySourceNode,
  nextCanvasSummaryOrder,
} from "@/lib/canvas/canvas-summary";
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
import { reconnectCanvasEdgeSide } from "@/lib/canvas/canvas-manual-connection";
import {
  canvasEdgeToolbarPosition,
  canvasManualCurvePath,
  canvasManualOrthogonalPath,
  canvasManualStraightPath,
} from "@/lib/canvas/canvas-edge-curve";
import {
  createCanvasImagePin,
  moveCanvasImagePin,
  removeCanvasImagePin,
  setCanvasImagePinColor,
  setCanvasImagePinLabel,
  setCanvasImagePinRadius,
} from "@/lib/canvas/canvas-image-pins";
import {
  canvasGroupBounds,
  scaleCanvasGroup,
  type CanvasScalableNode,
} from "@/lib/canvas/canvas-group-scaling";
import {
  createCanvasTextId,
  hasMeaningfulPlainText,
  plainTextFromClipboard,
  commitTextMarkdown,
} from "@/lib/canvas/text-canvas-interactions";
import type { PrototypeDocument } from "@/prototype/desktop-mock-data";
import {
  MarkdownDocumentPreview,
  MarkdownStringPreview,
} from "@/prototype/knowledge/markdown-document-preview";
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

function hasCachedPayloadForEveryImageNode(
  nodes: readonly CanvasFlowNode[],
  assetPayloads: ReadonlyMap<string, CanvasImageRuntimePayload>,
  scope: { workspaceId: string; canvasId: string },
): boolean {
  return nodes.every((node) => {
    if (node.type !== CANVAS_IMAGE_NODE_TYPE) return true;
    const requestedSource =
      node.data.resolutionSource ??
      canvasImageResolutionSourceFromLegacyKind(
        node.data.variantKind ?? "original",
      );
    return Boolean(
      findCachedCanvasImagePayload({
        payloads: assetPayloads,
        workspaceId: scope.workspaceId,
        canvasId: scope.canvasId,
        assetId: node.data.assetId,
        requestedSource,
      }),
    );
  });
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

function eventTargetsCanvasArticleReader(event: Event): boolean {
  return event.composedPath().some((candidate) => {
    if (!(candidate instanceof Element)) return false;
    return candidate.closest(".canvas-article-reader") !== null;
  });
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

type CanvasImagePinsEventDetail = {
  id: string;
  pins: CanvasImagePin[];
  /** Pointer moves only update the live projection; pointer release persists it. */
  commit: boolean;
};

function dispatchCanvasImagePins(detail: CanvasImagePinsEventDetail): void {
  window.dispatchEvent(new CustomEvent("mozg:canvas-image-pins", { detail }));
}

function imagePinPosition(
  event: ReactPointerEvent<HTMLButtonElement>,
): { x: number; y: number } | null {
  const layer = event.currentTarget.closest<HTMLElement>(
    "[data-canvas-image-pin-layer]",
  );
  const rect = layer?.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  const pinRect = event.currentTarget.getBoundingClientRect();
  const minX = Math.min(0.5, pinRect.width / 2 / rect.width);
  const minY = Math.min(0.5, pinRect.height / 2 / rect.height);
  return {
    x: Math.min(
      1 - minX,
      Math.max(minX, (event.clientX - rect.left) / rect.width),
    ),
    y: Math.min(
      1 - minY,
      Math.max(minY, (event.clientY - rect.top) / rect.height),
    ),
  };
}

type ImagePinDragState = {
  startX: number;
  startY: number;
  moved: boolean;
};

function ImagePins({
  id,
  pins,
}: {
  id: string;
  pins: readonly CanvasImagePin[];
}): React.JSX.Element | null {
  const [menuPinId, setMenuPinId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const layerRef = useRef<HTMLDivElement>(null);
  const pinDragRef = useRef(new Map<string, ImagePinDragState>());

  useEffect(() => {
    if (!menuPinId) return;
    const closeMenuOutsideImage = (event: PointerEvent): void => {
      const imageBounds = layerRef.current?.parentElement;
      if (imageBounds?.contains(event.target as Node)) return;
      setMenuPinId(null);
    };
    document.addEventListener("pointerdown", closeMenuOutsideImage, true);
    return () =>
      document.removeEventListener("pointerdown", closeMenuOutsideImage, true);
  }, [menuPinId]);

  if (pins.length === 0) return null;
  return (
    <div
      ref={layerRef}
      className={`${styles.imagePinLayer} nodrag nopan nowheel`}
      data-canvas-image-pin-layer="true"
    >
      {pins.map((pin, index) => {
        const position = { left: `${pin.x * 100}%`, top: `${pin.y * 100}%` };
        const menuOpen = menuPinId === pin.id;
        const defaultLabel = String(index + 1);
        const persistedLabel =
          labelDraft === "" || labelDraft === defaultLabel
            ? undefined
            : labelDraft;
        const pinsWithLabelDraft = (nextPins: readonly CanvasImagePin[]) =>
          menuOpen
            ? setCanvasImagePinLabel(nextPins, pin.id, persistedLabel)
            : [...nextPins];
        const update = (nextPins: CanvasImagePin[]) => {
          dispatchCanvasImagePins({ id, pins: nextPins, commit: true });
        };
        return (
          <div key={pin.id}>
            <button
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label={`Пин ${index + 1}. Перетащите для перемещения, двойной клик открывает меню.`}
              className={`${styles.imagePin} nodrag nopan nowheel`}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (menuOpen) {
                  setMenuPinId(null);
                  return;
                }
                setLabelDraft(pin.label ?? defaultLabel);
                setMenuPinId(pin.id);
              }}
              onPointerCancel={(event) => {
                event.stopPropagation();
                const drag = pinDragRef.current.get(pin.id);
                pinDragRef.current.delete(pin.id);
                if (!drag?.moved) return;
                const position = imagePinPosition(event);
                if (!position) return;
                dispatchCanvasImagePins({
                  id,
                  pins: moveCanvasImagePin(pins, pin.id, position),
                  commit: true,
                });
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                pinDragRef.current.set(pin.id, {
                  startX: event.clientX,
                  startY: event.clientY,
                  moved: false,
                });
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId))
                  return;
                event.preventDefault();
                event.stopPropagation();
                const drag = pinDragRef.current.get(pin.id);
                if (!drag) return;
                if (!drag.moved) {
                  drag.moved =
                    Math.hypot(
                      event.clientX - drag.startX,
                      event.clientY - drag.startY,
                    ) >= 4;
                }
                if (!drag.moved) return;
                const position = imagePinPosition(event);
                if (!position) return;
                dispatchCanvasImagePins({
                  id,
                  pins: moveCanvasImagePin(pins, pin.id, position),
                  commit: false,
                });
              }}
              onPointerUp={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const drag = pinDragRef.current.get(pin.id);
                pinDragRef.current.delete(pin.id);
                if (!drag?.moved) return;
                const position = imagePinPosition(event);
                if (!position) return;
                dispatchCanvasImagePins({
                  id,
                  pins: moveCanvasImagePin(pins, pin.id, position),
                  commit: true,
                });
              }}
              style={
                {
                  ...position,
                  "--image-pin-color": `var(--image-pin-${pin.color})`,
                  "--image-pin-diameter": `${pin.radius * 2}px`,
                  "--image-pin-font-size": `${Math.max(
                    9,
                    Math.round(pin.radius * 0.85),
                  )}px`,
                  "--image-pin-radius": `${pin.radius}px`,
                } as CSSProperties
              }
              title={`Пин ${index + 1}: перетащить · двойной клик открыть меню`}
              type="button"
            >
              {pin.label ?? defaultLabel}
            </button>
            {menuOpen ? (
              <div
                aria-label={`Меню пина ${index + 1}`}
                className={`${styles.imagePinMenu} nodrag nopan nowheel`}
                role="menu"
                style={
                  {
                    ...position,
                    "--image-pin-radius": `${pin.radius}px`,
                  } as CSSProperties
                }
                onDoubleClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <div className={styles.imagePinMenuSection}>
                  {(["red", "yellow", "green"] as const).map((color) => (
                    <button
                      key={color}
                      aria-label={`Сделать пин ${
                        color === "red"
                          ? "красным"
                          : color === "yellow"
                            ? "жёлтым"
                            : "зелёным"
                      }`}
                      aria-checked={pin.color === color}
                      className={styles.imagePinColorButton}
                      data-color={color}
                      onClick={() =>
                        update(
                          pinsWithLabelDraft(
                            setCanvasImagePinColor(pins, pin.id, color),
                          ),
                        )
                      }
                      role="menuitemradio"
                      type="button"
                    />
                  ))}
                </div>
                <label className={styles.imagePinLabelControl}>
                  Цифра
                  <input
                    aria-label="Цифра на пине"
                    inputMode="numeric"
                    maxLength={3}
                    onChange={(event) => {
                      const nextLabel = event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 3);
                      setLabelDraft(nextLabel);
                      update(
                        setCanvasImagePinLabel(
                          pins,
                          pin.id,
                          nextLabel === "" || nextLabel === defaultLabel
                            ? undefined
                            : nextLabel,
                        ),
                      );
                    }}
                    type="text"
                    value={labelDraft}
                  />
                </label>
                <div className={styles.imagePinMenuSection}>
                  <button
                    aria-label="Уменьшить размер пина"
                    className={styles.imagePinMenuButton}
                    disabled={pin.radius <= 8}
                    onClick={() =>
                      update(
                        pinsWithLabelDraft(
                          setCanvasImagePinRadius(pins, pin.id, pin.radius - 2),
                        ),
                      )
                    }
                    type="button"
                  >
                    −
                  </button>
                  <span className={styles.imagePinRadiusLabel}>
                    {pin.radius}
                  </span>
                  <button
                    aria-label="Увеличить размер пина"
                    className={styles.imagePinMenuButton}
                    disabled={pin.radius >= 32}
                    onClick={() =>
                      update(
                        pinsWithLabelDraft(
                          setCanvasImagePinRadius(pins, pin.id, pin.radius + 2),
                        ),
                      )
                    }
                    type="button"
                  >
                    +
                  </button>
                </div>
                <button
                  className={`${styles.imagePinDeleteButton} ${styles.imagePinMenuButton}`}
                  onClick={() => {
                    update(removeCanvasImagePin(pins, pin.id));
                    setMenuPinId(null);
                  }}
                  role="menuitem"
                  type="button"
                >
                  Удалить
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ImagePinAddControl({
  id,
  pins,
  selected,
}: {
  id: string;
  pins: readonly CanvasImagePin[];
  selected: boolean;
}): React.JSX.Element | null {
  const selectedNodeCount = useStore((state) =>
    state.nodes.reduce((count, node) => count + (node.selected ? 1 : 0), 0),
  );
  // A pin belongs to one picture. Keeping the control out of multi-selection
  // prevents adding an ambiguous pin when several images share a selection.
  if (!selected || selectedNodeCount !== 1) return null;
  return (
    <button
      aria-label="Добавить пин на изображение"
      className={`${styles.imagePinAdd} nodrag nopan nowheel`}
      onClick={(event) => {
        event.stopPropagation();
        const pin = createCanvasImagePin(pins);
        if (!pin) return;
        dispatchCanvasImagePins({
          id,
          pins: [...pins, pin],
          commit: true,
        });
      }}
      onPointerDown={(event) => event.stopPropagation()}
      title="Добавить пин"
      type="button"
    />
  );
}

function ImageNodeBody({
  id,
  data,
  selected,
}: NodeProps<CanvasImageFlowNode>): React.JSX.Element {
  const pins = data.pins ?? [];
  return (
    <CanvasNodeFrame
      selected={selected}
      minWidth={120}
      minHeight={80}
      keepAspectRatio
      className={styles.imageNodeFrame}
      contextMenu={
        <ImagePinAddControl id={id} pins={pins} selected={selected} />
      }
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
      <ImagePins id={id} pins={pins} />
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

function dispatchCanvasArticleStylePatch(
  id: string,
  patch: Partial<CanvasArticleStyle>,
): void {
  window.dispatchEvent(
    new CustomEvent("mozg:canvas-article-style", { detail: { id, patch } }),
  );
}

function dispatchCanvasArticleStyleEyedropperStart(id: string): void {
  window.dispatchEvent(
    new CustomEvent("mozg:canvas-style-eyedropper-start", { detail: { id } }),
  );
}

function ArticleSelectionToolbar({
  id,
  style,
}: {
  id: string;
  style: CanvasArticleStyle;
}): React.JSX.Element | null {
  const selectedNodeCount = useStore((state) =>
    Array.from(state.nodeLookup.values()).reduce(
      (count, node) => count + (node.selected ? 1 : 0),
      0,
    ),
  );
  if (selectedNodeCount !== 1) return null;
  const patchStyle = (patch: Partial<CanvasArticleStyle>): void =>
    dispatchCanvasArticleStylePatch(id, patch);
  return (
    <div
      className={`${styles.textSelectionToolbar} nodrag nopan nowheel`}
      aria-label="Панель оформления статьи"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className={styles.textToolbarButton}
        aria-label="Уменьшить размер названия статьи"
        title="Уменьшить размер названия"
        onClick={() =>
          patchStyle({
            titleFontSize: previousCanvasTextFontSize(style.titleFontSize),
          })
        }
      >
        −
      </button>
      <span className={styles.articleToolbarSize} aria-label="Размер названия">
        {style.titleFontSize}
      </span>
      <button
        type="button"
        className={styles.textToolbarButton}
        aria-label="Увеличить размер названия статьи"
        title="Увеличить размер названия"
        onClick={() =>
          patchStyle({
            titleFontSize: nextCanvasTextFontSize(style.titleFontSize),
          })
        }
      >
        +
      </button>
      <span className={styles.textToolbarDivider} aria-hidden="true" />
      <CanvasColorPicker
        label="Цвет надписи «СТАТЬЯ»"
        value={style.badgeColor}
        onCommit={(badgeColor) => patchStyle({ badgeColor })}
      />
      <CanvasColorPicker
        label="Цвет названия статьи"
        value={style.titleColor}
        onCommit={(titleColor) => patchStyle({ titleColor })}
      />
      <CanvasColorPicker
        label="Цвет заливки статьи"
        value={style.backgroundColor}
        onCommit={(backgroundColor) => patchStyle({ backgroundColor })}
      />
      <button
        type="button"
        className={`${styles.textToolbarButton} ${styles.styleEyedropperButton}`}
        aria-label="Пипетка статьи"
        title="Скопировать оформление другой статьи"
        onClick={() => dispatchCanvasArticleStyleEyedropperStart(id)}
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
    </div>
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const reportContentHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const previousHeight = textarea.style.height;
    textarea.style.height = "0px";
    const contentHeight = textarea.scrollHeight;
    textarea.style.height = previousHeight;
    window.dispatchEvent(
      new CustomEvent<CanvasContentAutoSizeDetail>(
        CANVAS_CONTENT_AUTO_SIZE_EVENT,
        { detail: { id, kind: eventKind, contentHeight } },
      ),
    );
  }, [eventKind, id]);

  useEffect(() => {
    const frame = requestAnimationFrame(reportContentHeight);
    return () => cancelAnimationFrame(frame);
  }, [draft, reportContentHeight]);

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
      ref={textareaRef}
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

function ArticleNodeBody({
  id,
  data,
  selected,
}: NodeProps<CanvasArticleFlowNode>): React.JSX.Element {
  return (
    <CanvasNodeFrame
      selected={selected}
      minWidth={180}
      minHeight={88}
      className={`${styles.articleNodeFrame} ${
        data.readerOpen ? styles.articleNodeFrameReaderOpen : ""
      }`.trim()}
      toolbar={<ArticleSelectionToolbar id={id} style={data.style} />}
      toolbarWhenReaderOpen
      connectionHandleLayer={<ConnectionHandleLayer selected={selected} />}
    >
      <div
        className={styles.articleNodeContent}
        style={{ backgroundColor: data.style.backgroundColor }}
      >
        <span
          className={styles.articleNodeBadge}
          style={{ color: data.style.badgeColor }}
        >
          СТАТЬЯ
        </span>
        <span
          className={styles.articleNodeName}
          title={data.lastKnownTitle ?? "Статья"}
          style={{
            color: data.style.titleColor,
            fontSize: data.style.titleFontSize,
          }}
        >
          {data.lastKnownTitle ?? "Статья"}
        </span>
      </div>
    </CanvasNodeFrame>
  );
}

function SummaryNodeBody({
  data,
  selected,
}: NodeProps<CanvasSummaryFlowNode>): React.JSX.Element {
  return (
    <CanvasNodeFrame
      selected={selected}
      minWidth={132}
      minHeight={80}
      className={`${styles.summaryNodeFrame} ${
        data.readerOpen ? styles.summaryNodeFrameReaderOpen : ""
      }`.trim()}
      connectionHandleLayer={<ConnectionHandleLayer selected={selected} />}
    >
      <div className={styles.summaryNodeContent}>
        <span aria-hidden="true" className={styles.summaryNodeSymbol}>
          Σ
        </span>
        <span className={styles.summaryNodeTitle} title={data.title}>
          {data.title}
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
      centerTextContent={false}
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
      centerTextContent={!data.isEditing}
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
  const reactFlow = useReactFlow();
  const selectedElementCount = useStore(
    (state) =>
      state.nodes.filter((node) => node.selected).length +
      state.edges.filter((edge) => edge.selected).length,
  );
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
  const routing = data?.routing ?? "curved";
  const arrows = data?.arrows ?? "none";
  const manualBend = data?.bend;
  const computedPath = geometry
    ? routing === "curved" && manualBend
      ? ([
          canvasManualCurvePath(
            geometry.sourceAnchor,
            manualBend,
            geometry.targetAnchor,
          ),
          manualBend.x,
          manualBend.y,
        ] as const)
      : routing === "straight" && manualBend
        ? ([
            canvasManualStraightPath(
              geometry.sourceAnchor,
              manualBend,
              geometry.targetAnchor,
            ),
            manualBend.x,
            manualBend.y,
          ] as const)
        : routing === "orthogonal" && manualBend
          ? ([
              canvasManualOrthogonalPath(
                geometry.sourceAnchor,
                manualBend,
                geometry.targetAnchor,
              ),
              manualBend.x,
              manualBend.y,
            ] as const)
          : routing === "orthogonal"
            ? getSmoothStepPath({
                sourceX: geometry.sourceAnchor.x,
                sourceY: geometry.sourceAnchor.y,
                sourcePosition,
                targetX: geometry.targetAnchor.x,
                targetY: geometry.targetAnchor.y,
                targetPosition,
              })
            : routing === "straight"
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
  if (!computedPath || !geometry) {
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
  const visibleBend = manualBend ?? { x: labelX, y: labelY };
  const toolbarPosition = canvasEdgeToolbarPosition(
    geometry.sourceAnchor,
    geometry.targetAnchor,
  );
  const endpointArrows = canvasArrowsToEndpointArrows(arrows);
  const stopToolbarEvent = (event: React.SyntheticEvent): void => {
    event.stopPropagation();
  };
  const toolbarVisible = selected && selectedElementCount === 1;
  const updateManualBend = (
    event: ReactPointerEvent<SVGCircleElement>,
    commit: boolean,
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    const bend = reactFlow.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    data?.onUpdate?.(id, { routing, arrows, bend });
    if (commit) event.currentTarget.releasePointerCapture(event.pointerId);
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
        {toolbarVisible ? (
          <circle
            aria-label="Точка конфигурации связи"
            className={`${styles.edgeBendHandle} nodrag nopan nowheel`}
            cx={visibleBend.x}
            cy={visibleBend.y}
            onPointerCancel={(event) => updateManualBend(event, true)}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId))
                return;
              updateMa…28906 tokens truncated…OpenArticleId],
  );

  const createArticleNode = useCallback(
    (article: PrototypeDocument) => {
      if (!shellStateRef.current.canvasId) return;
      const existing = nodesRef.current.find(
        (node) =>
          node.type === CANVAS_ARTICLE_NODE_TYPE &&
          node.data.articleId === article.id,
      );
      if (existing) {
        setNodes((current) =>
          current.map((node) => ({
            ...node,
            selected: node.id === existing.id,
          })),
        );
        openArticleNode(existing);
        setArticlePickerOpen(false);
        setArticleQuery("");
        return;
      }
      const zIndex =
        Math.max(
          0,
          ...controller.state.document.nodes.map((node) => node.zIndex),
        ) + 1;
      const canonical = {
        id: createCanvasArticleId(),
        kind: "article" as const,
        articleId: article.id,
        lastKnownTitle: article.title,
        position: centerPosition(),
        size: { width: 300, height: 120 },
        zIndex,
      };
      const runtime = createCanvasArticleFlowNode(canonical);
      setNodes((current) => [
        ...current.map((node) => ({ ...node, selected: false })),
        { ...runtime, selected: true },
      ]);
      controller.insertCanvasNodes([canonical]);
      syncState();
      scheduleSave();
      openArticleNode(runtime);
      setArticlePickerOpen(false);
      setArticleQuery("");
    },
    [
      centerPosition,
      controller,
      openArticleNode,
      scheduleSave,
      setNodes,
      syncState,
    ],
  );

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
      onCanvasDeleted?.(canvasId);
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
      onCanvasDeleted,
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
      latestViewportRef.current = { ...viewport };
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
          if (
            sourceNode?.type === CANVAS_ARTICLE_NODE_TYPE &&
            targetNode?.type === CANVAS_ARTICLE_NODE_TYPE
          ) {
            updateArticleStyle(sourceId, targetNode.data.style);
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
      updateArticleStyle,
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
  const canvasBreadcrumb = useMemo(
    () =>
      getCanvasBreadcrumb(
        groups,
        summaries.find((summary) => summary.id === shellState.canvasId),
      ),
    [groups, shellState.canvasId, summaries],
  );
  const desktopSidebar =
    embedded && !hideDesktopSidebar ? (
      <CanvasDesktopSidebar
        activeCanvasId={sidebarActiveCanvasId ?? shellState.canvasId}
        copy={copy}
        error={shellState.error}
        groups={groups}
        groupsError={groupsError}
        highlightedGroupId={highlightedCanvasGroupId}
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
        onRenameGroup={(groupId, title) =>
          void renameCanvasGroup(groupId, title)
        }
        onRetry={() => window.location.reload()}
        onSelectCanvas={(canvasId) => {
          setHighlightedCanvasGroupId(null);
          if (onSidebarSelectCanvas) onSidebarSelectCanvas(canvasId);
          else void openCanvas(canvasId);
        }}
        summaries={summaries}
      />
    ) : null;

  const desktopToolbar = embedded ? (
    <CanvasDesktopToolbar
      breadcrumb={{
        highlightedGroupId: highlightedCanvasGroupId,
        onSelectCanvas: (canvasId) => {
          setHighlightedCanvasGroupId(null);
          if (onToolbarSelectCanvas) onToolbarSelectCanvas(canvasId);
          else void openCanvas(canvasId);
        },
        onSelectGroup: setHighlightedCanvasGroupId,
        segments: canvasBreadcrumb,
      }}
      canRedo={controller.canRedo}
      canUndo={controller.canUndo}
      interactive={Boolean(shellState.canvasId) && loadingLifecycle === "ready"}
      copy={copy}
      error={shellState.error}
      conflictDraftAvailable={conflictDraftAvailable}
      articlePickerOpen={articlePickerOpen}
      articleQuery={articleQuery}
      articleResults={articleResults}
      articleToolsReady={knowledgeArticles.length > 0}
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
      onAddSummary={createSummaryNode}
      onExportPortableCopy={() => void exportPortableCanvasCopy()}
      onCloseArticlePicker={() => setArticlePickerOpen(false)}
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
      onSelectArticle={createArticleNode}
      onSelectTask={createTaskNode}
      onArticleQueryChange={setArticleQuery}
      onTaskQueryChange={setTaskQuery}
      onToggleFilePicker={() => {
        setArticlePickerOpen(false);
        setTaskPickerOpen(false);
        setFilePickerOpen((current) => !current);
      }}
      onToggleArticlePicker={() => {
        setFilePickerOpen(false);
        setTaskPickerOpen(false);
        setArticlePickerOpen((current) => !current);
      }}
      onToggleSplitView={onToggleSplitView}
      onToggleSidebar={() => {
        readerSidebarWasAutoCollapsedRef.current = false;
        setDesktopSidebarOpen((current) => !current);
      }}
      onToggleTaskPicker={() => {
        setArticlePickerOpen(false);
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
      showSidebarToggle={!hideDesktopSidebar}
      splitViewActive={splitViewActive}
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
      className={`${styles.page} ${styles.pageEmbedded} ${styles.desktopCanvasPage} ${desktopSidebarOpen && !hideDesktopSidebar ? "" : styles.desktopCanvasPageSidebarCollapsed}`}
    >
      {desktopSidebar}
      {secondaryPane ? (
        <div className={styles.desktopCanvasDualGrid}>
          <div
            className={`${styles.desktopCanvasPane} ${paneActive ? styles.desktopCanvasPaneActive : ""}`}
            onPointerDownCapture={onPaneActivate}
          >
            <section className={styles.desktopCanvasMain} aria-label="Холст 1">
              {desktopToolbar}
              {content}
            </section>
          </div>
          {secondaryPane}
        </div>
      ) : (
        <section
          className={styles.desktopCanvasMain}
          aria-label="Холст"
          onPointerDownCapture={onPaneActivate}
        >
          {desktopToolbar}
          {content}
        </section>
      )}
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
  const showMiniMap = !splitViewActive || paneActive;
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
              onSelectionChange={handleSelectionChange}
              onEdgesChange={handleEdgesChange}
              onNodeDragStart={handleNodeDragStart}
              onNodeDragStop={handleNodeDragStop}
              onNodeDoubleClick={(event, node) => {
                if (node.type === CANVAS_ARTICLE_NODE_TYPE) {
                  event.preventDefault();
                  openArticleNode(node);
                  return;
                }
                if (node.type !== CANVAS_PDF_NODE_TYPE) return;
                event.preventDefault();
                void openPdfNode(node);
              }}
              onNodeClick={(event, node) => {
                if (node.type !== CANVAS_SUMMARY_NODE_TYPE) return;
                event.preventDefault();
                openSummaryNode(node);
              }}
              onConnect={handleConnect}
              onReconnect={handleReconnect}
              edgesReconnectable
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
              deleteKeyCode={clipboardActive ? ["Backspace", "Delete"] : null}
            >
              <Background gap={24} color="#d6d3d1" />
              <Controls showInteractive={false} />
              {showMiniMap ? (
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
              ) : null}
              <CanvasEdgeMarkerDefinitions />
              <CanvasGroupScaleOverlay
                nodes={renderedNodes}
                selectedNodeIds={selectedCanvasNodeIds}
                onCommit={commitGroupScale}
                onPreview={previewGroupScale}
              />
            </ReactFlow>
            {!viewportVisible ? (
              <div className={styles.canvasLoading} role="status">
                Preparing canvas…
              </div>
            ) : null}
            <div className={styles.canvasHint}>
              {clipboardNotice ??
                (dropActive
                  ? "Drop PNG, JPEG, WebP or PDF here"
                  : "Paste, drop or choose a file · drag and resize are saved")}
            </div>
          </div>
        </div>
        {openPdf ? (
          <aside
            className={`${styles.pdfReader} canvas-pdf-reader ${splitViewActive ? styles.canvasReaderInPane : ""} ${pdfFullscreen ? `${styles.pdfReaderFullscreen} canvas-pdf-reader-fullscreen` : ""}`}
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
                  onClick={() => closePdfReader()}
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
        {shellState.openArticleId ? (
          <aside
            aria-label="Просмотр статьи"
            className={`${styles.articleReader} canvas-article-reader ${splitViewActive ? styles.canvasReaderInPane : ""}`}
          >
            <header className={styles.pdfReaderHeader}>
              <strong title={openArticle?.title ?? "Статья недоступна"}>
                {openArticle?.title ?? "Статья недоступна"}
              </strong>
              <div className={styles.pdfReaderHeaderActions}>
                <button
                  aria-label="Закрыть статью"
                  onClick={closeArticleReader}
                  title="Закрыть статью"
                  type="button"
                >
                  <UiIcon name="close" />
                </button>
              </div>
            </header>
            {openArticle ? (
              <article
                aria-label={openArticle.title}
                className={`document-page ${styles.articleReaderDocument}`}
              >
                <div className="document-page-inner">
                  <MarkdownDocumentPreview
                    document={openArticle}
                    onInternalLink={(documentId) => {
                      if (
                        knowledgeArticles.some(
                          (article) => article.id === documentId,
                        )
                      )
                        openArticleFromReader(documentId);
                    }}
                  />
                </div>
              </article>
            ) : (
              <div className={styles.articleReaderMissing} role="status">
                Статья больше недоступна. Выберите другую через кнопку «Открыть
                статью» в верхней панели.
              </div>
            )}
          </aside>
        ) : null}
        {openSummary ? (
          <aside
            aria-label="Просмотр суммы"
            className={`${styles.pdfReader} ${styles.summaryReader} canvas-summary-reader ${splitViewActive ? styles.canvasReaderInPane : ""}`}
          >
            <header className={styles.pdfReaderHeader}>
              <strong title={openSummary.title}>{openSummary.title}</strong>
              <div className={styles.pdfReaderHeaderActions}>
                <button
                  aria-label="Закрыть сумму"
                  onClick={closeSummaryReader}
                  title="Закрыть сумму"
                  type="button"
                >
                  <UiIcon name="close" />
                </button>
              </div>
            </header>
            <article
              aria-label={openSummary.title}
              className={styles.summaryReaderDocument}
            >
              {openSummaryEntries.length > 0 ? (
                <ol className={styles.summaryReaderList}>
                  {openSummaryEntries.map((entry) => (
                    <li
                      key={entry.nodeId}
                      className={
                        entry.role === "heading"
                          ? styles.summaryReaderHeading
                          : undefined
                      }
                    >
                      <div
                        aria-level={entry.role === "heading" ? 2 : undefined}
                        role={entry.role === "heading" ? "heading" : undefined}
                      >
                        <MarkdownStringPreview
                          contentId={`summary:${openSummary.id}:${entry.nodeId}`}
                          markdown={entry.markdown}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className={styles.summaryReaderEmpty}>
                  Подключите к «Сумме» текстовые или геометрические ноды.
                </p>
              )}
            </article>
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
            nodes={renderedNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={handleNodesChange}
            onSelectionChange={handleSelectionChange}
            onEdgesChange={handleEdgesChange}
            onNodeDragStart={handleNodeDragStart}
            onNodeDragStop={handleNodeDragStop}
            onNodeDoubleClick={(event, node) => {
              if (node.type === CANVAS_ARTICLE_NODE_TYPE) {
                event.preventDefault();
                openArticleNode(node);
                return;
              }
              if (node.type !== CANVAS_PDF_NODE_TYPE) return;
              event.preventDefault();
              void openPdfNode(node);
            }}
            onNodeClick={(event, node) => {
              if (node.type !== CANVAS_SUMMARY_NODE_TYPE) return;
              event.preventDefault();
              openSummaryNode(node);
            }}
            onConnect={handleConnect}
            onReconnect={handleReconnect}
            edgesReconnectable
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
            deleteKeyCode={clipboardActive ? ["Backspace", "Delete"] : null}
          >
            <Background gap={24} color="#d6d3d1" />
            <Controls showInteractive={false} />
            {showMiniMap ? (
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
            ) : null}
            <CanvasEdgeMarkerDefinitions />
            <CanvasGroupScaleOverlay
              nodes={renderedNodes}
              selectedNodeIds={selectedCanvasNodeIds}
              onCommit={commitGroupScale}
              onPreview={previewGroupScale}
            />
          </ReactFlow>
          {!viewportVisible ? (
            <div className={styles.canvasLoading} role="status">
              Preparing canvas…
            </div>
          ) : null}
          <div className={styles.canvasHint}>
            {clipboardNotice ??
              (dropActive
                ? "Drop PNG, JPEG or WebP here"
                : "Paste, drop or choose an image · drag and resize are saved")}
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
  canvasOpenRequest,
  clipboardActive,
  copy,
  embedded,
  excludedCanvasId,
  groupRepository,
  hideDesktopSidebar,
  knowledgeArticles,
  onActiveCanvasChange,
  onCanvasDeleted,
  onPaneActivate,
  onSidebarSelectCanvas,
  onToolbarSelectCanvas,
  onToggleSplitView,
  paneActive,
  projectFileRepository,
  projectFileVariantRepository,
  projectId,
  repository,
  runtimeCache,
  secondaryPane,
  showDiagnostics,
  sidebarActiveCanvasId,
  splitViewActive,
  taskBridge,
  taskWorkspaceId,
  userId,
  workspaceId,
}: {
  activeTaskDetailsTaskId?: string;
  assetRepository: CanvasAssetRepository;
  canvasOpenRequest?: { canvasId: string; requestId: number } | null;
  clipboardActive?: boolean;
  copy: CanvasShellCopy;
  embedded?: boolean;
  excludedCanvasId?: string | null;
  groupRepository?: CanvasGroupRepository;
  hideDesktopSidebar?: boolean;
  knowledgeArticles?: readonly PrototypeDocument[];
  onActiveCanvasChange?: (canvasId: string | null) => void;
  onCanvasDeleted?: (canvasId: string) => void;
  onPaneActivate?: () => void;
  onSidebarSelectCanvas?: (canvasId: string) => void;
  onToolbarSelectCanvas?: (canvasId: string) => void;
  onToggleSplitView?: () => void;
  paneActive?: boolean;
  projectFileRepository?: ProjectFileRepository;
  projectFileVariantRepository?: ProjectFileImageVariantRepository;
  projectId?: string;
  repository: CanvasShellRepository;
  runtimeCache?: CloudCanvasRuntimeCache;
  secondaryPane?: ReactNode;
  showDiagnostics: boolean;
  sidebarActiveCanvasId?: string | null;
  splitViewActive?: boolean;
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
        canvasOpenRequest={canvasOpenRequest}
        clipboardActive={clipboardActive}
        copy={copy}
        embedded={embedded}
        excludedCanvasId={excludedCanvasId}
        groupRepository={groupRepository}
        hideDesktopSidebar={hideDesktopSidebar}
        knowledgeArticles={knowledgeArticles}
        onActiveCanvasChange={onActiveCanvasChange}
        onCanvasDeleted={onCanvasDeleted}
        onPaneActivate={onPaneActivate}
        onSidebarSelectCanvas={onSidebarSelectCanvas}
        onToolbarSelectCanvas={onToolbarSelectCanvas}
        onToggleSplitView={onToggleSplitView}
        paneActive={paneActive}
        projectFileRepository={projectFileRepository}
        projectFileVariantRepository={projectFileVariantRepository}
        projectId={projectId}
        repository={repository}
        runtimeCache={runtimeCache}
        secondaryPane={secondaryPane}
        showDiagnostics={showDiagnostics}
        sidebarActiveCanvasId={sidebarActiveCanvasId}
        splitViewActive={splitViewActive}
        taskBridge={taskBridge}
        taskWorkspaceId={taskWorkspaceId}
        userId={userId}
        workspaceId={workspaceId}
      />
    </ReactFlowProvider>
  );
}
