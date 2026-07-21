import React, { useState } from "react";
import { PrototypeButton } from "@/prototype/desktop-ui";
import type {
  DesktopPrototypeAction,
  DesktopPrototypeState,
} from "@/prototype/desktop-state";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

export function getProjectInitials(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word.match(/\p{L}/u)?.[0] ?? "")
    .join("")
    .toLocaleUpperCase();
}

export function SectionRail({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const [isPointerInside, setIsPointerInside] = useState(false);
  const [hasKeyboardFocus, setHasKeyboardFocus] = useState(false);
  const [inputModality, setInputModality] = useState<"pointer" | "keyboard">(
    "pointer",
  );
  const isExpanded =
    isPointerInside || (hasKeyboardFocus && inputModality === "keyboard");

  return (
    <aside
      aria-label="mozg"
      className="project-rail"
      data-expanded={isExpanded ? "true" : "false"}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (
          !(nextTarget instanceof Node) ||
          !event.currentTarget.contains(nextTarget)
        ) {
          setHasKeyboardFocus(false);
        }
      }}
      onFocusCapture={(event) => {
        if (
          event.target instanceof HTMLElement &&
          event.target.matches(":focus-visible")
        ) {
          setInputModality("keyboard");
          setHasKeyboardFocus(true);
        }
      }}
      onPointerDownCapture={() => setInputModality("pointer")}
      onPointerEnter={() => {
        setInputModality("pointer");
        setIsPointerInside(true);
      }}
      onPointerLeave={() => setIsPointerInside(false)}
    >
      <div className="rail-brand">
        <div className="rail-brand-identity">
          <span className="rail-brand-mark">M</span>
        </div>
      </div>
      <nav className="rail-project-list" aria-label="Проекты">
        {state.projects.map((project) => (
          <PrototypeButton
            active={project.id === state.activeProjectId}
            aria-current={
              project.id === state.activeProjectId ? "true" : undefined
            }
            aria-label={project.name}
            className="rail-project-item"
            key={project.id}
            onClick={() =>
              dispatch({ type: "switch-project", projectId: project.id })
            }
            title={project.name}
            variant="ghost"
          >
            <span className="rail-project-initials" aria-hidden="true">
              {getProjectInitials(project.name)}
            </span>
            <span className="rail-project-name">{project.name}</span>
          </PrototypeButton>
        ))}
      </nav>
      <div className="rail-create-project-region">
        <PrototypeButton
          aria-label="Создать проект"
          className="rail-create-project"
          onClick={() => dispatch({ type: "create-project" })}
          title="Создать проект"
          variant="ghost"
        >
          <span className="rail-create-project-icon" aria-hidden="true">
            +
          </span>
          <span className="rail-project-name">Создать проект</span>
        </PrototypeButton>
      </div>
    </aside>
  );
}
