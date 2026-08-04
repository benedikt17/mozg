import React from "react";
import { inboxFilters } from "@/prototype/desktop-mock-data";
import {
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { getProjectInboxItems } from "@/prototype/state/inbox-state";
import { ToolSidebarItem } from "@/prototype/desktop-ui";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

export function InboxSidebar({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const projectItems = getProjectInboxItems(state);
  const getFilterCount = (
    filterId: (typeof inboxFilters)[number]["id"],
  ): number =>
    projectItems.filter((item) => filterId === "all" || item.kind === filterId)
      .length;

  return (
    <aside
      aria-label="Фильтры входящих"
      className="tool-sidebar tasks-sidebar inbox-sidebar"
    >
      <div className="task-sidebar-header">
        <label className="task-sidebar-search">
          <input
            aria-label="Поиск входящих"
            onChange={(event) =>
              dispatch({
                type: "set-inbox-search-query",
                query: event.target.value,
              })
            }
            placeholder="Поиск входящих"
            type="search"
            value={state.inboxSearchQuery}
          />
        </label>
      </div>
      <div className="tasks-sidebar-scroll">
        <nav
          aria-label="Системные представления"
          className="vertical-menu task-sidebar-group"
        >
          <ToolSidebarItem
            active={state.inboxFilter === "all"}
            onClick={() =>
              dispatch({ type: "set-inbox-filter", filter: "all" })
            }
          >
            <span className="task-system-view-row">
              <span>Все</span>
              <span>{getFilterCount("all")}</span>
            </span>
          </ToolSidebarItem>
        </nav>
        <div className="task-sidebar-separator" />
        <section className="task-group task-group-baza" aria-label="Источники">
          <div className="task-group-heading-static">
            <span aria-hidden="true" className="task-group-disclosure-spacer" />
            <span>Источники</span>
          </div>
          <div className="task-group-content">
            <div className="task-custom-list-items">
              {inboxFilters
                .filter((filter) => filter.id !== "all")
                .map((filter) => (
                  <button
                    aria-current={
                      state.inboxFilter === filter.id ? "page" : undefined
                    }
                    className={[
                      "task-custom-list-select",
                      state.inboxFilter === filter.id && "is-active",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={filter.id}
                    onClick={() =>
                      dispatch({ type: "set-inbox-filter", filter: filter.id })
                    }
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const itemId =
                        event.dataTransfer.getData(
                          "application/x-mozg-inbox-id",
                        ) || event.dataTransfer.getData("text/plain");
                      if (itemId) {
                        dispatch({
                          type: "move-inbox-item",
                          itemId,
                          targetItemId: null,
                          targetFilter: filter.id,
                        });
                      }
                    }}
                    type="button"
                  >
                    <span>{filter.label}</span>
                    <span className="task-list-row-count">
                      {getFilterCount(filter.id)}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}
