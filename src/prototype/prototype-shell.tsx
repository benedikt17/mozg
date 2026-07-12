"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Bold,
  CalendarDays,
  CheckSquare2,
  Code2,
  FileImage,
  FileText,
  Folder,
  Inbox,
  Italic,
  Link2,
  List,
  Mic2,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Search,
  Settings2,
  Workflow,
  X,
} from "lucide-react";
import "@/prototype/prototype-shell.css";
import {
  inboxItems,
  initialNotes,
  initialProjects,
} from "@/prototype/mock-data";
import {
  initialPrototypeState,
  prototypeReducer,
  visibleSearchResults,
} from "@/prototype/prototype-state";

const navItems = [
  { id: "inbox", icon: Inbox, label: "Входящие", count: "4" },
  { id: "today", icon: CalendarDays, label: "Сегодня", count: "3" },
  { id: "search", icon: Search, label: "Поиск", count: "⌘K" },
  { id: "archive", icon: Archive, label: "Архив", count: "" },
] as const;

export function PrototypeShell() {
  const [state, dispatch] = useReducer(
    prototypeReducer,
    initialPrototypeState(initialNotes, initialProjects),
  );
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedResult, setSelectedResult] = useState(0);
  const [processed, setProcessed] = useState<string[]>([]);
  const [selectedInboxId, setSelectedInboxId] = useState("i1");

  const projects = state.projects.filter((project) => !project.archived);
  const activeProject =
    projects.find((project) => project.id === state.projectId) ?? projects[0];
  const activeNote = state.notes.find((note) => note.id === state.noteId);
  const projectNotes = state.notes.filter(
    (note) =>
      note.projectId === state.projectId &&
      !note.archived &&
      note.title.toLowerCase().includes(filter.toLowerCase()),
  );
  const searchResults = useMemo(() => {
    const query = search.toLowerCase();
    const notes = state.notes
      .filter(
        (note) =>
          !note.archived &&
          (!query ||
            `${note.title} ${note.body}`.toLowerCase().includes(query)),
      )
      .map((note) => ({
        id: note.id,
        type: "Заметка",
        title: note.title,
        subtitle:
          projects.find((project) => project.id === note.projectId)?.name ?? "",
      }));
    const matchingProjects = projects
      .filter((project) => !query || project.name.toLowerCase().includes(query))
      .map((project) => ({
        id: project.id,
        type: "Проект",
        title: project.name,
        subtitle: "Открыть проект",
      }));
    return [...notes, ...matchingProjects];
  }, [projects, search, state.notes]);
  const visibleResults = useMemo(
    () => visibleSearchResults(searchResults),
    [searchResults],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSelectedResult(0);
        dispatch({ type: "search", open: true });
      }
      if (!state.searchOpen) return;
      if (event.key === "Escape") dispatch({ type: "search", open: false });
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedResult((value) =>
          Math.min(value + 1, Math.max(visibleResults.length - 1, 0)),
        );
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedResult((value) => Math.max(value - 1, 0));
      }
      if (event.key === "Enter" && visibleResults[selectedResult]) {
        const result = visibleResults[selectedResult];
        if (result.type === "Заметка")
          dispatch({ type: "open-note", noteId: result.id });
        else dispatch({ type: "project", projectId: result.id });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visibleResults, selectedResult, state.searchOpen]);

  const createProject = () => {
    dispatch({ type: "create-project" });
  };

  return (
    <main className="prototype-shell">
      <div className="prototype-ribbon">
        PROTOTYPE · MOCK DATA · NO PERSISTENCE
      </div>
      <div
        className={`prototype-grid ${state.sidebarCollapsed ? "is-collapsed" : ""} mobile-${state.mobileView}`}
      >
        <aside className="prototype-sidebar">
          <header className="workspace-header">
            <div className="workspace-mark">L</div>
            {!state.sidebarCollapsed && (
              <div>
                <strong>Личная мастерская</strong>
                <span>Рабочее пространство</span>
              </div>
            )}
            <button
              aria-label="Свернуть боковую панель"
              onClick={() => dispatch({ type: "toggle-sidebar" })}
            >
              <PanelLeftClose size={17} />
            </button>
          </header>
          <nav aria-label="Главная навигация">
            {navItems.map((item) => (
              <button
                className={state.section === item.id ? "active" : ""}
                key={item.id}
                onClick={() => {
                  if (item.id === "search") {
                    setSelectedResult(0);
                    dispatch({ type: "search", open: true });
                  } else {
                    dispatch({ type: "section", section: item.id });
                  }
                }}
              >
                <item.icon className="nav-icon" size={17} strokeWidth={1.8} />
                {!state.sidebarCollapsed && (
                  <>
                    <span>{item.label}</span>
                    <small>{item.count}</small>
                  </>
                )}
              </button>
            ))}
          </nav>
          {!state.sidebarCollapsed && (
            <div className="projects-nav">
              <div className="section-label">
                <span>Проекты</span>
                <button aria-label="Создать проект" onClick={createProject}>
                  <Plus size={16} />
                </button>
              </div>
              {projects.map((project) => (
                <button
                  className={
                    state.section === "projects" &&
                    project.id === state.projectId
                      ? "active"
                      : ""
                  }
                  key={project.id}
                  onClick={() =>
                    dispatch({ type: "project", projectId: project.id })
                  }
                >
                  <i style={{ background: project.color }} />{" "}
                  <span>
                    {project.emoji} {project.name}
                  </span>
                </button>
              ))}
            </div>
          )}
          <footer className="user-control">
            <span>БН</span>
            {!state.sidebarCollapsed && (
              <div>
                <strong>Бенедикт</strong>
                <small>Настройки · Mock</small>
              </div>
            )}
            <button aria-label="Настройки">
              <Settings2 size={16} />
            </button>
          </footer>
        </aside>

        <section className="prototype-list-pane">
          <button
            className="mobile-back"
            onClick={() =>
              dispatch({ type: "mobile-view", view: "navigation" })
            }
          >
            <ArrowLeft size={17} /> Меню
          </button>
          {state.section === "projects" ? (
            <ProjectPane
              project={activeProject}
              notes={projectNotes}
              filter={filter}
              area={state.area}
              activeNoteId={state.noteId}
              onFilter={setFilter}
              onArea={(area) => dispatch({ type: "area", area })}
              onCreate={() => dispatch({ type: "create-note" })}
              onOpen={(noteId) => dispatch({ type: "open-note", noteId })}
            />
          ) : (
            <GlobalSection
              section={state.section}
              notes={state.notes}
              processed={processed}
              selectedInboxId={selectedInboxId}
              onSelectInbox={setSelectedInboxId}
              onOpenNote={(noteId) => dispatch({ type: "open-note", noteId })}
              onRestore={(noteId) => dispatch({ type: "restore-note", noteId })}
              projects={state.projects}
              onRestoreProject={(projectId) =>
                dispatch({ type: "restore-project", projectId })
              }
            />
          )}
        </section>

        <section className="prototype-main-pane">
          <button
            className="mobile-back"
            onClick={() => dispatch({ type: "mobile-view", view: "list" })}
          >
            <ArrowLeft size={17} /> К списку
          </button>
          {state.section === "projects" &&
          state.area === "notes" &&
          activeNote ? (
            <EditorMock
              note={activeNote}
              projectName={activeProject.name}
              onTitle={(value) =>
                dispatch({ type: "edit-note", field: "title", value })
              }
              onBody={(value) =>
                dispatch({ type: "edit-note", field: "body", value })
              }
              onArchive={() =>
                dispatch({ type: "archive-note", noteId: activeNote.id })
              }
            />
          ) : state.section === "projects" && state.area === "tasks" ? (
            <TasksMock projectName={activeProject.name} />
          ) : state.section === "projects" && state.area === "canvas" ? (
            <CanvasMock projectName={activeProject.name} />
          ) : state.section === "inbox" ? (
            <InboxDetail
              item={inboxItems.find((item) => item.id === selectedInboxId)}
              onProcessed={(id) => setProcessed((items) => [...items, id])}
              onAssign={() =>
                dispatch({ type: "project", projectId: "lukomorye" })
              }
            />
          ) : (
            <SectionDetail section={state.section} />
          )}
        </section>
      </div>
      {state.searchOpen && (
        <CommandPalette
          query={search}
          results={visibleResults}
          selected={selectedResult}
          onQuery={(value) => {
            setSearch(value);
            setSelectedResult(0);
          }}
          onClose={() => dispatch({ type: "search", open: false })}
          onSelect={(result) =>
            result.type === "Заметка"
              ? dispatch({ type: "open-note", noteId: result.id })
              : dispatch({ type: "project", projectId: result.id })
          }
        />
      )}
    </main>
  );
}

