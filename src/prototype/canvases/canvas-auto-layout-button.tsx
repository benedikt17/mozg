"use client";

import { useStoreApi } from "@xyflow/react";
import { autoLayoutCanvasNodes } from "@/lib/canvas/canvas-auto-layout";
import { UiIcon } from "@/prototype/desktop-icons";
import { IconButton } from "@/prototype/desktop-ui";

export function CanvasAutoLayoutButton({
  disabled,
}: {
  disabled: boolean;
}): React.JSX.Element {
  const storeApi = useStoreApi();

  return (
    <IconButton
      disabled={disabled}
      icon={<UiIcon name="sort" />}
      label="Автоупорядочить холст"
      onClick={() => {
        const state = storeApi.getState();
        const positions = autoLayoutCanvasNodes(state.nodes, state.edges);
        if (positions.size === 0) return;
        state.onNodesChange?.(
          [...positions].map(([id, position]) => ({
            id,
            type: "position" as const,
            position,
            dragging: false,
          })),
        );
      }}
      title="Автоупорядочить холст"
      type="button"
      variant="quiet"
    />
  );
}
