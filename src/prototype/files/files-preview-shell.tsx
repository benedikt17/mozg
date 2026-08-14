"use client";

import Link from "next/link";
import { useState } from "react";

import type { PrototypeProject } from "@/prototype/desktop-mock-data";
import { FilesWorkspace } from "@/prototype/files/files-workspace";

import styles from "./files-preview-shell.module.css";

export function FilesPreviewShell({
  workspaceId,
  workspaceName,
  projects,
}: {
  workspaceId: string;
  workspaceName: string;
  projects: readonly PrototypeProject[];
}): React.JSX.Element {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const project = projects.find((item) => item.id === projectId) ?? projects[0];

  if (!project) {
    return (
      <main className={styles.boundary}>
        <strong>Нет доступных проектов</strong>
        <Link href="/prototype/desktop">Вернуться в MOZG</Link>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <header className={styles.applicationHeader}>
        <div className={styles.identity}>
          <Link aria-label="Вернуться в MOZG" className={styles.brand} href="/prototype/desktop">
            M
          </Link>
          <div className={styles.workspaceTitle}>
            <span>{workspaceName}</span>
            <strong>Preview · Файлы</strong>
          </div>
        </div>
        <label className={styles.projectPicker}>
          <span>Проект</span>
          <select
            onChange={(event) => setProjectId(event.currentTarget.value)}
            value={project.id}
          >
            {projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <Link className={styles.backLink} href="/prototype/desktop">
          ← В рабочее пространство
        </Link>
      </header>
      <section className={styles.workspace}>
        <FilesWorkspace
          key={project.id}
          projectId={project.id}
          projectName={project.name}
          workspaceId={workspaceId}
        />
      </section>
    </main>
  );
}