type ProjectPaneProps = {
  project: (typeof initialProjects)[number];
  notes: typeof initialNotes;
  filter: string;
  area: "notes" | "tasks" | "canvas";
  activeNoteId: string;
  onFilter: (value: string) => void;
  onArea: (area: "notes" | "tasks" | "canvas") => void;
  onCreate: () => void;
  onOpen: (id: string) => void;
};
function ProjectPane({
  project,
  notes,
  filter,
  area,
  activeNoteId,
  onFilter,
  onArea,
  onCreate,
  onOpen,
}: ProjectPaneProps) {
  return (
    <>
      <header className="pane-header">
        <div>
          <span className="eyebrow">{project.emoji} Проект</span>
          <h1>{project.name}</h1>
        </div>
        <button className="quiet-button" aria-label="Действия проекта">
          <MoreHorizontal size={18} />
        </button>
      </header>
      <div className="area-tabs">
        {(["notes", "tasks", "canvas"] as const).map((id) => (
          <button
            className={area === id ? "active" : ""}
            key={id}
            onClick={() => onArea(id)}
          >
            {id === "notes" ? "Заметки" : id === "tasks" ? "Задачи" : "Холст"}
          </button>
        ))}
      </div>
      {area === "notes" && (
        <>
          <button className="new-note" onClick={onCreate}>
            <Plus size={17} /> Новая заметка
          </button>
          <label className="note-filter">
            <Search size={15} />
            <input
              aria-label="Фильтр заметок"
              value={filter}
              onChange={(event) => onFilter(event.target.value)}
              placeholder="Фильтр заметок"
            />
          </label>
          <div className="note-list">
            {notes.length ? (
              notes.map((note) => (
                <button
                  className={activeNoteId === note.id ? "active" : ""}
                  key={note.id}
                  onClick={() => onOpen(note.id)}
                >
                  <strong>{note.title}</strong>
                  <span>{note.body.replaceAll("#", "").slice(0, 70)}</span>
                  <small>{note.edited}</small>
                </button>
              ))
            ) : (
              <div className="empty-state">
                <b>Здесь пока тихо</b>
                <span>Создайте первую заметку одним кликом.</span>
                <button onClick={onCreate}>＋ Новая заметка</button>
              </div>
            )}
          </div>
        </>
      )}
      {area !== "notes" && (
        <div className="area-hint">Откройте рабочую область справа →</div>
      )}
    </>
  );
}

