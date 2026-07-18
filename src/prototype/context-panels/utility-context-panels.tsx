import React from "react";
import {
  aiProposals,
  type PrototypeInboxItem,
} from "@/prototype/desktop-mock-data";
import {
  getAiContextLabel,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { ContextPanelSection, PrototypeButton } from "@/prototype/desktop-ui";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

export function CanvasInspectorPanel({
  objectTitle,
  objectBody,
}: {
  objectTitle: string;
  objectBody: string;
}): React.JSX.Element {
  return (
    <div className="panel-stack">
      <ContextPanelSection title={objectTitle}>
        <p>{objectBody}</p>
      </ContextPanelSection>
      <ContextPanelSection title="Свойства">
        <p>Тип, позиция и связи показаны как mock-инспектор.</p>
      </ContextPanelSection>
    </div>
  );
}

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

export function AiPanel({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  return (
    <div className="panel-stack">
      <ContextPanelSection title="Текущий контекст">
        <p>{getAiContextLabel(state)}</p>
      </ContextPanelSection>
      <ContextPanelSection title="Предложения">
        {aiProposals.map((proposal) => (
          <label className="proposal-row" key={proposal.id}>
            <input
              checked={state.selectedAiProposalIds.includes(proposal.id)}
              onChange={() =>
                dispatch({
                  type: "toggle-ai-proposal",
                  proposalId: proposal.id,
                })
              }
              type="checkbox"
            />
            <span>
              <strong>{proposal.title}</strong>
              <small>{proposal.description}</small>
            </span>
          </label>
        ))}
      </ContextPanelSection>
      <PrototypeButton
        disabled={state.selectedAiProposalIds.length === 0}
        onClick={() => dispatch({ type: "confirm-ai-proposals" })}
        variant="primary"
      >
        Применить выбранное
      </PrototypeButton>
      {state.aiActivityLog.length > 0 ? (
        <ContextPanelSection title="Журнал">
          {state.aiActivityLog.map((entry) => (
            <p key={entry}>{entry}</p>
          ))}
        </ContextPanelSection>
      ) : null}
    </div>
  );
}
