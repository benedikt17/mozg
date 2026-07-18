import React from "react";
import type { PrototypeInboxItem } from "@/prototype/desktop-mock-data";
import {
  getVisibleInboxItems,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

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
          <InboxItemCard dispatch={dispatch} item={item} key={item.id} />
        ))}
      </div>
    </div>
  );
}

function InboxItemCard({
  item,
  dispatch,
}: {
  item: PrototypeInboxItem;
  dispatch: Dispatch;
}): React.JSX.Element {
  return (
    <article className="inbox-item">
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