function EditorMock({
  note,
  projectName,
  onTitle,
  onBody,
  onArchive,
}: {
  note: (typeof initialNotes)[number];
  projectName: string;
  onTitle: (value: string) => void;
  onBody: (value: string) => void;
  onArchive: () => void;
}) {
  return (
    <div className="editor">
      <header className="editor-top">
        <div>
          <span>{projectName}</span>
          <b>/</b>
          <span>{note.title}</span>
        </div>
        <div>
          <span className="saved">
            <CheckSquare2 size={14} /> Сохранено локально
          </span>
          <button title="Архивировать" onClick={onArchive}>
            Архивировать
          </button>
          <button aria-label="Дополнительные действия">
            <MoreHorizontal size={17} />
          </button>
        </div>
      </header>
      <div className="toolbar" aria-label="Панель форматирования">
        <button title="Заголовок">
          <span className="type-icon">H1</span>
        </button>
        <button title="Жирный">
          <Bold size={16} />
        </button>
        <button title="Курсив">
          <Italic size={16} />
        </button>
        <button title="Список">
          <List size={16} />
        </button>
        <button title="Задача">
          <CheckSquare2 size={16} />
        </button>
        <button title="Код">
          <Code2 size={16} />
        </button>
        <button title="Ссылка">
          <Link2 size={16} />
        </button>
        <button title="Wiki-ссылка">
          <span className="type-icon">[[]]</span>
        </button>
      </div>
      <article className="editor-paper">
        <input
          aria-label="Заголовок заметки"
          value={note.title}
          onChange={(event) => onTitle(event.target.value)}
        />
        <div className="note-meta">
          Изменено {note.edited} · 128 слов · Markdown mock
        </div>
        <textarea
          aria-label="Текст заметки"
          value={note.body}
          onChange={(event) => onBody(event.target.value)}
          spellCheck={false}
        />
        <div className="wiki-preview">
          Связи: <span>[[Исследование редактора]]</span>
        </div>
      </article>
    </div>
  );
}

