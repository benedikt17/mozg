"use client";

import {
  Handle,
  NodeResizer,
  NodeToolbar,
  Position,
  useStore,
} from "@xyflow/react";
import { type CSSProperties, type ReactNode } from "react";
import type { CanvasTextAlignment } from "@/lib/canvas/canvas-text-style";
import {
  CANVAS_CONNECTION_HANDLE_CENTER_OFFSET,
  CANVAS_CONNECTION_HANDLE_DIAMETER,
  CANVAS_CONNECTION_HANDLE_GAP,
  CANVAS_CONNECTION_HANDLE_RADIUS,
} from "@/lib/canvas/canvas-edge-geometry";
import styles from "./infinite-canvas-local-shell.module.css";

export type CanvasNodeFrameProps = {
  children: ReactNode;
  selected: boolean;
  minWidth: number;
  minHeight: number;
  keepAspectRatio?: boolean;
  className?: string;
  toolbar?: ReactNode;
  contextMenu?: ReactNode;
  /** Shared interaction layer for persistent Canvas connections. */
  connectionHandleLayer?: ReactNode;
};

function useIndividualSelectionVisible(selected: boolean): boolean {
  const selectedNodeCount = useStore((state) =>
    state.nodes.reduce((count, node) => count + (node.selected ? 1 : 0), 0),
  );
  return selected && selectedNodeCount === 1;
}

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

export function ConnectionHandleLayer({
  selected,
}: {
  selected: boolean;
}): React.JSX.Element {
  const visible = useIndividualSelectionVisible(selected);
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
          data-visible={visible ? "true" : "false"}
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
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <NodeToolbar
      className={styles.nodeToolbarSlot}
      data-slot="toolbar"
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
}: {
  id: string;
  value: CanvasTextAlignment;
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
          onClick={() => dispatchCanvasTextAlignment(id, alignment)}
          title={labels[alignment]}
          type="button"
        >
          <TextAlignmentGlyph alignment={alignment} />
        </button>
      ))}
    </>
  );
}

export function CanvasNodeFrame({
  children,
  selected,
  minWidth,
  minHeight,
  keepAspectRatio = false,
  className,
  toolbar,
  contextMenu,
  connectionHandleLayer,
}: CanvasNodeFrameProps): React.JSX.Element {
  const renderedToolbar = toolbar;
  const individualSelectionVisible = useIndividualSelectionVisible(selected);

  return (
    <div
      className={`${styles.nodeFrame} ${className ?? ""}`.trim()}
      data-canvas-node-frame="true"
      data-selected={selected ? "true" : "false"}
      style={{ cursor: "default" }}
    >
      <SelectionLayer selected={individualSelectionVisible} />
      <ResizeLayer
        selected={individualSelectionVisible}
        keepAspectRatio={keepAspectRatio}
        minWidth={minWidth}
        minHeight={minHeight}
      />
      {connectionHandleLayer}
      {renderedToolbar ? (
        <NodeToolbarSlot>{renderedToolbar}</NodeToolbarSlot>
      ) : null}
      {contextMenu ? (
        <NodeContextMenuSlot>{contextMenu}</NodeContextMenuSlot>
      ) : null}
      <div className={styles.nodeBody}>{children}</div>
    </div>
  );
}
