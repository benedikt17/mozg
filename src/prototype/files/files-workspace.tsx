"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  prepareProjectFileBrowserUpload,
  ProjectFileBrowserUploadError,
} from "@/lib/files/project-file-browser-upload";
import { SupabaseProjectFileImageVariantRepository } from "@/lib/files/cloud-project-file-image-variant-repository";
import { SupabaseProjectFileRepository } from "@/lib/files/cloud-project-file-repository";
import { generateAndStoreProjectFileImageVariantsBestEffort } from "@/lib/files/project-file-image-variant-generation";
import {
  chooseProjectFilePreviewVariant,
  PROJECT_FILE_PREVIEW_PREFERRED_MAX_EDGE,
  type ProjectFileImageVariantMetadata,
  type ProjectFileImageVariantRepository,
} from "@/lib/files/project-file-image-variants";
import { getPublicEnv } from "@/lib/env";
import { CloudProjectFileRepositoryError } from "@/lib/files/project-file-runtime";
import {
  PROJECT_FILE_MIME_TYPES,
  type ProjectFileRecord,
  type ProjectFileRepository,
  type ProjectFileUploadTransport,
  type ProjectFolderRecord,
} from "@/lib/files/project-file-repository";
import { projectFileResumableUploadEndpoint } from "@/lib/files/project-file-resumable-upload";
import { projectFileUploadTransport } from "@/lib/files/project-file-upload-limit";
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
type FilesViewMode = "list" | "grid" | "large-grid";
type ActiveProjectFileUpload = {
  fileName: string;
  currentFile: number;
  totalFiles: number;
  percentage: number;
  transport: ProjectFileUploadTransport;
  resumed: boolean;
  retryAttempt: number;
};

const MOZG_FILE_DRAG_TYPE = "application/x-mozg-project-file-id";
const PROJECT_FILE_PREVIEW_CACHE_LIMIT_BYTES = 96 * 1024 * 1024;
const PROJECT_FILE_PREVIEW_CACHE_LIMIT_ENTRIES = 160;

type ProjectFilePreviewCacheEntry = {
  blob: Blob;
  lastUsedAt: number;
};

const projectFilePreviewCache = new Map<string, ProjectFilePreviewCacheEntry>();
const projectFilePreviewLoads = new Map<string, Promise<Blob>>();

function projectFilePreviewCacheKey({
  workspaceId,
  projectId,
  fileId,
  targetMaxEdge,
}: {
  workspaceId: string;
  projectId: string;
  fileId: string;
  targetMaxEdge: number;
}): string {
  return [workspaceId, projectId, fileId, targetMaxEdge].join(":");
}

function getCachedProjectFilePreview(key: string): Blob | null {
  const cached = projectFilePreviewCache.get(key);
  if (!cached) return null;
  cached.lastUsedAt = Date.now();
  return cached.blob;
}

function cacheProjectFilePreview(key: string, blob: Blob): void {
  if (blob.size > PROJECT_FILE_PREVIEW_CACHE_LIMIT_BYTES) return;

  projectFilePreviewCache.set(key, { blob, lastUsedAt: Date.now() });

  let cachedBytes = [...projectFilePreviewCache.values()].reduce(
    (total, entry) => total + entry.blob.size,
    0,
  );
  const oldestFirst = [...projectFilePreviewCache.entries()].sort(
    ([, left], [, right]) => left.lastUsedAt - right.lastUsedAt,
  );

  while (
    (cachedBytes > PROJECT_FILE_PREVIEW_CACHE_LIMIT_BYTES ||
      projectFilePreviewCache.size >
        PROJECT_FILE_PREVIEW_CACHE_LIMIT_ENTRIES) &&
    oldestFirst.length > 0
  ) {
    const [oldestKey, oldestEntry] = oldestFirst.shift()!;
    projectFilePreviewCache.delete(oldestKey);
    cachedBytes -= oldestEntry.blob.size;
  }
}

