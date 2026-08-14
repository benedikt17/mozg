"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  prepareProjectFileBrowserUpload,
  ProjectFileBrowserUploadError,
} from "@/lib/files/project-file-browser-upload";
import { SupabaseProjectFileRepository } from "@/lib/files/cloud-project-file-repository";
import {
  PROJECT_FILE_MIME_TYPES,
  type ProjectFileDownload,
  type ProjectFileRecord,
  type ProjectFileRepository,
  type ProjectFolderRecord,
} from "@/lib/files/project-file-repository";
import { createClient } from "@/lib/supabase/browser";
import { UiIcon } from "@/prototype/desktop-icons";
import { IconButton, PrototypeButton } from "@/prototype/desktop-ui";

import styles from "./files-workspace.module.css";

type FilesWorkspaceProps = {
  workspaceId?: string;
  projectId: string;
  projectName: string;
};

type FilesLoadStatus = "loading" | "ready" | "error";
type FilesActionState = "idle" | "creating-folder" | "uploading";
type FilesLocation = { kind: "inbox" } | { kind: "folder"; folderId: string };
type FilesActionMessage = { kind: "error" | "info"; text: string };

export function FilesWorkspace({
  workspaceId,
  projectId,
  projectName,
}: FilesWorkspaceProps): React.JSX.Element {
  const repository = useMemo(
    () => new SupabaseProjectFileRepository({ supabase: createClient() }),
    [],
  );
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [folders, setFolders] = useState<ProjectFolderRecord[]>([]);
  const [files, setFiles] = useState<ProjectFileRecord[]>([]);
  const [location, setLocation] = useState<FilesLocation>({ kind: "inbox" });
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<FilesLoadStatus>("loading");
  const [reloadToken, setReloadToken] = useState(0);
  const [actionState, setActionState] = useState<FilesActionState>("idle");
  const [actionMessage, setActionMessage] = useState<FilesActionMessage | null>(
    null,
  );
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isDropTarget, setIsDropTarget] = useState(false);

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
        setSelectedFileId((currentFileId) =>
          currentFileId && nextFiles.some((file) => file.id === currentFileId)
            ? currentFileId
            : null,
        );
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setFolders([]);
        setFiles([]);
        setSelectedFileId(null);
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
      ? (folders.find((folder) => folder.id === location.folderId) ?? null)
      : null;
  const selectedFile = files.find((file) => file.id === selectedFileId) ?? null;
  const folderTree = getProjectFolderTree(folders);
  const title = query.trim()
    ? "Результаты поиска"
    : location.kind === "inbox"
      ? "Входящие"
      : (activeFolder?.name ?? "Папка");
  const hasEntries = files.length > 0;
  const canMutate =
    Boolean(workspaceId) &&
    effectiveStatus === "ready" &&
    actionState === "idle" &&
    query.trim().length === 0;

  const openInbox = () => {
    setStatus("loading");
    setQuery("");
    setSelectedFileId(null);
    setActionMessage(null);
    setLocation({ kind: "inbox" });
  };

  const openFolder = (folderId: string) => {
    setStatus("loading");
    setQuery("");
    setSelectedFileId(null);
    setActionMessage(null);
    setLocation({ kind: "folder", folderId });
  };

  const createFolder = async () => {
    if (!workspaceId || !canMutate) return;
    const name = newFolderName.trim();
    if (name.length === 0) return;

    setActionState("creating-folder");
    setActionMessage(null);
    try {
      const folder = await repository.createFolder({
        workspaceId,
        projectId,
        name,
        parentFolderId: activeFolderId,
      });
      setFolders((current) => [...current, folder]);
      setIsCreatingFolder(false);
      setNewFolderName("");
      setStatus("loading");
      setSelectedFileId(null);
      setLocation({ kind: "folder", folderId: folder.id });
    } catch {
      setActionMessage({
        kind: "error",
        text: "Не удалось создать папку. Проверьте название и попробуйте ещё раз.",
      });
    } finally {
      setActionState("idle");
    }
  };

  const uploadFiles = async (browserFiles: readonly File[]) => {
    if (!workspaceId || !canMutate || browserFiles.length === 0) return;

    setActionState("uploading");
    setActionMessage({
      kind: "info",
      text:
        browserFiles.length === 1
          ? "Загрузка файла…"
          : `Загрузка файлов: ${browserFiles.length}…`,
    });

    try {
      let lastUploadedFile: ProjectFileRecord | null = null;
      for (const browserFile of browserFiles) {
        const prepared = await prepareProjectFileBrowserUpload(browserFile);
        const uploaded = await repository.uploadFile({
          workspaceId,
          projectId,
          folderId: activeFolderId,
          ...prepared,
        });
        lastUploadedFile = uploaded;
        setFiles((current) => [
          uploaded,
          ...current.filter((file) => file.id !== uploaded.id),
        ]);
      }

      if (lastUploadedFile) {
        setSelectedFileId(lastUploadedFile.id);
        setActionMessage({
          kind: "info",
          text:
            browserFiles.length === 1
              ? `Загружен: ${lastUploadedFile.name}`
              : `Загружено файлов: ${browserFiles.length}`,
        });
      }
    } catch (cause) {
      setActionMessage({
        kind: "error",
        text: projectFileUploadErrorMessage(cause),
      });
    } finally {
      setActionState("idle");
    }
  };

  return (
    <div className={styles.workspace}>
      <aside className={styles.sidebar} aria-label="Навигация по файлам">
        <header className={styles.sidebarHeader}>
          <div
            className={styles.sidebarToolbar}
            aria-label="Действия с файлами"
          >
            <IconButton
              disabled={!canMutate}
              icon={<UiIcon name="file-plus" />}
              label="Загрузить файл"
              onClick={() => uploadInputRef.current?.click()}
              title={
                query.trim()
                  ? "Завершите поиск, чтобы выбрать папку для загрузки"
                  : activeFolder
                    ? `Загрузить в «${activeFolder.name}»`
                    : "Загрузить во Входящие"
              }
              variant="ghost"
            />
            <IconButton
              disabled={!canMutate || isCreatingFolder}
              icon={<UiIcon name="folder-plus" />}
              label="Создать папку"
              onClick={() => {
                setActionMessage(null);
                setNewFolderName("");
                setIsCreatingFolder(true);
              }}
              title={
                activeFolder
                  ? `Новая папка внутри «${activeFolder.name}»`
                  : "Новая папка"
              }
              variant="ghost"
            />
          </div>
          <input
            ref={uploadInputRef}
            accept={PROJECT_FILE_MIME_TYPES.join(",")}
            aria-label="Выбрать файлы для загрузки"
            className={styles.hiddenFileInput}
            multiple
            onChange={(event) => {
              const browserFiles = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              void uploadFiles(browserFiles);
            }}
            type="file"
          />
        </header>

        <label className={styles.sidebarSearch}>
          <span className={styles.visuallyHidden}>Поиск файлов</span>
          <input
            onChange={(event) => {
              setStatus("loading");
              setSelectedFileId(null);
              setActionMessage(null);
              setQuery(event.currentTarget.value);
            }}
            placeholder="Файл или папка"
            type="search"
            value={query}
          />
        </label>

        <nav className={styles.sidebarNavigation} aria-label="Разделы файлов">
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

          <div className={styles.sidebarDivider} />

          {isCreatingFolder ? (
            <form
              className={styles.newFolderRow}
              onSubmit={(event) => {
                event.preventDefault();
                void createFolder();
              }}
            >
              <UiIcon name="folder" />
              <input
                aria-label="Название новой папки"
                autoFocus
                disabled={actionState === "creating-folder"}
                onChange={(event) => setNewFolderName(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setIsCreatingFolder(false);
                    setNewFolderName("");
                  }
                }}
                placeholder="Новая папка"
                value={newFolderName}
              />
            </form>
          ) : null}

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
            ) : isCreatingFolder ? null : (
              <div className={styles.sidebarEmpty}>Папок пока нет</div>
            )}
          </div>
        </nav>
      </aside>

      <main className={styles.contentPane}>
        <header className={styles.contentHeader}>
          <div className={styles.headingBlock}>
            <h2>{title}</h2>
          </div>
          {actionMessage ? (
            <span
              className={`${styles.actionMessage} ${
                actionMessage.kind === "error" ? styles.actionMessageError : ""
              }`}
              role={actionMessage.kind === "error" ? "alert" : "status"}
            >
              {actionMessage.text}
            </span>
          ) : null}
        </header>

        <nav aria-label="Путь к папке" className={styles.breadcrumbs}>
          <span>{projectName}</span>
          <span aria-hidden="true">/</span>
          {query.trim() ? (
            <span className={styles.breadcrumbCurrent}>Результаты поиска</span>
          ) : location.kind === "inbox" ? (
            <span className={styles.breadcrumbCurrent}>Входящие</span>
          ) : (
            breadcrumbs.map((folder, index) => (
              <span className={styles.breadcrumbPart} key={folder.id}>
                {index > 0 ? <span aria-hidden="true">/</span> : null}
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
            ))
          )}
        </nav>

        <section
          aria-busy={
            effectiveStatus === "loading" || actionState === "uploading"
          }
          className={`${styles.content} ${
            isDropTarget ? styles.contentDropTarget : ""
          }`}
          onDragEnter={(event) => {
            if (!canMutate) return;
            event.preventDefault();
            setIsDropTarget(true);
          }}
          onDragLeave={() => setIsDropTarget(false)}
          onDragOver={(event) => {
            if (!canMutate) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDropTarget(false);
            if (!canMutate) return;
            void uploadFiles(Array.from(event.dataTransfer.files));
          }}
        >
          {isDropTarget ? (
            <div className={styles.dropOverlay} aria-hidden="true">
              Отпустите файлы для загрузки
            </div>
          ) : null}

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
                    ? "Перетащите файлы сюда или используйте кнопку загрузки."
                    : "Перетащите файлы сюда или используйте кнопку загрузки."}
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
                  <button
                    aria-pressed={file.id === selectedFileId}
                    className={`${styles.entryRow} ${
                      file.id === selectedFileId ? styles.entryRowSelected : ""
                    }`}
                    key={file.id}
                    onClick={() => setSelectedFileId(file.id)}
                    type="button"
                  >
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
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </main>

      <aside className={styles.previewPane} aria-label="Предпросмотр файла">
        <header className={styles.previewHeader}>
          <strong>Предпросмотр</strong>
        </header>
        {selectedFile && workspaceId ? (
          <ProjectFilePreview
            file={selectedFile}
            key={`${selectedFile.projectId}:${selectedFile.id}`}
            projectId={projectId}
            repository={repository}
            workspaceId={workspaceId}
          />
        ) : (
          <div className={styles.previewEmpty}>
            <UiIcon name="file" />
            <strong>Выберите файл</strong>
            <span>Здесь будет предпросмотр и информация о файле.</span>
          </div>
        )}
      </aside>
    </div>
  );
}

