"use client";

import {
  Handle,
  NodeResizer,
  NodeToolbar,
  Position,
  useInternalNode,
  useNodeId,
  useStore,
  useStoreApi,
} from "@xyflow/react";
import {
  cloneElement,
  isValidElement,
  useEffect,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { CanvasTextAlignment } from "@/lib/canvas/canvas-text-style";
import {
  CANVAS_CONNECTION_HANDLE_CENTER_OFFSET,
  CANVAS_CONNECTION_HANDLE_DIAMETER,
  CANVAS_CONNECTION_HANDLE_GAP,
  CANVAS_CONNECTION_HANDLE_RADIUS,
} from "@/lib/canvas/canvas-edge-geometry";
import {
  canvasBranchRuntimeState,
  projectCanvasBranchCollapse,
} from "@/lib/canvas/canvas-branch-collapse";
import styles from "./infinite-canvas-local-shell.module.css";

export type CanvasNodeFrameProps = {
  children: ReactNode;
  selected: boolean;
  minWidth: number;
  minHeight: number;
  keepAspectRatio?: boolean;
  centerTextContent?: boolean;
  className?: string;
  toolbar?: ReactNode;
  contextMenu?: ReactNode;
  /** Shared interaction layer for persistent Canvas connections. */
  connectionHandleLayer?: ReactNode;
};

function SelectionLayer({
  selected,
}: {
  selected: boolean;
}): React.JSX.Element {
  return (
    <span
      className={styles.selectionLayer}
      data-selected={selected ? "true" : "false"}
      aria-hidden="true"
    />
  );
}

function ResizeLayer({
  keepAspectRatio,
  minHeight,
  minWidth,
  selected,
}: Pick<CanvasNodeFrameProps, "keepAspectRatio" | "minHeight" | "minWidth"> & {
  selected: boolean;
}): React.JSX.Element {
  return (
    <NodeResizer
      color="#0f766e"
      isVisible={selected}
      keepAspectRatio={keepAspectRatio}
      minWidth={minWidth}
      minHeight={minHeight}
    />
  );
}

const CONNECTION_HANDLES = [
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left },
] as const;

const CONNECTION_HANDLE_STYLE = {
  "--connection-handle-diameter": `${CANVAS_CONNECTION_HANDLE_DIAMETER}px`,
  "--connection-handle-radius": `${CANVAS_CONNECTION_HANDLE_RADIUS}px`,
  "--connection-handle-gap": `${CANVAS_CONNECTION_HANDLE_GAP}px`,
  "--connection-handle-center-offset": `${CANVAS_CONNECTION_HANDLE_CENTER_OFFSET}px`,
} as CSSProperties;

const BRANCH_CONTROL_STYLE: CSSProperties = {
  position: "absolute",
  top: -34,
  right: -34,
  zIndex: 12,
  minWidth: 28,
  height: 28,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "2px solid currentColor",
  borderRadius: 999,
  background: "rgba(255, 255, 255, 0.94)",
  color: "#292524",
  padding: "0 6px",
  boxShadow: "0 2px 8px rgba(28, 25, 23, 0.10)",
  font: "inherit",
  fontSize: 14,
  fontWeight: 650,
  lineHeight: 1,
  cursor: "pointer",
  pointerEvents: "auto",
};

export function ConnectionHandleLayer({
  selected,
}: {
  selected: boolean;
}): React.JSX.Element {
  return (
    <div className={styles.connectionHandleLayer} data-slot="connections">
      {CONNECTION_HANDLES.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type="source"
          position={handle.position}
          className={`${styles.connectionHandle} nodrag nopan nowheel`}
          data-side={handle.id}
          data-visible={selected ? "true" : "false"}
          style={CONNECTION_HANDLE_STYLE}
          isConnectableStart
          isConnectableEnd
          aria-label={`${handle.id} connection handle`}
        />
      ))}
    </div>
  );
}