function TasksMock({ projectName }: { projectName: string }) {
  const groups = [
    {
      title: "Сегодня",
      tasks: [
        "Согласовать мобильную навигацию",
        "Проверить Inbox master-detail",
      ],
    },
    {
      title: "Предстоящие",
      tasks: ["Обсудить ширину редактора", "Проверить планшетный breakpoint"],
    },
    { title: "Завершённые", tasks: ["Собрать первый кликабельный сценарий"] },
  ];
  return (
    <div className="mock-area">
      <header className="workspace-title">
        <div>
          <span className="eyebrow">{projectName}</span>
          <h2>Задачи</h2>
          <p>Рабочий фокус проекта без отрыва от заметок.</p>
        </div>
        <button className="primary-action">
          <Plus size={16} /> Добавить задачу
        </button>
      </header>
      {groups.map((group, groupIndex) => (
        <section className="task-group" key={group.title}>
          <h3>
            {group.title}
            <span>{group.tasks.length}</span>
          </h3>
          {group.tasks.map((task, index) => (
            <label className="mock-task" key={task}>
              <input type="checkbox" defaultChecked={groupIndex === 2} />
              <span>{task}</span>
              <small>
                {groupIndex === 0
                  ? index === 0
                    ? "Высокий"
                    : "Сегодня"
                  : groupIndex === 1
                    ? "На неделе"
                    : "Готово"}
              </small>
            </label>
          ))}
        </section>
      ))}
    </div>
  );
}
function CanvasMock({ projectName }: { projectName: string }) {
  return (
    <div className="canvas-mock">
      <header>
        <div>
          <span className="eyebrow">{projectName}</span>
          <h2>Холст идей</h2>
        </div>
        <div className="canvas-tools">
          <button>
            <Plus size={16} />
          </button>
          <button>
            <Workflow size={16} />
          </button>
          <span>82%</span>
        </div>
      </header>
      <div className="canvas-board">
        <div className="canvas-node one">
          Навигация
          <br />
          <small>Что всегда видно?</small>
        </div>
        <div className="canvas-node two">
          Проекты
          <br />
          <small>Заметки · Задачи · Холст</small>
        </div>
        <div className="canvas-node three">
          Редактор
          <br />
          <small>Спокойный и широкий</small>
        </div>
        <svg aria-hidden="true">
          <line x1="24%" y1="35%" x2="50%" y2="55%" />
          <line x1="53%" y1="55%" x2="77%" y2="30%" />
        </svg>
      </div>
    </div>
  );
}

function inboxIcon(kind: string, size: number) {
  if (kind === "Голос") return <Mic2 size={size} />;
  if (kind === "Изображение") return <FileImage size={size} />;
  if (kind === "Ссылка") return <Link2 size={size} />;
  return <FileText size={size} />;
}

