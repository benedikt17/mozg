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
type FilesActionState =
  | "idle"
  | "creating-folder"
  | "uploading"
  | "renaming-file"
  | "moving-file"
  | "deleting-file"
  | "restoring-file"
  | "renaming-folder"
  | "moving-folder";
type FilesLocation =
  { kind: "inbox" } | { kind: "folder"; folderId: string } | { kind: "trash" };
type FilesActionMessage = { kind: "error" | "info"; text: string };

const MOZG_FILE_DRAG_TYPE = "application/x-mozg-project-file-id";

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

    const filesPromise =
      location.kind === "trash"
        ? repository
            .listFiles({ ...scope, includeDeleted: true })
            .then((rows) => rows.filter((file) => file.deletedAt !== null))
        : repository.listFiles({
            ...scope,
            ...(trimmedQuery
              ? { query: trimmedQuery }
              : { folderId: activeFolderId }),
          });

    void Promise.all([repository.listFolders(scope), filesPromise])
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
  }, [
    activeFolderId,
    location.kind,
    projectId,
    query,
    reloadToken,
    repository,
    workspaceId,
  ]);

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
      : location.kind === "trash"
        ? "Корзина"
        : (activeFolder?.name ?? "Папка");
  const hasEntries = files.length > 0;
  const canMutate =
    Boolean(workspaceId) &&
    effectiveStatus === "ready" &&
    actionState === "idle" &&
    query.trim().length === 0 &&
    location.kind !== "trash";
  const canRestore =
    Boolean(workspaceId) &&
    effectiveStatus === "ready" &&
    actionState === "idle" &&
    location.kind === "trash";

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

  const openTrash = () => {
    setStatus("loading");
    setQuery("");
    setSelectedFileId(null);
    setActionMessage(null);
    setLocation({ kind: "trash" });
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

  const renameFile = async (file: ProjectFileRecord, name: string) => {
    if (!workspaceId || !canMutate) return false;
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName === file.name) return false;

    setActionState("renaming-file");
    setActionMessage(null);
    try {
      const updated = await repository.renameFile({
        workspaceId,
        projectId,
        fileId: file.id,
        name: trimmedName,
      });
      setFiles((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
      setActionMessage({ kind: "info", text: `Переименован: ${updated.name}` });
      return true;
    } catch {
      setActionMessage({
        kind: "error",
        text: "Не удалось переименовать файл.",
      });
      return false;
    } finally {
      setActionState("idle");
    }
  };

  const moveFile = async (
    file: ProjectFileRecord,
    targetFolderId: string | null,
  ) => {
    if (!workspaceId || !canMutate || file.folderId === targetFolderId) {
      return false;
    }

    setActionState("moving-file");
    setActionMessage(null);
    try {
      const updated = await repository.moveFile({
        workspaceId,
        projectId,
        fileId: file.id,
        folderId: targetFolderId,
      });
      const staysVisible =
        location.kind === "inbox"
          ? updated.folderId === null
          : location.kind === "folder"
            ? updated.folderId === location.folderId
            : false;
      setFiles((current) =>
        staysVisible
          ? current.map((row) => (row.id === updated.id ? updated : row))
          : current.filter((row) => row.id !== updated.id),
      );
      if (!staysVisible) setSelectedFileId(null);
      const targetName =
        targetFolderId === null
          ? "Входящие"
          : (folders.find((folder) => folder.id === targetFolderId)?.name ??
            "папку");
      setActionMessage({
        kind: "info",
        text: `Перемещён «${updated.name}» → ${targetName}`,
      });
      return true;
    } catch {
      setActionMessage({
        kind: "error",
        text: "Не удалось переместить файл.",
      });
      return false;
    } finally {
      setActionState("idle");
    }
  };

  const deleteFile = async (file: ProjectFileRecord) => {
    if (!workspaceId || !canMutate) return false;
    setActionState("deleting-file");
    setActionMessage(null);
    try {
      await repository.deleteFile({
        workspaceId,
        projectId,
        fileId: file.id,
      });
      setFiles((current) => current.filter((row) => row.id !== file.id));
      setSelectedFileId(null);
      setActionMessage({
        kind: "info",
        text: `Перемещён в корзину: ${file.name}`,
      });
      return true;
    } catch {
      setActionMessage({
        kind: "error",
        text: "Не удалось переместить файл в корзину.",
      });
      return false;
    } finally {
      setActionState("idle");
    }
  };

  const restoreFile = async (file: ProjectFileRecord) => {
    if (!workspaceId || !canRestore) return false;
    setActionState("restoring-file");
    setActionMessage(null);
    try {
      const restored = await repository.restoreFile({
        workspaceId,
        projectId,
        fileId: file.id,
      });
      setFiles((current) => current.filter((row) => row.id !== restored.id));
      setSelectedFileId(null);
      setActionMessage({
        kind: "info",
        text: `Восстановлен: ${restored.name}`,
      });
      return true;
    } catch {
      setActionMessage({
        kind: "error",
        text: "Не удалось восстановить файл.",
      });
      return false;
    } finally {
      setActionState("idle");
    }
  };

  const renameFolder = async (folder: ProjectFolderRecord, name: string) => {
    if (!workspaceId || !canMutate) return false;
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName === folder.name) return false;

    setActionState("renaming-folder");
    setActionMessage(null);
    try {
      const updated = await repository.renameFolder({
        workspaceId,
        projectId,
        folderId: folder.id,
        name: trimmedName,
      });
      setFolders((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
      setActionMessage({
        kind: "info",
        text: `Папка переименована: ${updated.name}`,
      });
      return true;
    } catch {
      setActionMessage({
        kind: "error",
        text: "Не удалось переименовать папку.",
      });
      return false;
    } finally {
      setActionState("idle");
    }
  };

  const moveFolder = async (
    folder: ProjectFolderRecord,
    targetParentFolderId: string | null,
  ) => {
    if (
      !workspaceId ||
      !canMutate ||
      folder.parentFolderId === targetParentFolderId
    ) {
      return false;
    }

    setActionState("moving-folder");
    setActionMessage(null);
    try {
      const updated = await repository.moveFolder({
        workspaceId,
        projectId,
        folderId: folder.id,
        parentFolderId: targetParentFolderId,
      });
      setFolders((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
      setActionMessage({
        kind: "info",
        text: `Папка перемещена: ${updated.name}`,
      });
      return true;
    } catch {
      setActionMessage({
        kind: "error",
        text: "Не удалось переместить папку.",
      });
      return false;
    } finally {
      setActionState("idle");
    }
  };

  const moveDraggedFile = (fileId: string, targetFolderId: string | null) => {
    if (!canMutate) return;
    const file = files.find((row) => row.id === fileId);
    if (!file) return;
    void moveFile(file, targetFolderId);
  };

  return (
    <div className={styles.workspace}>
      <aside className={styles.sidebar} aria-label="Навигация по файлам">
        <header className={styles.sidebarHeader}>
          <PrototypeButton
            aria-label="Загрузить файл"
            disabled={!canMutate}
            onClick={() => uploadInputRef.current?.click()}
            size="compact"
            style={{ justifySelf: "start" }}
            title={
              query.trim()
                ? "Завершите поиск, чтобы выбрать папку для загрузки"
                : location.kind === "trash"
                  ? "В корзину загружать нельзя"
                  : activeFolder
                    ? `Загрузить в «${activeFolder.name}»`
                    : "Загрузить во Входящие"
            }
            variant="quiet"
          >
            <UiIcon name="upload" />
            <span>Загрузить</span>
          </PrototypeButton>
          <div
            className={styles.sidebarToolbar}
            aria-label="Действия с папками"
          >
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
            disabled={location.kind === "trash"}
            onChange={(event) => {
              setStatus("loading");
              setSelectedFileId(null);
              setActionMessage(null);
              setQuery(event.currentTarget.value);
            }}
            placeholder={
              location.kind === "trash"
                ? "Поиск в корзине позже"
                : "Файл или папка"
            }
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
            onDragOver={(event) => {
              if (!hasProjectFileDrag(event.dataTransfer) || !canMutate) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              const fileId = projectFileDragId(event.dataTransfer);
              if (!fileId || !canMutate) return;
              event.preventDefault();
              moveDraggedFile(fileId, null);
            }}
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
                onChange={(event) =>
                  setNewFolderName(event.currentTarget.value)
                }
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
                  onDragOver={(event) => {
                    if (!hasProjectFileDrag(event.dataTransfer) || !canMutate) {
                      return;
                    }
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    const fileId = projectFileDragId(event.dataTransfer);
                    if (!fileId || !canMutate) return;
                    event.preventDefault();
                    moveDraggedFile(fileId, folder.id);
                  }}
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

          <div className={styles.sidebarDivider} />

          <button
            aria-current={location.kind === "trash" ? "page" : undefined}
            className={`${styles.sidebarRow} ${
              location.kind === "trash" ? styles.sidebarRowActive : ""
            }`}
            onClick={openTrash}
            type="button"
          >
            <UiIcon name="trash" />
            <span>Корзина</span>
          </button>
        </nav>
      </aside>

      <main className={styles.contentPane}>
        <header className={styles.contentHeader}>
          <div className={styles.headingBlock}>
            <h2>{title}</h2>
          </div>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              gap: 8,
              minWidth: 0,
            }}
          >
            {activeFolder && canMutate ? (
              <FolderHeaderActions
                folder={activeFolder}
                key={activeFolder.id}
                folders={folders}
                onMove={moveFolder}
                onRename={renameFolder}
              />
            ) : null}
            {actionMessage ? (
              <span
                className={`${styles.actionMessage} ${
                  actionMessage.kind === "error"
                    ? styles.actionMessageError
                    : ""
                }`}
                role={actionMessage.kind === "error" ? "alert" : "status"}
              >
                {actionMessage.text}
              </span>
            ) : null}
          </div>
        </header>

        <nav aria-label="Путь к папке" className={styles.breadcrumbs}>
          <span>{projectName}</span>
          <span aria-hidden="true">/</span>
          {query.trim() ? (
            <span className={styles.breadcrumbCurrent}>Результаты поиска</span>
          ) : location.kind === "inbox" ? (
            <span className={styles.breadcrumbCurrent}>Входящие</span>
          ) : location.kind === "trash" ? (
            <span className={styles.breadcrumbCurrent}>Корзина</span>
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
          aria-busy={effectiveStatus === "loading" || actionState !== "idle"}
          className={`${styles.content} ${
            isDropTarget ? styles.contentDropTarget : ""
          }`}
          onDragEnter={(event) => {
            if (!canMutate || hasProjectFileDrag(event.dataTransfer)) return;
            if (!event.dataTransfer.types.includes("Files")) return;
            event.preventDefault();
            setIsDropTarget(true);
          }}
          onDragLeave={() => setIsDropTarget(false)}
          onDragOver={(event) => {
            if (!canMutate || hasProjectFileDrag(event.dataTransfer)) return;
            if (!event.dataTransfer.types.includes("Files")) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(event) => {
            if (hasProjectFileDrag(event.dataTransfer)) return;
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
                  : location.kind === "trash"
                    ? "Корзина пуста"
                    : location.kind === "inbox"
                      ? "Входящие пусты"
                      : "Папка пуста"}
              </strong>
              <span>
                {query.trim()
                  ? "Попробуйте изменить поисковый запрос."
                  : location.kind === "trash"
                    ? "Удалённые файлы будут появляться здесь."
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
                    draggable={canMutate}
                    key={file.id}
                    onClick={() => setSelectedFileId(file.id)}
                    onDragStart={(event) => {
                      if (!canMutate) {
                        event.preventDefault();
                        return;
                      }
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData(MOZG_FILE_DRAG_TYPE, file.id);
                    }}
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
          location.kind === "trash" ? (
            <TrashFilePreview file={selectedFile} onRestore={restoreFile} />
          ) : (
            <ProjectFilePreview
              canMutate={canMutate}
              file={selectedFile}
              folders={folders}
              key={`${selectedFile.projectId}:${selectedFile.id}`}
              onDelete={deleteFile}
              onMove={moveFile}
              onRename={renameFile}
              projectId={projectId}
              repository={repository}
              workspaceId={workspaceId}
            />
          )
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

function FolderHeaderActions({
  folder,
  folders,
  onRename,
  onMove,
}: {
  folder: ProjectFolderRecord;
  folders: readonly ProjectFolderRecord[];
  onRename: (folder: ProjectFolderRecord, name: string) => Promise<boolean>;
  onMove: (
    folder: ProjectFolderRecord,
    parentFolderId: string | null,
  ) => Promise<boolean>;
}): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [targetParentId, setTargetParentId] = useState(
    folder.parentFolderId ?? "",
  );

  const moveTargets = getProjectFolderMoveTargets(folders, folder.id);

  if (editing) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onRename(folder, name).then((changed) => {
            if (changed) setEditing(false);
          });
        }}
        style={{ display: "flex", gap: 6 }}
      >
        <input
          aria-label="Новое название папки"
          autoFocus
          onChange={(event) => setName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setName(folder.name);
              setEditing(false);
            }
          }}
          style={compactInputStyle}
          value={name}
        />
        <PrototypeButton size="compact" type="submit">
          Сохранить
        </PrototypeButton>
      </form>
    );
  }

  return (
    <div style={{ alignItems: "center", display: "flex", gap: 6 }}>
      <PrototypeButton
        aria-label="Переименовать папку"
        onClick={() => setEditing(true)}
        size="compact"
        variant="quiet"
      >
        <UiIcon name="pencil" />
        <span>Переименовать</span>
      </PrototypeButton>
      <select
        aria-label="Куда переместить папку"
        onChange={(event) => setTargetParentId(event.currentTarget.value)}
        style={compactSelectStyle}
        value={targetParentId}
      >
        <option value="">В корень проекта</option>
        {moveTargets.map(({ folder: target, depth }) => (
          <option key={target.id} value={target.id}>
            {`${"— ".repeat(depth)}${target.name}`}
          </option>
        ))}
      </select>
      <PrototypeButton
        disabled={(folder.parentFolderId ?? "") === targetParentId}
        onClick={() =>
          void onMove(folder, targetParentId === "" ? null : targetParentId)
        }
        size="compact"
        variant="quiet"
      >
        Переместить
      </PrototypeButton>
    </div>
  );
}

function ProjectFilePreview({
  repository,
  workspaceId,
  projectId,
  file,
  folders,
  canMutate,
  onRename,
  onMove,
  onDelete,
}: {
  repository: ProjectFileRepository;
  workspaceId: string;
  projectId: string;
  file: ProjectFileRecord;
  folders: readonly ProjectFolderRecord[];
  canMutate: boolean;
  onRename: (file: ProjectFileRecord, name: string) => Promise<boolean>;
  onMove: (
    file: ProjectFileRecord,
    folderId: string | null,
  ) => Promise<boolean>;
  onDelete: (file: ProjectFileRecord) => Promise<boolean>;
}): React.JSX.Element {
  const [download, setDownload] = useState<ProjectFileDownload | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(file.name);
  const [targetFolderId, setTargetFolderId] = useState(file.folderId ?? "");

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

      {editingName ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onRename(file, name).then((changed) => {
              if (changed) setEditingName(false);
            });
          }}
          style={{ display: "flex", gap: 6, marginTop: 14 }}
        >
          <input
            aria-label="Новое имя файла"
            autoFocus
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setName(file.name);
                setEditingName(false);
              }
            }}
            style={{ ...compactInputStyle, flex: 1 }}
            value={name}
          />
          <PrototypeButton size="compact" type="submit">
            Сохранить
          </PrototypeButton>
        </form>
      ) : (
        <div className={styles.previewTitle}>{file.name}</div>
      )}

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

      <div
        className={styles.previewActions}
        style={{ flexWrap: "wrap", gap: 6 }}
      >
        <PrototypeButton
          disabled={!download}
          onClick={downloadOriginal}
          size="compact"
          variant="default"
        >
          Скачать оригинал
        </PrototypeButton>
        <PrototypeButton
          disabled={!canMutate}
          onClick={() => {
            setName(file.name);
            setEditingName(true);
          }}
          size="compact"
          variant="quiet"
        >
          Переименовать
        </PrototypeButton>
      </div>

      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 6,
          marginTop: 12,
        }}
      >
        <select
          aria-label="Куда переместить файл"
          disabled={!canMutate}
          onChange={(event) => setTargetFolderId(event.currentTarget.value)}
          style={{ ...compactSelectStyle, flex: 1, minWidth: 0 }}
          value={targetFolderId}
        >
          <option value="">Входящие</option>
          {getProjectFolderTree(folders).map(({ folder, depth }) => (
            <option key={folder.id} value={folder.id}>
              {`${"— ".repeat(depth)}${folder.name}`}
            </option>
          ))}
        </select>
        <PrototypeButton
          disabled={!canMutate || (file.folderId ?? "") === targetFolderId}
          onClick={() =>
            void onMove(file, targetFolderId === "" ? null : targetFolderId)
          }
          size="compact"
          variant="quiet"
        >
          Переместить
        </PrototypeButton>
      </div>

      <div className={styles.previewActions}>
        <PrototypeButton
          disabled={!canMutate}
          onClick={() => {
            if (
              typeof window !== "undefined" &&
              window.confirm(`Переместить «${file.name}» в корзину?`)
            ) {
              void onDelete(file);
            }
          }}
          size="compact"
          variant="quiet"
        >
          <UiIcon name="trash" />
          <span>В корзину</span>
        </PrototypeButton>
      </div>
    </div>
  );
}

