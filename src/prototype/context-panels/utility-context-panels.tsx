import React from "react";
import type { PrototypeInboxItem } from "@/prototype/desktop-mock-data";
import { ContextPanelSection } from "@/prototype/desktop-ui";

export function InboxContextPanel({
  item,
}: {
  item: PrototypeInboxItem;
}): React.JSX.Element {
  return (
    <div className="panel-stack">
      <ContextPanelSection title={item.title}>
        <p>{item.preview}</p>
      </ContextPanelSection>
      <ContextPanelSection title="Источник">
        <p>
          {item.source} · {item.capturedAt}
        </p>
      </ContextPanelSection>
    </div>
  );
}

export function AiPanel(): React.JSX.Element {
  return <div className="panel-stack" aria-hidden="true" />;
}
