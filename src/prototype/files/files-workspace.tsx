"use client";

import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/browser";
import {
  SupabaseProjectFileRepository,
} from "@/lib/files/cloud-project-file-repository";
import type {
  ProjectFileRecord,
  ProjectFolderRecord,
} from "@/lib/files/project-file-repository";

import styles from "./files-workspace.module.css";

type FilesWorkspaceProps = {
  workspaceId?: string;
  projectId: string;
  projectName: string;
};

type FilesLoadStatus = "idle" | "loading" | "ready" | "error";

export function FilesWorkspace({
  workspaceId,
  projectId,
  projectName,
}: FilesWorkspaceProps): React.JSX.Element {
  const repository = useMemo(
    () => new SupabaseProjectFileRepository({ supabase: createClient() }),
    [],
  );
  const [folders, setFolders] = useState<ProjectFolderRecord[]>([]);
  const [files, setFiles] = useState<ProjectFileRecord[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<FilesLoadStatus>("idle");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    setActiveFolderId(null);
    setQuery("");
  }, [projectId]);

  useEffect(() => {
    if (!workspaceId) {
      setStatus("error");
      setFolders([]);
      setFiles([]);
      return;
    }

    let cancelled = false;
    const trimmedQuery = query.trim();
    const scope = { workspaceId, projectId };
    setStatus("loading");

    void Promise.all([
      repository.listFolders(scope),
      repository.listFiles({
        ...scope,
        ...(trimmedQuery
          ? { query: trimmedQuery }
          : { folderId: activeFolderId }),
      }),
    ])
      .then(([nextFolders, nextFiles]) => {
        if (cancelled) return;
        setFolders(nextFolders);
        setFiles(nextFiles);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setFolders([]);
        setFiles([]);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [activeFolderId, projectId, query, reloadToken, repository, workspaceId]);

  const breadcrumbs = getProjectFolderBreadcrumbs(folders, activeFolderId);
  const childFolders = query.trim()
    ? []
    : folders.filter(
        (folder) =>
          folder.parentFolderId === activeFolderId && !folder.deletedAt,
      );
  const hasEntries = childFolders.length > 0 || files.length > 0;

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div className={styles.headingBlock}>
          <h2>Файлы</h2>
          <span>{projectName}</span>
        </div>
        <label className={styles.search}>
          <span className={styles.visuallyHidden}>Поиск файлов</span>
          <input
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Поиск файлов"
            type="search"
            value={query}
          />
        </label>
      </header>

      <nav aria-label="Путь к папке" className={styles.breadcrumbs}>
        <button
          aria-current={activeFolderId === null ? "page" : undefined}
          onClick={() => setActiveFolderId(null)}
          type="button"
        >
          {projectName}
        </button>
        {breadcrumbs.map((folder) => (
          <span className={styles.breadcrumbPart} key={folder.id}>
            <span aria-hidden="true">/</span>
            <button
              aria-current={folder.id === activeFolderId ? "page" : undefined}
              onClick={() => setActiveFolderId(folder.id)}
              type="button"
            >
              {folder.name}
            </button>
          </span>
        ))}
      </nav>

      <section aria-busy={status === "loading"} className={styles.content}>
        {status === "loading" ? (
          <div className={styles.stateMessage} role="status">
            Загрузка файлов…
          </div>
        ) : null}

        {status === "error" ? (
          <div className={styles.stateMessage} role="alert">
            <strong>Файлы пока недоступны</strong>
            <span>
              Preview-бэкенд для этого раздела ещё не подключён или не отвечает.
            </span>
            <button
              onClick={() => setReloadToken((value) => value + 1)}
              type="button"
            >
              Повторить
            </button>
          </div>
        ) : null}

        {status === "ready" && !hasEntries ? (
          <div className={styles.stateMessage} role="status">
            <strong>
              {query.trim() ? "Ничего не найдено" : "Папка пуста"}
            </strong>
            <span>
              {query.trim()
                ? "Попробуйте изменить поисковый запрос."
                : "Здесь появятся папки и файлы проекта."}
            </span>
          </div>
        ) : null}

        {status === "ready" && hasEntries ? (
          <div className={styles.tableWrap}>
            <div className={styles.tableHeader} aria-hidden="true">
              <span>Имя</span>
              <span>Тип</span>
              <span>Размер</span>
              <span>Изменён</span>
            </div>
            <div className={styles.entries}>
              {childFolders.map((folder) => (
                <button
                  className={styles.entryRow}
                  key={folder.id}
                  onClick={() => setActiveFolderId(folder.id)}
                  type="button"
                >
                  <span className={styles.nameCell}>
                    <span className={styles.entryIcon} aria-hidden="true">
                      ▰
                    </span>
                    <span>{folder.name}</span>
                  </span>
                  <span>Папка</span>
                  <span>—</span>
                  <span>{formatProjectFileDate(folder.updatedAt)}</span>
                </button>
              ))}
              {files.map((file) => (
                <div className={styles.entryRow} key={file.id}>
                  <span className={styles.nameCell}>
                    <span className={styles.entryIcon} aria-hidden="true">
                      {file.mimeType.startsWith("image/") ? "▧" : "▤"}
                    </span>
                    <span className={styles.fileName} title={file.name}>
                      {file.name}
                    </span>
                  </span>
                  <span>{projectFileTypeLabel(file.mimeType)}</span>
                  <span>{formatProjectFileSize(file.byteSize)}</span>
                  <span>{formatProjectFileDate(file.updatedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function getProjectFolderBreadcrumbs(
  folders: readonly ProjectFolderRecord[],
  activeFolderId: string | null,
): ProjectFolderRecord[] {
  if (activeFolderId === null) return [];
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const path: ProjectFolderRecord[] = [];
  const visited = new Set<string>();
  let currentId: string | null = activeFolderId;

  while (currentId !== null && !visited.has(currentId)) {
    visited.add(currentId);
    const folder = byId.get(currentId);
    if (!folder) break;
    path.unshift(folder);
    currentId = folder.parentFolderId;
  }

  return path;
}

export function formatProjectFileSize(byteSize: number): string {
  if (byteSize < 1024) return `${byteSize} Б`;
  const kib = byteSize / 1024;
  if (kib < 1024) return `${formatProjectFileNumber(kib)} КБ`;
  const mib = kib / 1024;
  return `${formatProjectFileNumber(mib)} МБ`;
}

function formatProjectFileNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  }).format(value);
}

function formatProjectFileDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function projectFileTypeLabel(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "Изображение";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "text/markdown") return "Markdown";
  if (mimeType.startsWith("text/")) return "Текст";
  if (mimeType.includes("wordprocessingml")) return "Word";
  if (mimeType.includes("spreadsheetml")) return "Excel";
  if (mimeType.includes("presentationml")) return "PowerPoint";
  if (mimeType === "application/json") return "JSON";
  return "Файл";
}
