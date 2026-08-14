"use client";

import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/browser";
import { SupabaseProjectFileRepository } from "@/lib/files/cloud-project-file-repository";
import type {
  ProjectFileRecord,
  ProjectFolderRecord,
} from "@/lib/files/project-file-repository";
import { UiIcon } from "@/prototype/desktop-icons";

import styles from "./files-workspace.module.css";

type FilesWorkspaceProps = {
  workspaceId?: string;
  projectId: string;
  projectName: string;
};

type FilesLoadStatus = "loading" | "ready" | "error";
type FilesLocation =
  | { kind: "inbox" }
  | { kind: "folder"; folderId: string };

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
  const [location, setLocation] = useState<FilesLocation>({ kind: "inbox" });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<FilesLoadStatus>("loading");
  const [reloadToken, setReloadToken] = useState(0);

  const activeFolderId = location.kind === "folder" ? location.folderId : null;

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    const trimmedQuery = query.trim();
    const scope = { workspaceId, projectId };

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

  const effectiveStatus: FilesLoadStatus = workspaceId ? status : "error";
  const breadcrumbs = getProjectFolderBreadcrumbs(folders, activeFolderId);
  const activeFolder =
    location.kind === "folder"
      ? folders.find((folder) => folder.id === location.folderId) ?? null
      : null;
  const folderTree = getProjectFolderTree(folders);
  const title = query.trim()
    ? "Результаты поиска"
    : location.kind === "inbox"
      ? "Входящие"
      : (activeFolder?.name ?? "Папка");
  const hasEntries = files.length > 0;

  const openInbox = () => {
    setStatus("loading");
    setQuery("");
    setLocation({ kind: "inbox" });
  };

  const openFolder = (folderId: string) => {
    setStatus("loading");
    setQuery("");
    setLocation({ kind: "folder", folderId });
  };

  return (
    <div className={styles.workspace}>
      <aside className={styles.sidebar} aria-label="Навигация по файлам">
        <div className={styles.sidebarHeader}>
          <strong>Файлы</strong>
        </div>

        <div className={styles.sidebarContent}>
          <button
            aria-current={location.kind === "inbox" ? "page" : undefined}
            className={`${styles.sidebarRow} ${
              location.kind === "inbox" ? styles.sidebarRowActive : ""
            }`}
            onClick={openInbox}
            type="button"
          >
            <UiIcon name="inbox" />
            <span>Входящие</span>
          </button>

          <div className={styles.sidebarSectionLabel}>Папки</div>

          <div className={styles.folderTree}>
            {folderTree.length > 0 ? (
              folderTree.map(({ folder, depth }) => (
                <button
                  aria-current={
                    location.kind === "folder" &&
                    location.folderId === folder.id
                      ? "page"
                      : undefined
                  }
                  className={`${styles.sidebarRow} ${
                    location.kind === "folder" &&
                    location.folderId === folder.id
                      ? styles.sidebarRowActive
                      : ""
                  }`}
                  key={folder.id}
                  onClick={() => openFolder(folder.id)}
                  style={{ paddingLeft: `${8 + depth * 14}px` }}
                  type="button"
                >
                  <UiIcon name="folder" />
                  <span>{folder.name}</span>
                </button>
              ))
            ) : (
              <div className={styles.sidebarEmpty}>Папок пока нет</div>
            )}
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headingBlock}>
            <h2>{title}</h2>
            {location.kind === "inbox" && !query.trim() ? (
              <span>Файлы, которые ещё не разложены по папкам</span>
            ) : null}
          </div>
          <label className={styles.search}>
            <span className={styles.visuallyHidden}>Поиск файлов</span>
            <input
              onChange={(event) => {
                setStatus("loading");
                setQuery(event.currentTarget.value);
              }}
              placeholder="Поиск файлов"
              type="search"
              value={query}
            />
          </label>
        </header>

        {location.kind === "folder" && !query.trim() ? (
          <nav aria-label="Путь к папке" className={styles.breadcrumbs}>
            <span>{projectName}</span>
            {breadcrumbs.map((folder) => (
              <span className={styles.breadcrumbPart} key={folder.id}>
                <span aria-hidden="true">/</span>
                <button
                  aria-current={
                    folder.id === activeFolderId ? "page" : undefined
                  }
                  onClick={() => openFolder(folder.id)}
                  type="button"
                >
                  {folder.name}
                </button>
              </span>
            ))}
          </nav>
        ) : null}

        <section
          aria-busy={effectiveStatus === "loading"}
          className={styles.content}
        >
          {effectiveStatus === "loading" ? (
            <div className={styles.stateMessage} role="status">
              Загрузка файлов…
            </div>
          ) : null}

          {effectiveStatus === "error" ? (
            <div className={styles.stateMessage} role="alert">
              <strong>Файлы пока недоступны</strong>
              <span>
                {workspaceId
                  ? "Не удалось загрузить файлы проекта. Попробуйте ещё раз."
                  : "Файлы доступны в облачном рабочем пространстве."}
              </span>
              {workspaceId ? (
                <button
                  onClick={() => {
                    setStatus("loading");
                    setReloadToken((value) => value + 1);
                  }}
                  type="button"
                >
                  Повторить
                </button>
              ) : null}
            </div>
          ) : null}

          {effectiveStatus === "ready" && !hasEntries ? (
            <div className={styles.stateMessage} role="status">
              <strong>
                {query.trim()
                  ? "Ничего не найдено"
                  : location.kind === "inbox"
                    ? "Входящие пусты"
                    : "Папка пуста"}
              </strong>
              <span>
                {query.trim()
                  ? "Попробуйте изменить поисковый запрос."
                  : location.kind === "inbox"
                    ? "Новые файлы без выбранной папки будут попадать сюда."
                    : "Здесь появятся файлы этой папки."}
              </span>
            </div>
          ) : null}

          {effectiveStatus === "ready" && hasEntries ? (
            <div className={styles.tableWrap}>
              <div className={styles.tableHeader} aria-hidden="true">
                <span>Имя</span>
                <span>Тип</span>
                <span>Размер</span>
                <span>Изменён</span>
              </div>
              <div className={styles.entries}>
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
      </main>
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

export function getProjectFolderTree(
  folders: readonly ProjectFolderRecord[],
): Array<{ folder: ProjectFolderRecord; depth: number }> {
  const activeFolders = folders.filter((folder) => !folder.deletedAt);
  const childrenByParent = new Map<string | null, ProjectFolderRecord[]>();
  for (const folder of activeFolders) {
    const siblings = childrenByParent.get(folder.parentFolderId) ?? [];
    siblings.push(folder);
    childrenByParent.set(folder.parentFolderId, siblings);
  }
  for (const siblings of childrenByParent.values()) {
    siblings.sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
    );
  }

  const result: Array<{ folder: ProjectFolderRecord; depth: number }> = [];
  const visited = new Set<string>();
  const visit = (parentFolderId: string | null, depth: number) => {
    for (const folder of childrenByParent.get(parentFolderId) ?? []) {
      if (visited.has(folder.id)) continue;
      visited.add(folder.id);
      result.push({ folder, depth });
      visit(folder.id, depth + 1);
    }
  };
  visit(null, 0);
  return result;
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