function InboxDetail({
  item,
  onProcessed,
  onAssign,
}: {
  item: (typeof inboxItems)[number] | undefined;
  onProcessed: (id: string) => void;
  onAssign: () => void;
}) {
  if (!item) {
    return (
      <div className="detail-empty">
        <CheckSquare2 size={30} />
        <h2>Входящие разобраны</h2>
        <p>Новые быстрые захваты появятся здесь.</p>
      </div>
    );
  }
  return (
    <div className="inbox-detail">
      <header className="detail-header">
        <span className="detail-type">
          {inboxIcon(item.kind, 16)} {item.kind}
        </span>
        <button aria-label="Дополнительные действия">
          <MoreHorizontal size={18} />
        </button>
      </header>
      <article>
        <div className="capture-icon">{inboxIcon(item.kind, 24)}</div>
        <p className="detail-kicker">Захвачено сегодня, 10:42</p>
        <h2>{item.title}</h2>
        <p className="capture-copy">
          {item.kind === "Голос"
            ? "Нужно проверить, насколько быстро голосовая мысль превращается в понятный следующий шаг. Длительность записи — 1:24."
            : item.kind === "Изображение"
              ? "Фотография доски после планирования. Сохранить контекст и связать с проектом до конца дня."
              : item.kind === "Ссылка"
                ? "Материал о системах навигации для инструментов, в которых пользователь проводит весь рабочий день."
                : "Связать ежедневную заметку с Today и показывать незавершённые пункты без ощущения отдельного таск-менеджера."}
        </p>
        <div className="capture-meta">
          <span>Источник · Быстрый захват</span>
          <span>Без проекта</span>
        </div>
        <div className="detail-actions">
          <button className="primary-action" onClick={onAssign}>
            <Folder size={16} /> Назначить в проект
          </button>
          <button>
            <FileText size={16} /> Превратить в заметку
          </button>
          <button onClick={() => onProcessed(item.id)}>
            <CheckSquare2 size={16} /> Обработано
          </button>
        </div>
      </article>
    </div>
  );
}