function ProjectFilePreview({
  repository,
  workspaceId,
  projectId,
  file,
}: {
  repository: ProjectFileRepository;
  workspaceId: string;
  projectId: string;
  file: ProjectFileRecord;
}): React.JSX.Element {
  const [download, setDownload] = useState<ProjectFileDownload | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    void repository
      .downloadFile({ workspaceId, projectId, fileId: file.id })
      .then((nextDownload) => {
        if (cancelled) return;
        setDownload(nextDownload);
        if (file.mimeType.startsWith("image/")) {
          objectUrl = URL.createObjectURL(nextDownload.blob);
          setImageUrl(objectUrl);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, file.mimeType, projectId, repository, workspaceId]);

  const downloadOriginal = () => {
    if (!download) return;
    const objectUrl = URL.createObjectURL(download.blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = file.originalName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  };

  return (
    <div className={styles.previewContent}>
      <div className={styles.previewPlaceholder}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview uses a local authenticated Blob URL.
          <img alt={file.name} className={styles.previewImage} src={imageUrl} />
        ) : loadError ? (
          <span className={styles.previewState}>Предпросмотр недоступен</span>
        ) : download ? (
          <UiIcon name="file" />
        ) : (
          <span className={styles.previewState}>Загрузка предпросмотра…</span>
        )}
      </div>
      <div className={styles.previewTitle}>{file.name}</div>
      <dl className={styles.previewMetadata}>
        <div>
          <dt>Тип</dt>
          <dd>{projectFileTypeLabel(file.mimeType)}</dd>
        </div>
        <div>
          <dt>Размер</dt>
          <dd>{formatProjectFileSize(file.byteSize)}</dd>
        </div>
        <div>
          <dt>Изменён</dt>
          <dd>{formatProjectFileDate(file.updatedAt)}</dd>
        </div>
      </dl>
      <div className={styles.previewActions}>
        <PrototypeButton
          disabled={!download}
          onClick={downloadOriginal}
          size="compact"
          variant="default"
        >
          Скачать оригинал
        </PrototypeButton>
      </div>
    </div>
  );
}

function projectFileUploadErrorMessage(cause: unknown): string {
  if (cause instanceof ProjectFileBrowserUploadError) return cause.message;
  return "Не удалось загрузить файл. Попробуйте ещё раз.";
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