async function loadCachedProjectFileImagePreview({
  repository,
  imageVariantRepository,
  workspaceId,
  projectId,
  fileId,
  targetMaxEdge,
}: {
  repository: ProjectFileRepository;
  imageVariantRepository: ProjectFileImageVariantRepository;
  workspaceId: string;
  projectId: string;
  fileId: string;
  targetMaxEdge: number;
}): Promise<Blob> {
  const cacheKey = projectFilePreviewCacheKey({
    workspaceId,
    projectId,
    fileId,
    targetMaxEdge,
  });
  const cached = getCachedProjectFilePreview(cacheKey);
  if (cached) return cached;

  const pending = projectFilePreviewLoads.get(cacheKey);
  if (pending) return pending;

  const load = (async () => {
    let variants: ProjectFileImageVariantMetadata[] = [];
    try {
      variants = await imageVariantRepository.listImageVariants({
        workspaceId,
        projectId,
        fileId,
      });
    } catch {
      // Derived images are an optional cache; the source remains the fallback.
    }

    const preferred = chooseProjectFilePreviewVariant(variants, targetMaxEdge);
    if (preferred) {
      try {
        const variant = await imageVariantRepository.loadImageVariant({
          workspaceId,
          projectId,
          fileId,
          targetMaxEdge: preferred.targetMaxEdge,
        });
        if (variant) {
          cacheProjectFilePreview(cacheKey, variant.blob);
          return variant.blob;
        }
      } catch {
        // A stale derivative must never make the original unavailable.
      }
    }

    const original = await repository.downloadFile({
      workspaceId,
      projectId,
      fileId,
    });
    cacheProjectFilePreview(cacheKey, original.blob);
    return original.blob;
  })();

  projectFilePreviewLoads.set(cacheKey, load);
  try {
    return await load;
  } finally {
    projectFilePreviewLoads.delete(cacheKey);
  }
}

