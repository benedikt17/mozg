import React, { useEffect, useRef, useState } from "react";
import { PrototypeButton } from "@/prototype/desktop-ui";
import {
  getActiveProject,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { UiIcon } from "@/prototype/desktop-icons";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

export function ProjectSelector({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const activeProject = getActiveProject(state);
  const [open, setOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (
        event.target instanceof Node &&
        selectorRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="project-selector" ref={selectorRef}>
      <PrototypeButton
        aria-expanded={open}
        aria-haspopup="menu"
        className="project-selector-trigger"
        onClick={() => setOpen((value) => !value)}
        title={activeProject.name}
        variant="ghost"
      >
        <strong>{activeProject.name}</strong>
        <UiIcon name="chevron-down" />
      </PrototypeButton>
      {open ? (
        <div className="project-selector-menu" role="menu">
          {state.projects.map((project) => (
            <PrototypeButton
              active={project.id === state.activeProjectId}
              aria-current={
                project.id === state.activeProjectId ? "true" : undefined
              }
              className="project-selector-option"
              key={project.id}
              onClick={() => {
                dispatch({ type: "switch-project", projectId: project.id });
                setOpen(false);
              }}
              role="menuitem"
              title={project.description}
              variant="ghost"
            >
              <span>{project.name}</span>
              {project.id === state.activeProjectId ? (
                <UiIcon name="check" />
              ) : null}
            </PrototypeButton>
          ))}
          <div className="project-selector-divider" />
          <PrototypeButton
            className="project-selector-option"
            onClick={() => {
              dispatch({ type: "create-project" });
              setOpen(false);
            }}
            role="menuitem"
            variant="ghost"
          >
            <UiIcon name="plus" />
            <span>Создать проект</span>
          </PrototypeButton>
        </div>
      ) : null}
    </div>
  );
}
