"use client";

import { Handle, NodeResizer, NodeToolbar, Position } from "@xyflow/react";
import type { CSSProperties, ReactNode } from "react";
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
  return (
    <div
      className={`${styles.nodeFrame} ${className ?? ""}`.trim()}
      data-canvas-node-frame="true"
      data-selected={selected ? "true" : "false"}
    >
      <SelectionLayer selected={selected} />
      <ResizeLayer
        selected={selected}
        keepAspectRatio={keepAspectRatio}
        minWidth={minWidth}
        minHeight={minHeight}
      />
      {connectionHandleLayer}
      {toolbar ? <NodeToolbarSlot>{toolbar}</NodeToolbarSlot> : null}
      {contextMenu ? (
        <NodeContextMenuSlot>{contextMenu}</NodeContextMenuSlot>
      ) : null}
      <div className={styles.nodeBody}>{children}</div>
    </div>
  );
}
