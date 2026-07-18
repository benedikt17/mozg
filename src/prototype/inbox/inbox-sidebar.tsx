import React from "react";
import { inboxFilters } from "@/prototype/desktop-mock-data";
import {
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { ToolSidebarItem } from "@/prototype/desktop-ui";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

export function InboxSidebar({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  return (
    <aside className="tool-sidebar" aria-label="Фильтры входящих">
      <header>
        <span>Входящие</span>
        <strong>Источники</strong>
      </header>
      <nav className="vertical-menu compact">
        {inboxFilters.map((filter) => (
          <ToolSidebarItem
            active={state.inboxFilter === filter.id}
            key={filter.id}
            onClick={() =>
              dispatch({ type: "set-inbox-filter", filter: filter.id })
            }
          >
            {filter.label}
          </ToolSidebarItem>
        ))}
      </nav>
    </aside>
  );
}