function TrashFilePreview({
  file,
  onRestore,
}: {
  file: ProjectFileRecord;
  onRestore: (file: ProjectFileRecord) => Promise<boolean>;
}): React.JSX.Element {
  return (
    <div className={styles.previewContent}>
      <div className={styles.previewPlaceholder}>
        <UiIcon name="trash" />
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
          <dt>Удалён</dt>
          <dd>{formatProjectFileDate(file.deletedAt ?? file.updatedAt)}</dd>
        </div>
      </dl>
      <div className={styles.previewActions}>
        <PrototypeButton
          onClick={() => void onRestore(file)}
          size="compact"
          variant="default"
        >
          Восстановить
        </PrototypeButton>
      </div>
    </div>
  );
}

function projectFileUploadErrorMessage(cause: unknown): string {
  if (cause instanceof ProjectFileBrowserUploadError) return cause.message;
  return "Не удалось загрузить файл. Попробуйте ещё раз.";
}

function hasProjectFileDrag(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes(MOZG_FILE_DRAG_TYPE);
}

function projectFileDragId(dataTransfer: DataTransfer): string | null {
  if (!hasProjectFileDrag(dataTransfer)) return null;
  const fileId = dataTransfer.getData(MOZG_FILE_DRAG_TYPE).trim();
  return fileId || null;
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

export function getProjectFolderMoveTargets(
  folders: readonly ProjectFolderRecord[],
  movingFolderId: string,
): Array<{ folder: ProjectFolderRecord; depth: number }> {
  const disallowed = new Set<string>([movingFolderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders) {
      if (
        folder.parentFolderId !== null &&
        disallowed.has(folder.parentFolderId) &&
        !disallowed.has(folder.id)
      ) {
        disallowed.add(folder.id);
        changed = true;
      }
    }
  }
  return getProjectFolderTree(folders).filter(
    ({ folder }) => !disallowed.has(folder.id),
  );
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

const compactInputStyle = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background: "var(--surface)",
  color: "var(--text)",
  font: "inherit",
  fontSize: 12,
  height: 28,
  minWidth: 120,
  padding: "0 7px",
} satisfies React.CSSProperties;

const compactSelectStyle = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  background: "var(--surface)",
  color: "var(--text-2)",
  font: "inherit",
  fontSize: 12,
  height: 28,
  maxWidth: 180,
  padding: "0 6px",
} satisfies React.CSSProperties;