function GlobalSection({
  section,
  notes,
  projects,
  processed,
  selectedInboxId,
  onSelectInbox,
  onOpenNote,
  onRestore,
  onRestoreProject,
}: {
  section: "inbox" | "today" | "archive";
  notes: typeof initialNotes;
  projects: typeof initialProjects;
  processed: string[];
  selectedInboxId: string;
  onSelectInbox: (id: string) => void;
  onOpenNote: (id: string) => void;
  onRestore: (id: string) => void;
  onRestoreProject: (id: string) => void;
}) {
  if (section === "inbox")
    return (
      <>
        <header className="pane-header">
          <div>
            <span className="eyebrow">Быстрый захват</span>
            <h1>Входящие</h1>
          </div>
          <b className="count-badge">{inboxItems.length - processed.length}</b>
        </header>
        <div className="inbox-list">
          {inboxItems
            .filter((item) => !processed.includes(item.id))
            .map((item) => {
              return (
                <button
                  className={`inbox-row ${selectedInboxId === item.id ? "active" : ""}`}
                  key={item.id}
                  onClick={() => onSelectInbox(item.id)}
                >
                  <span className="inbox-kind">{inboxIcon(item.kind, 17)}</span>
                  <span>
                    <small>{item.kind}</small>
                    <strong>{item.title}</strong>
                  </span>
                </button>
              );
            })}
        </div>
      </>
    );
  if (section === "today")
    return (
      <>
        <header className="pane-header">
          <div>
            <span className="eyebrow">Четверг · 11 июля</span>
            <h1>Сегодня</h1>
          </div>
        </header>
        <div className="today-block">
          <button onClick={() => onOpenNote("roadmap")}>
            <b>Ежедневная заметка</b>
            <span>Фокус, события и быстрые мысли дня</span>
          </button>
          <h3>Требуют внимания</h3>
          {[
            "Согласовать прототип",
            "Ответить по структуре проектов",
            "Разобрать 4 входящих",
          ].map((item) => (
            <label key={item}>
              <input type="checkbox" />
              {item}
            </label>
          ))}
        </div>
      </>
    );
  const archived = notes.filter((note) => note.archived);
  return (
    <>
      <header className="pane-header">
        <div>
          <span className="eyebrow">Можно восстановить</span>
          <h1>Архив</h1>
        </div>
      </header>
      <div className="archive-list">
        <h3>Заметки</h3>
        {archived.length ? (
          archived.map((note) => (
            <article key={note.id}>
              <div>
                <strong>{note.title}</strong>
                <span>{note.edited}</span>
              </div>
              <button onClick={() => onRestore(note.id)}>Восстановить</button>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <b>Архив пуст</b>
            <span>Архивированные заметки появятся здесь.</span>
          </div>
        )}
        <h3>Проекты</h3>
        {projects
          .filter((project) => project.archived)
          .map((project) => (
            <article key={project.id}>
              <div>
                <strong>{project.name}</strong>
                <span>Архивирован 18 мая</span>
              </div>
              <button onClick={() => onRestoreProject(project.id)}>
                Восстановить
              </button>
            </article>
          ))}
      </div>
    </>
  );
}

function SectionDetail({
  section,
}: {
  section: "inbox" | "today" | "archive" | "projects";
}) {
  if (section === "today")
    return (
      <div className="today-workspace">
        <header>
          <span className="eyebrow">Четверг, 11 июля</span>
          <h2>Доброе утро</h2>
          <p>Три главных действия и контекст дня — в одном месте.</p>
        </header>
        <section className="daily-note">
          <div>
            <CalendarDays size={18} />
            <span>Ежедневная заметка</span>
          </div>
          <h3>Что сделает сегодняшний день удачным?</h3>
          <p>
            Согласовать направление интерфейса и оставить пространство для
            глубокой работы.
          </p>
        </section>
        <div className="today-columns">
          <section>
            <h3>
              В фокусе <span>3</span>
            </h3>
            {[
              "Согласовать прототип",
              "Ответить по структуре проектов",
              "Разобрать входящие",
            ].map((task) => (
              <label key={task}>
                <input type="checkbox" />
                <span>{task}</span>
              </label>
            ))}
          </section>
          <section>
            <h3>Недавние заметки</h3>
            <button>
              <FileText size={16} />
              <span>
                Исследование редактора<small>Лукоморье · вчера</small>
              </span>
            </button>
            <button>
              <FileText size={16} />
              <span>
                Сценарий первого запуска<small>Продукт · сегодня</small>
              </span>
            </button>
          </section>
        </div>
      </div>
    );
  if (section === "archive")
    return (
      <div className="archive-detail">
        <Archive size={28} />
        <span className="eyebrow">Безопасное хранение</span>
        <h2>Ничего не удаляется навсегда</h2>
        <p>
          Архив сохраняет контекст работы и позволяет вернуть заметку или проект
          в один клик.
        </p>
        <div>
          <span>1</span>
          <small>заметка</small>
          <span>1</span>
          <small>проект</small>
        </div>
      </div>
    );
  return (
    <div className="detail-empty">
      <FileText size={30} />
      <h2>Выберите заметку</h2>
      <p>Откройте заметку из списка или создайте новую одним кликом.</p>
    </div>
  );
}

type SearchResult = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
};
function CommandPalette({
  query,
  results,
  selected,
  onQuery,
  onClose,
  onSelect,
}: {
  query: string;
  results: SearchResult[];
  selected: number;
  onQuery: (value: string) => void;
  onClose: () => void;
  onSelect: (result: SearchResult) => void;
}) {
  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Глобальный поиск"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <label>
          <Search size={20} />
          <input
            autoFocus
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Найти заметку или проект…"
          />
          <button
            className="palette-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={17} />
          </button>
        </label>
        <div>
          {results.length ? (
            results.map((result, index) => (
              <button
                className={selected === index ? "active" : ""}
                key={`${result.type}-${result.id}`}
                onClick={() => onSelect(result)}
              >
                <i>
                  {result.type === "Заметка" ? (
                    <FileText size={17} />
                  ) : (
                    <Folder size={17} />
                  )}
                </i>
                <span>
                  <strong>{result.title}</strong>
                  <small>
                    {result.type} · {result.subtitle}
                  </small>
                </span>
                <kbd>↵</kbd>
              </button>
            ))
          ) : (
            <div className="search-empty">
              <b>Ничего не найдено</b>
              <span>Попробуйте другое название или слово из заметки.</span>
            </div>
          )}
        </div>
        <footer>
          <span>↑↓ выбрать</span>
          <span>Enter открыть</span>
          <span>Только mock data</span>
        </footer>
      </section>
    </div>
  );
}
