import type {
  PrototypeDocument,
  PrototypeTask,
} from "@/prototype/desktop-mock-data";
import {
  getDocumentBreadcrumb,
  getKnowledgePaneState,
  getTaskById,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
  type KnowledgeContextMode,
} from "@/prototype/desktop-state";
import { ContextPanelSection } from "@/prototype/desktop-ui";
import { getLinkedTaskIdsForDocument } from "@/prototype/state/selectors";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

export function LiveDocumentContextPanel({
  dispatch,
  fallbackDocument,
  state,
}: {
  dispatch: Dispatch;
  fallbackDocument: PrototypeDocument;
  state: DesktopPrototypeState;
}): React.JSX.Element {
  const document =
    state.activeSection === "knowledge"
      ? (getKnowledgePaneState(state).activeDocument ?? fallbackDocument)
      : fallbackDocument;
  const linkedTasks = getLinkedTaskIdsForDocument(state, document.id)
    .map((taskId) => getTaskById(state, taskId))
    .filter((task): task is PrototypeTask => Boolean(task));
  const outgoingLinks =
    document.content
      .join(" ")
      .match(/\[\[([^\]]+)\]\]/g)
      ?.map((link) => link.slice(2, -2)) ?? [];
  const modes: { id: KnowledgeContextMode; label: string }[] = [
    { id: "outline", label: "Структура" },
    { id: "backlinks", label: "Обратные" },
    { id: "outgoing", label: "Исходящие" },
    { id: "tasks", label: "Задачи" },
    { id: "history", label: "История" },
  ];

  return (
    <div className="panel-stack">
      <div
        aria-label="Режим контекста документа"
        className="context-mode-tabs"
        role="tablist"
      >
        {modes.map((mode) => (
          <button
            aria-selected={state.knowledgeContextMode === mode.id}
            className={state.knowledgeContextMode === mode.id ? "active" : ""}
            key={mode.id}
            onClick={() =>
              dispatch({ type: "set-knowledge-context-mode", mode: mode.id })
            }
            role="tab"
            type="button"
          >
            {mode.label}
          </button>
        ))}
      </div>

      {state.knowledgeContextMode === "outline" ? (
        <ContextPanelSection title="Структура">
          <p>{getDocumentBreadcrumb(document)}</p>
          <p>{document.excerpt}</p>
        </ContextPanelSection>
      ) : null}

      {state.knowledgeContextMode === "backlinks" ? (
        <ContextPanelSection title="Обратные ссылки">
          {document.backlinks.length > 0 ? (
            document.backlinks.map((backlink) => (
              <span className="document-pill" key={backlink}>
                {backlink}
              </span>
            ))
          ) : (
            <p>Обратных ссылок нет.</p>
          )}
        </ContextPanelSection>
      ) : null}

      {state.knowledgeContextMode === "outgoing" ? (
        <ContextPanelSection title="Исходящие ссылки">
          {outgoingLinks.length > 0 ? (
            outgoingLinks.map((link) => (
              <span className="document-pill" key={link}>
                {link}
              </span>
            ))
          ) : (
            <p>Исходящих ссылок нет.</p>
          )}
        </ContextPanelSection>
      ) : null}

      {state.knowledgeContextMode === "tasks" ? (
        <ContextPanelSection title="Связанные задачи">
          {linkedTasks.length > 0 ? (
            linkedTasks.map((task) => <p key={task.id}>{task.title}</p>)
          ) : (
            <p>Связанных задач нет.</p>
          )}
        </ContextPanelSection>
      ) : null}

      {state.knowledgeContextMode === "history" ? (
        <ContextPanelSection title="История">
          <p>Сегодня: документ открыт в структурном прототипе shell.</p>
          <p>Вчера: уточнены связи с соседними заметками и задачами.</p>
        </ContextPanelSection>
      ) : null}
    </div>
  );
}