export function FilesWorkspace({
  workspaceId,
  projectId,
  projectName,
}: FilesWorkspaceProps): React.JSX.Element {
  const { repository, imageVariantRepository } = useMemo(() => {
    const env = getPublicEnv();
    const supabase = createClient();
    return {
      repository: new SupabaseProjectFileRepository({
        supabase,
        resumableUploadEndpoint: projectFileResumableUploadEndpoint(
          env.NEXT_PUBLIC_SUPABASE_URL,
        ),
      }),
      imageVariantRepository: new SupabaseProjectFileImageVariantRepository(
        supabase,
      ),
    };
  }, []);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const resumeTargetFileRef = useRef<ProjectFileRecord | null>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const [folders, setFolders] = useState<ProjectFolderRecord[]>([]);
  const [files, setFiles] = useState<ProjectFileRecord[]>([]);
  const [pendingFiles, setPendingFiles] = useState<ProjectFileRecord[]>([]);
  const [location, setLocation] = useState<FilesLocation>({ kind: "inbox" });
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [openedFileId, setOpenedFileId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<FilesViewMode>("list");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<FilesLoadStatus>("loading");
  const [reloadToken, setReloadToken] = useState(0);
  const [actionState, setActionState] = useState<FilesActionState>("idle");
  const [actionMessage, setActionMessage] = useState<FilesActionMessage | null>(
    null,
  );
  const [activeUpload, setActiveUpload] =
    useState<ActiveProjectFileUpload | null>(null);
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
    const pendingFilesPromise =
      location.kind === "trash" || trimmedQuery
        ? Promise.resolve<ProjectFileRecord[]>([])
        : repository.listPendingFiles({
            ...scope,
            folderId: activeFolderId,
          });

    void Promise.all([
      repository.listFolders(scope),
      filesPromise,
      pendingFilesPromise,
    ])
      .then(([nextFolders, nextFiles, nextPendingFiles]) => {
        if (cancelled) return;
        setFolders(nextFolders);
        setFiles(nextFiles);
        setPendingFiles(nextPendingFiles);
        setSelectedFileId((currentFileId) =>
          currentFileId && nextFiles.some((file) => file.id === currentFileId)
            ? currentFileId
            : null,
        );
        setOpenedFileId((currentFileId) =>
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
        setPendingFiles([]);
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
  const openedFile = files.find((file) => file.id === openedFileId) ?? null;
  const viewerFiles = useMemo(
    () => files.filter(isProjectFilePreviewable),
    [files],
  );
  const folderTree = getProjectFolderTree(folders);
  const title = query.trim()
    ? "Результаты поиска"
    : location.kind === "inbox"
      ? "Входящие"
      : location.kind === "trash"
        ? "Корзина"
        : (activeFolder?.name ?? "Папка");
  const hasEntries = files.length > 0 || pendingFiles.length > 0;
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

  const uploadFiles = async (
    browserFiles: readonly File[],
    resumeFile?: ProjectFileRecord,
  ) => {
    if (!workspaceId || !canMutate || browserFiles.length === 0) return;
    if (resumeFile && browserFiles.length !== 1) return;

    setActionState("uploading");
    setActionMessage({
      kind: "info",
      text: resumeFile
        ? `Продолжение загрузки: ${resumeFile.name}…`
        : browserFiles.length === 1
          ? "Загрузка файла…"
          : `Загрузка файлов: ${browserFiles.length}…`,
    });

    let completedCount = 0;
    try {
      let lastUploadedFile: ProjectFileRecord | null = null;
      for (const [index, browserFile] of browserFiles.entries()) {
        const prepared = await prepareProjectFileBrowserUpload(browserFile);
        if (
          resumeFile &&
          (resumeFile.name !== prepared.name ||
            resumeFile.originalName !== prepared.originalName ||
            resumeFile.byteSize !== prepared.byteSize ||
            resumeFile.mimeType !== prepared.mimeType ||
            resumeFile.width !== prepared.width ||
            resumeFile.height !== prepared.height)
        ) {
          throw new ProjectFileBrowserUploadError(
            "Выберите тот же исходный файл, загрузка которого была прервана.",
          );
        }
        const transport = projectFileUploadTransport(prepared.byteSize);
        const abortController = new AbortController();
        uploadAbortControllerRef.current = abortController;
        setActiveUpload({
          fileName: prepared.name,
          currentFile: index + 1,
          totalFiles: browserFiles.length,
          percentage: 0,
          transport,
          resumed: false,
          retryAttempt: 0,
        });

        const uploaded = await repository.uploadFile({
          workspaceId,
          projectId,
          ...(resumeFile ? { fileId: resumeFile.id } : {}),
          folderId: resumeFile ? resumeFile.folderId : activeFolderId,
          ...prepared,
          signal: abortController.signal,
          onProgress: (progress) => {
            setActiveUpload((current) =>
              current
                ? {
                    ...current,
                    percentage: progress.percentage,
                    transport: progress.transport,
                  }
                : current,
            );
          },
          onResume: () => {
            setActiveUpload((current) =>
              current ? { ...current, resumed: true } : current,
            );
          },
          onRetry: (retryAttempt) => {
            setActiveUpload((current) =>
              current ? { ...current, retryAttempt } : current,
            );
          },
        });
        await generateAndStoreProjectFileImageVariantsBestEffort({
          repository: imageVariantRepository,
          file: uploaded,
          sourceBlob: prepared.blob,
          signal: abortController.signal,
        });
        completedCount += 1;
        lastUploadedFile = uploaded;
        if (resumeFile) {
          setPendingFiles((current) =>
            current.filter((file) => file.id !== resumeFile.id),
          );
        }
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
      if (
        cause instanceof CloudProjectFileRepositoryError &&
        cause.code === "cancelled"
      ) {
        setActionMessage({
          kind: "info",
          text:
            completedCount === 0
              ? "Загрузка отменена."
              : `Загрузка остановлена. Загружено файлов: ${completedCount}.`,
        });
      } else {
        setActionMessage({
          kind: "error",
          text: projectFileUploadErrorMessage(cause),
        });
      }
    } finally {
      uploadAbortControllerRef.current = null;
      setActiveUpload(null);
      setActionState("idle");
    }
  };

  const cancelActiveUpload = () => {
    uploadAbortControllerRef.current?.abort();
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

  const selectFile = (fileId: string) => {
    setSelectedFileId(fileId);
  };

  const openFile = (file: ProjectFileRecord) => {
    if (!isProjectFilePreviewable(file)) return;
    setSelectedFileId(file.id);
    setOpenedFileId(file.id);
  };

  const navigateViewer = (delta: -1 | 1) => {
    const currentIndex = viewerFiles.findIndex(
      (file) => file.id === openedFileId,
    );
    const nextFile = viewerFiles[currentIndex + delta];
    if (!nextFile) return;
    setSelectedFileId(nextFile.id);
    setOpenedFileId(nextFile.id);
  };

  const activateFile = (file: ProjectFileRecord) => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches &&
      isProjectFilePreviewable(file)
    ) {
      openFile(file);
      return;
    }
    selectFile(file.id);
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
          <input
            ref={resumeInputRef}
            accept={PROJECT_FILE_MIME_TYPES.join(",")}
            aria-label="Выбрать исходный файл для продолжения"
            className={styles.hiddenFileInput}
            onChange={(event) => {
              const browserFile = event.currentTarget.files?.[0] ?? null;
              const resumeFile = resumeTargetFileRef.current;
              event.currentTarget.value = "";
              resumeTargetFileRef.current = null;
              if (!browserFile || !resumeFile) return;
              void uploadFiles([browserFile], resumeFile);
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

      <main
        className={`${styles.contentPane} ${
          activeUpload ? styles.contentPaneUploading : ""
        }`}
      >
        <header className={styles.contentHeader}>
          <div className={styles.headingBlock}>
            <h2>{title}</h2>
          </div>
          <div
            className={styles.viewControls}
            aria-label="Вид файлов"
            role="group"
          >
            <IconButton
              icon={<UiIcon name="list" />}
              label="Список"
              onClick={() => setViewMode("list")}
              active={viewMode === "list"}
              title="Список"
              variant="ghost"
            />
            <IconButton
              icon={<UiIcon name="grid" />}
              label="Превью"
              onClick={() => setViewMode("grid")}
              active={viewMode === "grid"}
              title="Превью"
              variant="ghost"
            />
            <IconButton
              icon={<UiIcon name="grid-large" />}
              label="Крупные превью"
              onClick={() => setViewMode("large-grid")}
              active={viewMode === "large-grid"}
              title="Крупные превью"
              variant="ghost"
            />
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

        {activeUpload ? (
          <div
            aria-label="Прогресс загрузки"
            className={styles.uploadProgress}
            role="status"
          >
            <div className={styles.uploadProgressMeta}>
              <strong title={activeUpload.fileName}>
                {activeUpload.fileName}
              </strong>
              <span>
                {activeUpload.totalFiles > 1
                  ? `${activeUpload.currentFile} из ${activeUpload.totalFiles} · `
                  : ""}
                {activeUpload.resumed
                  ? "Продолжение загрузки"
                  : activeUpload.transport === "resumable"
                    ? "Надёжная загрузка"
                    : "Загрузка"}
                {activeUpload.retryAttempt > 0
                  ? ` · повтор ${activeUpload.retryAttempt}`
                  : ""}
              </span>
            </div>
            <progress
              aria-label={`Загрузка ${activeUpload.fileName}`}
              className={styles.uploadProgressTrack}
              max={100}
              value={activeUpload.percentage}
            />
            <span className={styles.uploadProgressPercent}>
              {Math.round(activeUpload.percentage)}%
            </span>
            {activeUpload.transport === "resumable" ? (
              <button
                className={styles.uploadCancelButton}
                onClick={cancelActiveUpload}
                type="button"
              >
                Отменить
              </button>
            ) : null}
          </div>
        ) : null}

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

          {effectiveStatus === "ready" && hasEntries && viewMode === "list" ? (
            <div className={styles.tableWrap}>
              <div className={styles.tableHeader} aria-hidden="true">
                <span>Имя</span>
                <span>Тип</span>
                <span>Размер</span>
                <span>Изменён</span>
              </div>
              <div className={styles.entries}>
                {pendingFiles.map((file) => (
                  <div
                    className={`${styles.entryRow} ${styles.pendingEntryRow}`}
                    key={`pending-${file.id}`}
                  >
                    <span className={styles.nameCell}>
                      <span className={styles.entryIcon} aria-hidden="true">
                        ↻
                      </span>
                      <span className={styles.fileName} title={file.name}>
                        {file.name}
                      </span>
                    </span>
                    <span className={styles.pendingState}>Не завершено</span>
                    <span>{formatProjectFileSize(file.byteSize)}</span>
                    <button
                      className={styles.pendingResumeButton}
                      disabled={!canMutate}
                      onClick={() => {
                        resumeTargetFileRef.current = file;
                        resumeInputRef.current?.click();
                      }}
                      type="button"
                    >
                      Продолжить
                    </button>
                  </div>
                ))}
                {files.map((file) => (
                  <button
                    aria-pressed={file.id === selectedFileId}
                    className={`${styles.entryRow} ${
                      file.id === selectedFileId ? styles.entryRowSelected : ""
                    }`}
                    draggable={canMutate}
                    key={file.id}
                    onClick={() => activateFile(file)}
                    onDoubleClick={() => openFile(file)}
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

          {effectiveStatus === "ready" && hasEntries && viewMode !== "list" ? (
            <div
              className={`${styles.fileGrid} ${
                viewMode === "large-grid" ? styles.fileGridLarge : ""
              }`}
            >
              {pendingFiles.map((file) => (
                <div
                  className={`${styles.fileTile} ${styles.fileTilePending}`}
                  key={`pending-${file.id}`}
                >
                  <span className={styles.tileFallback} aria-hidden="true">
                    ↻
                  </span>
                  <span className={styles.tileName} title={file.name}>
                    {file.name}
                  </span>
                  <span className={styles.tileMeta}>Не завершено</span>
                </div>
              ))}
              {files.map((file) => (
                <button
                  aria-pressed={file.id === selectedFileId}
                  className={`${styles.fileTile} ${
                    file.id === selectedFileId ? styles.fileTileSelected : ""
                  }`}
                  draggable={canMutate}
                  key={file.id}
                  onClick={() => activateFile(file)}
                  onDoubleClick={() => openFile(file)}
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
                  <ProjectFileThumbnail
                    file={file}
                    imageVariantRepository={imageVariantRepository}
                    key={`${file.id}:${viewMode}`}
                    projectId={projectId}
                    repository={repository}
                    targetMaxEdge={viewMode === "large-grid" ? 512 : 256}
                    workspaceId={workspaceId}
                  />
                  <span className={styles.tileName} title={file.name}>
                    {file.name}
                  </span>
                  <span className={styles.tileMeta}>
                    {projectFileTypeLabel(file.mimeType)} ·{" "}
                    {formatProjectFileSize(file.byteSize)}
                  </span>
                </button>
              ))}
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
              onOpen={openFile}
              projectId={projectId}
              repository={repository}
              imageVariantRepository={imageVariantRepository}
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

      {openedFile && workspaceId ? (
        <ProjectFileViewer
          file={openedFile}
          files={viewerFiles}
          key={openedFile.id}
          imageVariantRepository={imageVariantRepository}
          onClose={() => setOpenedFileId(null)}
          onNavigate={navigateViewer}
          projectId={projectId}
          repository={repository}
          workspaceId={workspaceId}
        />
      ) : null}
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

function ProjectFileThumbnail({
  repository,
  imageVariantRepository,
  workspaceId,
  projectId,
  file,
  targetMaxEdge,
}: {
  repository: ProjectFileRepository;
  imageVariantRepository: ProjectFileImageVariantRepository;
  workspaceId?: string;
  projectId: string;
  file: ProjectFileRecord;
  targetMaxEdge: number;
}): React.JSX.Element {
  const targetRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const isImage = file.mimeType.startsWith("image/");
  const aspectRatio = getProjectFileAspectRatio(file);

  useEffect(() => {
    if (!isImage) return;
    const element = targetRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setIsNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setIsNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: "240px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [isImage]);

  useEffect(() => {
    if (!isImage || !isNearViewport || !workspaceId) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const blob = await loadCachedProjectFileImagePreview({
          repository,
          imageVariantRepository,
          workspaceId,
          projectId,
          fileId: file.id,
          targetMaxEdge,
        });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    file.id,
    imageVariantRepository,
    isImage,
    isNearViewport,
    projectId,
    repository,
    targetMaxEdge,
    workspaceId,
  ]);

  return (
    <div
      className={styles.tilePreview}
      ref={targetRef}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {isImage ? (
        imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated variant Blob URL.
          <img alt="" loading="lazy" src={imageUrl} />
        ) : loadError ? (
          <UiIcon name="file" />
        ) : (
          <span className={styles.tileLoading}>Загрузка…</span>
        )
      ) : file.mimeType === "application/pdf" ? (
        <span className={styles.pdfTileBadge}>PDF</span>
      ) : (
        <UiIcon name="file" />
      )}
    </div>
  );
}

function ProjectFileViewer({
  repository,
  imageVariantRepository,
  workspaceId,
  projectId,
  file,
  files,
  onClose,
  onNavigate,
}: {
  repository: ProjectFileRepository;
  imageVariantRepository: ProjectFileImageVariantRepository;
  workspaceId: string;
  projectId: string;
  file: ProjectFileRecord;
  files: readonly ProjectFileRecord[];
  onClose: () => void;
  onNavigate: (delta: -1 | 1) => void;
}): React.JSX.Element {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [usingOriginal, setUsingOriginal] = useState(false);
  const [loadingOriginal, setLoadingOriginal] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const panStartRef = useRef({ x: 0, y: 0 });
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const activeObjectUrlRef = useRef<string | null>(null);
  const isImage = file.mimeType.startsWith("image/");
  const index = files.findIndex((candidate) => candidate.id === file.id);
  const canNavigateBack = index > 0;
  const canNavigateForward = index >= 0 && index < files.length - 1;

  const replaceFileUrl = useCallback((blob: Blob) => {
    const nextUrl = URL.createObjectURL(blob);
    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
    }
    activeObjectUrlRef.current = nextUrl;
    setFileUrl(nextUrl);
  }, []);

  const resetImageViewport = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        if (isImage) {
          let variants: ProjectFileImageVariantMetadata[] = [];
          try {
            variants = await imageVariantRepository.listImageVariants({
              workspaceId,
              projectId,
              fileId: file.id,
            });
          } catch {
            // A derivative is a cache. A ready source remains the fallback.
          }
          const preview = chooseProjectFilePreviewVariant(variants, 2048);
          if (preview) {
            try {
              const variant = await imageVariantRepository.loadImageVariant({
                workspaceId,
                projectId,
                fileId: file.id,
                targetMaxEdge: preview.targetMaxEdge,
              });
              if (cancelled) return;
              if (variant) {
                replaceFileUrl(variant.blob);
                setUsingOriginal(false);
                return;
              }
            } catch {
              // Stale derivative: use the immutable original below.
            }
          }
        }
        const download = await repository.downloadFile({
          workspaceId,
          projectId,
          fileId: file.id,
        });
        if (cancelled) return;
        replaceFileUrl(download.blob);
        setUsingOriginal(true);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (activeObjectUrlRef.current) {
        URL.revokeObjectURL(activeObjectUrlRef.current);
        activeObjectUrlRef.current = null;
      }
    };
  }, [
    file.id,
    imageVariantRepository,
    isImage,
    projectId,
    replaceFileUrl,
    repository,
    workspaceId,
  ]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onNavigate(-1);
      if (event.key === "ArrowRight") onNavigate(1);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, onNavigate]);

  const loadOriginal = async () => {
    if (usingOriginal || loadingOriginal) return;
    setLoadingOriginal(true);
    try {
      const download = await repository.downloadFile({
        workspaceId,
        projectId,
        fileId: file.id,
      });
      replaceFileUrl(download.blob);
      setUsingOriginal(true);
    } finally {
      setLoadingOriginal(false);
    }
  };

  const updateZoom = (nextZoom: number) => {
    const clampedZoom = Math.min(4, Math.max(1, nextZoom));
    setZoom(clampedZoom);
    if (clampedZoom === 1) setPan({ x: 0, y: 0 });
  };

  const updatePointer = (event: React.PointerEvent<HTMLImageElement>) => {
    activePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
  };

  const pointerDistance = () => {
    const [first, second] = [...activePointersRef.current.values()];
    if (!first || !second) return null;
    return Math.hypot(second.x - first.x, second.y - first.y);
  };

  return (
    <div
      className={styles.viewerBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="project-file-viewer-title"
        aria-modal="true"
        className={styles.viewerDialog}
        role="dialog"
      >
        <div className={styles.viewerStage}>
          <div className={styles.viewerContent}>
            {fileUrl && isImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- original is an authenticated Blob URL.
              <img
                alt={file.name}
                className={styles.viewerImage}
                draggable={false}
                onDoubleClick={() => updateZoom(zoom === 1 ? 2 : 1)}
                onPointerDown={(event) => {
                  updatePointer(event);
                  event.currentTarget.setPointerCapture(event.pointerId);
                  if (activePointersRef.current.size === 2) {
                    const distance = pointerDistance();
                    if (distance !== null)
                      pinchRef.current = { distance, zoom };
                    return;
                  }
                  if (zoom === 1) return;
                  pointerStartRef.current = {
                    x: event.clientX,
                    y: event.clientY,
                  };
                  panStartRef.current = pan;
                }}
                onPointerMove={(event) => {
                  updatePointer(event);
                  if (
                    activePointersRef.current.size === 2 &&
                    pinchRef.current
                  ) {
                    const distance = pointerDistance();
                    if (distance !== null) {
                      updateZoom(
                        pinchRef.current.zoom *
                          (distance / pinchRef.current.distance),
                      );
                    }
                    return;
                  }
                  const start = pointerStartRef.current;
                  if (!start || zoom === 1) return;
                  setPan({
                    x: panStartRef.current.x + event.clientX - start.x,
                    y: panStartRef.current.y + event.clientY - start.y,
                  });
                }}
                onPointerUp={(event) => {
                  activePointersRef.current.delete(event.pointerId);
                  if (activePointersRef.current.size < 2)
                    pinchRef.current = null;
                  pointerStartRef.current = null;
                }}
                onPointerCancel={(event) => {
                  activePointersRef.current.delete(event.pointerId);
                  if (activePointersRef.current.size < 2)
                    pinchRef.current = null;
                  pointerStartRef.current = null;
                }}
                onWheel={(event) => {
                  event.preventDefault();
                  updateZoom(zoom + (event.deltaY < 0 ? 0.2 : -0.2));
                }}
                src={fileUrl}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                }}
              />
            ) : fileUrl ? (
              <iframe src={fileUrl} title={file.name} />
            ) : loadError ? (
              <div className={styles.viewerState} role="alert">
                Не удалось открыть файл. Попробуйте ещё раз.
              </div>
            ) : (
              <div className={styles.viewerState} role="status">
                Открываем файл…
              </div>
            )}
          </div>
          <IconButton
            className={styles.viewerNavigationBack}
            disabled={!canNavigateBack}
            icon={<UiIcon name="arrow-left" />}
            label="Предыдущий файл"
            onClick={() => onNavigate(-1)}
            title="Предыдущий файл"
            variant="ghost"
          />
          <IconButton
            className={styles.viewerNavigationForward}
            disabled={!canNavigateForward}
            icon={<UiIcon name="arrow-right" />}
            label="Следующий файл"
            onClick={() => onNavigate(1)}
            title="Следующий файл"
            variant="ghost"
          />
          {fileUrl && isImage ? (
            <div className={styles.viewerZoomControls}>
              <PrototypeButton
                aria-label="Уменьшить масштаб"
                disabled={zoom <= 1}
                onClick={() => updateZoom(zoom - 0.25)}
                size="compact"
                variant="quiet"
              >
                −
              </PrototypeButton>
              <button
                className={styles.viewerZoomValue}
                onClick={() => resetImageViewport()}
                type="button"
              >
                {Math.round(zoom * 100)}%
              </button>
              <PrototypeButton
                aria-label="Увеличить масштаб"
                disabled={zoom >= 4}
                onClick={() => updateZoom(zoom + 0.25)}
                size="compact"
                variant="quiet"
              >
                +
              </PrototypeButton>
            </div>
          ) : null}
        </div>
        <aside className={styles.viewerInfoPanel}>
          <div className={styles.viewerInfoHeader}>
            <span>
              {index >= 0 ? `${index + 1} из ${files.length}` : "Файл"}
            </span>
            <IconButton
              className={styles.viewerCloseButton}
              icon={<UiIcon name="close" />}
              label="Закрыть просмотр"
              onClick={onClose}
              title="Закрыть"
              variant="ghost"
            />
          </div>
          <div className={styles.viewerInfoBody}>
            <h2 id="project-file-viewer-title">{file.name}</h2>
            <dl className={styles.viewerMetadata}>
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
          </div>
          {isImage && !usingOriginal ? (
            <div className={styles.viewerInfoActions}>
              <PrototypeButton
                disabled={loadingOriginal}
                onClick={() => void loadOriginal()}
                size="compact"
                variant="quiet"
              >
                {loadingOriginal ? "Загрузка оригинала…" : "Открыть оригинал"}
              </PrototypeButton>
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}

function ProjectFilePreview({
  repository,
  imageVariantRepository,
  workspaceId,
  projectId,
  file,
  folders,
  canMutate,
  onRename,
  onMove,
  onDelete,
  onOpen,
}: {
  repository: ProjectFileRepository;
  imageVariantRepository: ProjectFileImageVariantRepository;
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
  onOpen: (file: ProjectFileRecord) => void;
}): React.JSX.Element {
  const [loadError, setLoadError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [downloadingOriginal, setDownloadingOriginal] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(file.name);
  const [targetFolderId, setTargetFolderId] = useState(file.folderId ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isImage = file.mimeType.startsWith("image/");

  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const blob = await loadCachedProjectFileImagePreview({
          repository,
          imageVariantRepository,
          workspaceId,
          projectId,
          fileId: file.id,
          targetMaxEdge: PROJECT_FILE_PREVIEW_PREFERRED_MAX_EDGE,
        });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    file.id,
    imageVariantRepository,
    isImage,
    projectId,
    repository,
    workspaceId,
  ]);

  const downloadOriginal = async () => {
    if (downloadingOriginal) return;
    setDownloadingOriginal(true);
    try {
      const download = await repository.downloadFile({
        workspaceId,
        projectId,
        fileId: file.id,
      });
      const objectUrl = URL.createObjectURL(download.blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = file.originalName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloadingOriginal(false);
    }
  };

  return (
    <div className={styles.previewContent}>
      <div className={styles.previewPlaceholder}>
        {isImage ? (
          imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview uses a local authenticated Blob URL.
            <img
              alt={file.name}
              className={styles.previewImage}
              src={imageUrl}
            />
          ) : loadError ? (
            <span className={styles.previewState}>Предпросмотр недоступен</span>
          ) : (
            <span className={styles.previewState}>Загрузка предпросмотра…</span>
          )
        ) : (
          <UiIcon name="file" />
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
          disabled={downloadingOriginal}
          onClick={() => void downloadOriginal()}
          size="compact"
          variant="default"
        >
          {downloadingOriginal ? "Скачивание…" : "Скачать оригинал"}
        </PrototypeButton>
        {isProjectFilePreviewable(file) ? (
          <PrototypeButton
            onClick={() => onOpen(file)}
            size="compact"
            variant="quiet"
          >
            Открыть
          </PrototypeButton>
        ) : null}
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
        {confirmingDelete ? (
          <>
            <span className={styles.previewState}>
              Переместить файл в корзину?
            </span>
            <PrototypeButton
              disabled={!canMutate}
              onClick={() => void onDelete(file)}
              size="compact"
              variant="default"
            >
              Да, в корзину
            </PrototypeButton>
            <PrototypeButton
              onClick={() => setConfirmingDelete(false)}
              size="compact"
              variant="quiet"
            >
              Отмена
            </PrototypeButton>
          </>
        ) : (
          <PrototypeButton
            disabled={!canMutate}
            onClick={() => setConfirmingDelete(true)}
            size="compact"
            variant="quiet"
          >
            <UiIcon name="trash" />
            <span>В корзину</span>
          </PrototypeButton>
        )}
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

export function isProjectFilePreviewable(
  file: Pick<ProjectFileRecord, "mimeType">,
): boolean {
  return (
    file.mimeType.startsWith("image/") || file.mimeType === "application/pdf"
  );
}

export function getProjectFileAspectRatio(
  file: Pick<ProjectFileRecord, "width" | "height">,
): number | null {
  if (
    file.width === null ||
    file.height === null ||
    file.width <= 0 ||
    file.height <= 0
  ) {
    return null;
  }
  return file.width / file.height;
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
