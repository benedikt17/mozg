import React from "react";
import {
  projectSections,
  type ProjectSection,
} from "@/prototype/desktop-mock-data";
import { IconButton } from "@/prototype/desktop-ui";
import { type UiIconName, UiIcon } from "@/prototype/desktop-icons";
import type {
  DesktopPrototypeAction,
  DesktopPrototypeState,
} from "@/prototype/desktop-state";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

const sectionRailIcons: Record<ProjectSection, UiIconName> = {
  overview: "layout",
  knowledge: "book",
  tasks: "check-circle",
  canvases: "nodes",
  inbox: "inbox",
};

export function SectionRail({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  return (
    <aside className="project-rail" aria-label="Разделы" data-collapsed="true">
      <div className="rail-brand">
        <div className="rail-brand-identity">
          <span className="rail-brand-mark">M</span>
          <strong>mozg</strong>
        </div>
      </div>
      <nav className="rail-section-list" aria-label="Разделы">
        {projectSections.map((section) => (
          <IconButton
            active={state.activeSection === section.id}
            className="rail-section-item"
            icon={<UiIcon name={sectionRailIcons[section.id]} />}
            key={section.id}
            label={section.label}
            onClick={() =>
              dispatch({ type: "switch-section", section: section.id })
            }
            title={section.label}
            variant="ghost"
          />
        ))}
      </nav>
    </aside>
  );
}