function NodeToolbarSlot({
  children,
  selected,
}: {
  children: ReactNode;
  selected: boolean;
}): React.JSX.Element {
  return (
    <NodeToolbar
      className={styles.nodeToolbarSlot}
      data-slot="toolbar"
      // Opening a PDF keeps its Canvas node selected as a persistent visual
      // indicator. Opt out of React Flow's single-selection default so a
      // selected text or shape node still exposes its own formatting tools.
      isVisible={selected}
      position={Position.Top}
      offset={10}
    >
      {children}
    </NodeToolbar>
  );
}

function NodeContextMenuSlot({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div className={styles.nodeContextMenuSlot} data-slot="context-menu">
      {children}
    </div>
  );
}

const TEXT_ALIGNMENTS: readonly CanvasTextAlignment[] = [
  "left",
  "center",
  "right",
];

function TextAlignmentGlyph({
  alignment,
}: {
  alignment: CanvasTextAlignment;
}): React.JSX.Element {
  const middle =
    alignment === "left"
      ? "M2 7h7"
      : alignment === "right"
        ? "M5 7h7"
        : "M3.5 7h7";
  const lower =
    alignment === "left"
      ? "M2 11h8.5"
      : alignment === "right"
        ? "M3.5 11h8.5"
        : "M2.75 11h8.5";
  return (
    <svg aria-hidden="true" height="14" viewBox="0 0 14 14" width="14">
      <path
        d={`M2 3h10 ${middle} ${lower}`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function dispatchCanvasTextAlignment(
  id: string,
  textAlign: CanvasTextAlignment,
): void {
  window.dispatchEvent(
    new CustomEvent("mozg:canvas-text-style", {
      detail: { id, patch: { textAlign } },
    }),
  );
}

export function TextAlignmentControls({
  id,
  value,
  onChange,
}: {
  id: string;
  value: CanvasTextAlignment;
  onChange?: (alignment: CanvasTextAlignment) => void;
}): React.JSX.Element {
  const labels: Record<CanvasTextAlignment, string> = {
    left: "Выровнять текст по левому краю",
    center: "Выровнять текст по центру",
    right: "Выровнять текст по правому краю",
  };
  return (
    <>
      {TEXT_ALIGNMENTS.map((alignment) => (
        <button
          aria-label={labels[alignment]}
          aria-pressed={value === alignment}
          className={styles.textToolbarButton}
          key={alignment}
          onClick={() => {
            if (onChange) onChange(alignment);
            else dispatchCanvasTextAlignment(id, alignment);
          }}
          title={labels[alignment]}
          type="button"
        >
          <TextAlignmentGlyph alignment={alignment} />
        </button>
      ))}
    </>
  );
}

type TextInnerStyle = CSSProperties & {
  fieldSizing?: "content";
};

type CenteredTextElementProps = {
  children?: ReactNode;
  style?: CSSProperties;
};

function withCenteredTextContent(
  children: ReactNode,
  textAlign: CanvasTextAlignment,
): ReactNode {
  if (!isValidElement<CenteredTextElementProps>(children)) return children;

  const content = children.props.children;
  let centeredContent = content;
  if (
    isValidElement<{ style?: CSSProperties }>(content) &&
    typeof content.type === "string" &&
    content.type === "textarea"
  ) {
    const style: TextInnerStyle = {
      ...content.props.style,
      width: "100%",
      height: "auto",
      maxHeight: "100%",
      alignSelf: "center",
      textAlign,
      fieldSizing: "content",
    };
    centeredContent = cloneElement(content, { style });
  }

  return cloneElement(
    children,
    {
      style: {
        ...children.props.style,
        display: "grid",
        alignItems: "center",
        textAlign,
      },
    },
    <div
      style={{
        width: "100%",
        maxHeight: "100%",
        textAlign,
      }}
    >
      {centeredContent}
    </div>,
  );
}

function BranchCollapseControl({
  nodeId,
  collapsed,
  directChildCount,
}: {
  nodeId: string;
  collapsed: boolean;
  directChildCount: number;
}): React.JSX.Element {
  const storeApi = useStoreApi();
  const topologySignature = useStore((state) =>
    state.edges.map((edge) => `${edge.source}>${edge.target}`).join("|"),
  );

  const applyProjection = (toggle: boolean): void => {
    const state = storeApi.getState();
    const projected = projectCanvasBranchCollapse(
      state.nodes,
      state.edges,
      toggle ? nodeId : undefined,
    );
    state.onNodesChange?.(
      projected.nodes.map((item) => ({
        id: item.id,
        type: "replace" as const,
        item,
      })),
    );
    state.onEdgesChange?.(
      projected.edges.map((item) => ({
        id: item.id,
        type: "replace" as const,
        item,
      })),
    );
  };

  useEffect(() => {
    if (!collapsed) return;
    applyProjection(false);
    // Re-project a collapsed branch when its edge topology changes so newly
    // connected descendants are hidden immediately as part of the branch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed, topologySignature]);

  const label = collapsed
    ? `Развернуть ${directChildCount} дочерних объектов`
    : `Свернуть ${directChildCount} дочерних объектов`;

  return (
    <button
      aria-expanded={!collapsed}
      aria-label={label}
      className="nodrag nopan nowheel"
      data-canvas-branch-control="true"
      onClick={(event) => {
        event.stopPropagation();
        applyProjection(true);
      }}
      onPointerDown={(event) => event.stopPropagation()}
      style={BRANCH_CONTROL_STYLE}
      title={label}
      type="button"
    >
      {collapsed ? `+${directChildCount}` : "−"}
    </button>
  );
}

export function CanvasNodeFrame({
  children,
  selected,
  minWidth,
  minHeight,
  keepAspectRatio = false,
  centerTextContent,
  className,
  toolbar,
  contextMenu,
  connectionHandleLayer,
}: CanvasNodeFrameProps): React.JSX.Element {
  const nodeId = useNodeId();
  const internalNode = useInternalNode(nodeId ?? "");
  const directChildCount = useStore((state) => {
    if (!nodeId) return 0;
    return new Set(
      state.edges
        .filter((edge) => edge.source === nodeId && edge.target !== nodeId)
        .map((edge) => edge.target),
    ).size;
  });
  const collapsed =
    canvasBranchRuntimeState(internalNode?.data)?.collapsed ?? false;
  const isTextFrame =
    centerTextContent ?? Boolean(className?.includes(styles.textNodeFrame));
  const textAlign =
    (
      internalNode?.data as {
        style?: { textAlign?: CanvasTextAlignment };
      }
    )?.style?.textAlign ?? "center";
  const renderedToolbar = toolbar;
  const renderedChildren = isTextFrame
    ? withCenteredTextContent(children, textAlign)
    : children;

  return (
    <div
      className={`${styles.nodeFrame} ${className ?? ""}`.trim()}
      data-canvas-node-frame="true"
      data-canvas-text-align={isTextFrame ? textAlign : undefined}
      data-selected={selected ? "true" : "false"}
      style={{ cursor: "default" }}
    >
      <SelectionLayer selected={selected} />
      <ResizeLayer
        selected={selected}
        keepAspectRatio={keepAspectRatio}
        minWidth={minWidth}
        minHeight={minHeight}
      />
      {connectionHandleLayer}
      {nodeId && directChildCount > 0 ? (
        <BranchCollapseControl
          collapsed={collapsed}
          directChildCount={directChildCount}
          nodeId={nodeId}
        />
      ) : null}
      {renderedToolbar ? (
        <NodeToolbarSlot selected={selected}>{renderedToolbar}</NodeToolbarSlot>
      ) : null}
      {contextMenu ? (
        <NodeContextMenuSlot>{contextMenu}</NodeContextMenuSlot>
      ) : null}
      <div className={styles.nodeBody}>{renderedChildren}</div>
    </div>
  );
}
