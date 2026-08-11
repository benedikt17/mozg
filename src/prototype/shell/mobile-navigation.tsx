"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import {
  shouldShowAuthenticatedAccountControls,
  type DesktopRuntimeMode,
} from "@/lib/desktop-runtime-mode";
import type {
  DesktopPrototypeAction,
  DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { getActiveProject } from "@/prototype/desktop-state";
import type { ProjectSection } from "@/prototype/desktop-mock-data";
import { UiIcon, type UiIconName } from "@/prototype/desktop-icons";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

type MobileSection = {
  id: Extract<ProjectSection, "overview" | "knowledge" | "tasks" | "canvases">;
  label: string;
  icon: UiIconName;
};

const mobileSections: readonly MobileSection[] = [
  { id: "overview", label: "Обзор", icon: "layout" },
  { id: "knowledge", label: "Знания", icon: "book" },
  { id: "tasks", label: "Задачи", icon: "check-circle" },
  { id: "canvases", label: "Холсты", icon: "nodes" },
];

export function MobileNavigation({
  state,
  dispatch,
  runtimeMode,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
  runtimeMode: DesktopRuntimeMode;
}): React.JSX.Element {
  const [moreOpen, setMoreOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMoreOpen(false);
  }, [state.activeProjectId, state.activeSection]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moreOpen]);

  const logout = async (): Promise<void> => {
    await createClient().auth.signOut();
    router.replace("/sign-in");
    router.refresh();
  };

  const openSection = (section: MobileSection["id"]): void => {
    setMoreOpen(false);
    dispatch({ type: "switch-section", section });
  };

  return (
    <>
      <nav className="mobile-bottom-navigation" aria-label="Основные разделы">
        {mobileSections.map((section) => (
          <button
            aria-current={
              state.activeSection === section.id ? "page" : undefined
            }
            className="mobile-bottom-navigation-item"
            data-active={state.activeSection === section.id ? "true" : "false"}
            key={section.id}
            onClick={() => openSection(section.id)}
            type="button"
          >
            <UiIcon name={section.icon} />
            <span>{section.label}</span>
          </button>
        ))}
        <button
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          className="mobile-bottom-navigation-item"
          data-active={moreOpen ? "true" : "false"}
          onClick={() => setMoreOpen((open) => !open)}
          type="button"
        >
          <UiIcon name="more" />
          <span>Ещё</span>
        </button>
      </nav>

      {moreOpen ? (
        <>
          <button
            aria-label="Закрыть мобильное меню"
            className="mobile-more-backdrop"
            onClick={() => setMoreOpen(false)}
            tabIndex={-1}
            type="button"
          />
          <section
            aria-label="Дополнительная навигация"
            aria-modal="true"
            className="mobile-more-sheet"
            role="dialog"
          >
            <header className="mobile-more-sheet-header">
              <div>
                <span>Проект</span>
                <strong>{getActiveProject(state).name}</strong>
              </div>
              <button
                aria-label="Закрыть"
                className="mobile-more-close"
                onClick={() => setMoreOpen(false)}
                type="button"
              >
                <UiIcon name="close" />
              </button>
            </header>

            <div className="mobile-more-section">
              <span className="mobile-more-label">Проекты</span>
              <div className="mobile-project-list">
                {state.projects.map((project) => (
                  <button
                    aria-current={
                      project.id === state.activeProjectId ? "true" : undefined
                    }
                    className="mobile-project-option"
                    data-active={
                      project.id === state.activeProjectId ? "true" : "false"
                    }
                    key={project.id}
                    onClick={() => {
                      dispatch({
                        type: "switch-project",
                        projectId: project.id,
                      });
                      setMoreOpen(false);
                    }}
                    type="button"
                  >
                    <span>{project.name}</span>
                    {project.id === state.activeProjectId ? (
                      <UiIcon name="check" />
                    ) : null}
                  </button>
                ))}
                <button
                  className="mobile-project-option"
                  onClick={() => {
                    dispatch({ type: "create-project" });
                    setMoreOpen(false);
                  }}
                  type="button"
                >
                  <span>Создать проект</span>
                  <UiIcon name="plus" />
                </button>
              </div>
            </div>

            <div className="mobile-more-section mobile-more-actions">
              <button
                onClick={() => {
                  dispatch({ type: "open-command-palette" });
                  setMoreOpen(false);
                }}
                type="button"
              >
                <UiIcon name="search" />
                <span>Поиск</span>
              </button>
              {state.activeSection === "knowledge" ? null : (
                <button
                  onClick={() => {
                    dispatch({ type: "open-ai-panel" });
                    setMoreOpen(false);
                  }}
                  type="button"
                >
                  <span className="mobile-more-ai-icon" aria-hidden="true">
                    AI
                  </span>
                  <span>AI</span>
                </button>
              )}
              {shouldShowAuthenticatedAccountControls(runtimeMode) ? (
                <button onClick={logout} type="button">
                  <span className="mobile-more-signout-icon" aria-hidden="true">
                    ↪
                  </span>
                  <span>Выйти</span>
                </button>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
