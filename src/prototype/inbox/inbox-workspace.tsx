import React from "react";
import type { PrototypeInboxItem } from "@/prototype/desktop-mock-data";
import {
  getVisibleInboxItems,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;
const inboxDragMimeType = "application/x-mozg-inbox-id";

export function InboxWorkspace({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const items = getVisibleInboxItems(state);
  return (
    <div className="inbox-workspace">
      <div className="inbox-grid">
        {items.map((item) => (
          <InboxItemCard
            dispatch={dispatch}
            isSelected={item.id === state.selectedInboxItemId}
            item={item}
            key={item.id}
          />
        ))}
      </div>
    </div>
  );
}

function InboxItemCard({
  item,
  dispatch,
  isSelected,
}: {
  item: PrototypeInboxItem;
  dispatch: Dispatch;
  isSelected: boolean;
}): React.JSX.Element {
  return (
    <article
      className={isSelected ? "inbox-item is-selected" : "inbox-item"}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        const itemId =
          event.dataTransfer.getData(inboxDragMimeType) ||
          event.dataTransfer.getData("text/plain");
        if (itemId && itemId !== item.id) {
          dispatch({
            type: "move-inbox-item",
            itemId,
            targetItemId: item.id,
            targetFilter: item.kind,
          });
        }
      }}
    >
      <button
        aria-label={`Перетащить захват ${item.title}`}
        className="inbox-item-drag-handle"
        draggable
        onClick={(event) => event.stopPropagation()}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData(inboxDragMimeType, item.id);
          event.dataTransfer.setData("text/plain", item.id);
        }}
        type="button"
      >
        ⠿
      </button>
      <button
        onClick={() => dispatch({ type: "select-inbox-item", itemId: item.id })}
        type="button"
      >
        <span>{item.source}</span>
        <strong>{item.title}</strong>
        <p>{item.preview}</p>
        <small>{item.capturedAt}</small>
      </button>
    </article>
  );
}
