"use client";

import { NodeResizer } from "@xyflow/react";
import type { ReactNode } from "react";
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
  /** Reserved contract for future edge connection affordances. */
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

function ConnectionHandleLayer({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div className={styles.connectionHandleLayer} data-slot="connections">
      {children}
    </div>
  );
}

function NodeToolbarSlot({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div className={styles.nodeToolbarSlot} data-slot="toolbar">
      {children}
    </div>
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
      {connectionHandleLayer ? (
        <ConnectionHandleLayer>{connectionHandleLayer}</ConnectionHandleLayer>
      ) : null}
      {toolbar ? <NodeToolbarSlot>{toolbar}</NodeToolbarSlot> : null}
      {contextMenu ? (
        <NodeContextMenuSlot>{contextMenu}</NodeContextMenuSlot>
      ) : null}
      <div className={styles.nodeBody}>{children}</div>
    </div>
  );
}
