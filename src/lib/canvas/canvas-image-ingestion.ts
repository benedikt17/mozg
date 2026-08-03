import type {
  CanvasAssetRecord,
  CanvasAssetRepository,
  StoreLocalCanvasImageInput,
} from "@/lib/canvas/local-canvas-repository";

export const CANVAS_IMAGE_INPUT_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const CANVAS_IMAGE_INPUT_MAX_BYTES = 20 * 1024 * 1024;
export const CANVAS_IMAGE_INPUT_MAX_PIXELS = 40_000_000;
export const CANVAS_IMAGE_INPUT_MAX_FILES = 20;
export const CANVAS_IMAGE_LAB_WORKSPACE_ID =
  "__mozg_canvas_image_ingestion_lab__";
export const CANVAS_IMAGE_LAB_DATABASE_NAME = "mozg-canvas-image-ingestion-lab";
export const CANVAS_IMAGE_LAB_MANIFEST_KEY =
  "mozg.canvas-image-ingestion-lab.asset-ids.v1";

export type CanvasImageInputSource = "clipboard" | "drop" | "file-picker";
export type CanvasImageMimeType =
  (typeof CANVAS_IMAGE_INPUT_MIME_TYPES)[number];

export type CanvasImageCandidate = {
  file: File;
  source: CanvasImageInputSource;
  inputIndex: number;
};

export type AcceptedCanvasImage = {
  assetId: string;
  mimeType: CanvasImageMimeType;
  byteSize: number;
  width: number;
  height: number;
  source: CanvasImageInputSource;
};

export type CanvasImageRejectionReason =
  | "unsupported-mime"
  | "too-large"
  | "decode-failed"
  | "too-many-pixels"
  | "empty-file"
  | "repository-failure"
  | "too-many-images";

export type RejectedCanvasImage = {
  fileName: string;
  reason: CanvasImageRejectionReason;
  source: CanvasImageInputSource;
};

export type CanvasImageIngestionResult = {
  accepted: AcceptedCanvasImage[];
  rejected: RejectedCanvasImage[];
};

export type CanvasImageTransferItem = {
  kind?: string;
  type?: string;
  getAsFile?: () => File | null;
};

export type CanvasImageTransferPayload = {
  items?: Iterable<CanvasImageTransferItem> | null;
  files?: Iterable<File> | ArrayLike<File> | null;
  types?: Iterable<string> | null;
};

export type ExtractedCanvasImageTransfer = {
  candidates: CanvasImageCandidate[];
  itemCount: number;
  fileCount: number;
  types: string[];
};

export type DecodeImageDimensions = (
  file: Blob,
) => Promise<{ width: number; height: number }>;

export type CanvasImageIngestionOptions = {
  repository: CanvasAssetRepository;
  workspaceId?: string;
  decodeImageDimensions?: DecodeImageDimensions;
  idGenerator?: () => string;
};

export type ObjectUrlApi = {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
};

export type ObjectUrlRegistry = {
  create: (blob: Blob) => string;
  revoke: (url: string) => void;
  revokeAll: () => void;
  count: () => number;
};

export type CanvasImageLabManifestStore = {
  list: () => string[];
  add: (assetId: string) => void;
  remove: (assetId: string) => void;
  clear: () => void;
};

export type CanvasImageLabRestoredEntry = {
  record: CanvasAssetRecord;
  objectUrl: string;
};

function isSupportedMime(value: unknown): value is CanvasImageMimeType {
  return (
    typeof value === "string" &&
    (CANVAS_IMAGE_INPUT_MIME_TYPES as readonly string[]).includes(value)
  );
}

function asFiles(value: CanvasImageTransferPayload["files"]): File[] {
  if (value === null || value === undefined) return [];
  return Array.from(value as Iterable<File>);
}

function transferTypes(
  payload: CanvasImageTransferPayload,
  items: CanvasImageTransferItem[],
): string[] {
  const values = [
    ...(payload.types ? Array.from(payload.types) : []),
    ...items.map((item) => item.type).filter((type): type is string => !!type),
  ];
  return [...new Set(values)];
}

function uniqueFiles(files: File[]): File[] {
  const seenObjects = new WeakSet<object>();
  const result: File[] = [];
  for (const file of files) {
    if (seenObjects.has(file)) continue;
    seenObjects.add(file);
    result.push(file);
  }
  return result;
}

export function extractCanvasImageTransfer(
  payload: CanvasImageTransferPayload,
  source: CanvasImageInputSource,
): ExtractedCanvasImageTransfer {
  const items = payload.items ? Array.from(payload.items) : [];
  const itemFiles = items
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile?.() ?? null)
    .filter((file): file is File => file !== null);
  const fallbackFiles = asFiles(payload.files);
  // A browser may expose one physical clipboard image through both
  // DataTransfer collections. Treat `items` as canonical whenever it yields
  // a usable image; consult `files` only when it does not.
  const usableItemFiles = itemFiles.filter((file) =>
    isSupportedMime(file.type),
  );
  const files = uniqueFiles(
    usableItemFiles.length > 0 ? usableItemFiles : fallbackFiles,
  );
  return {
    candidates: files.map((file, inputIndex) => ({
      file,
      source,
      inputIndex,
    })),
    itemCount: items.length,
    fileCount: files.length,
    types: transferTypes(payload, items),
  };
}

function defaultDecodeImageDimensions(): DecodeImageDimensions {
  return async (file) => {
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file);
        try {
          return { width: bitmap.width, height: bitmap.height };
        } finally {
          bitmap.close();
        }
      } catch {
        // Fall through to the Object URL + img decoder when available.
      }
    }
    if (
      typeof Image === "undefined" ||
      typeof URL?.createObjectURL !== "function"
    )
      throw new Error("Image decoding is unavailable.");
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      return await new Promise<{ width: number; height: number }>(
        (resolve, reject) => {
          image.onload = () =>
            resolve({ width: image.naturalWidth, height: image.naturalHeight });
          image.onerror = () => reject(new Error("Image decode failed."));
          image.src = url;
        },
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  };
}

function rejection(
  candidate: CanvasImageCandidate,
  reason: CanvasImageRejectionReason,
): RejectedCanvasImage {
  return {
    fileName: candidate.file.name || "(unnamed image)",
    reason,
    source: candidate.source,
  };
}

function inputForRepository(
  candidate: CanvasImageCandidate,
  dimensions: { width: number; height: number },
  options: CanvasImageIngestionOptions,
): StoreLocalCanvasImageInput {
  const mimeType = candidate.file.type;
  if (!isSupportedMime(mimeType)) throw new Error("Unsupported MIME type.");
  return {
    ...(options.idGenerator === undefined ? {} : { id: options.idGenerator() }),
    workspaceId: options.workspaceId ?? CANVAS_IMAGE_LAB_WORKSPACE_ID,
    blob: candidate.file,
    mimeType,
    byteSize: candidate.file.size,
    width: dimensions.width,
    height: dimensions.height,
  };
}

export async function ingestCanvasImageCandidates(
  candidates: readonly CanvasImageCandidate[],
  options: CanvasImageIngestionOptions,
): Promise<CanvasImageIngestionResult> {
  const accepted: AcceptedCanvasImage[] = [];
  const rejected: RejectedCanvasImage[] = [];
  const decode =
    options.decodeImageDimensions ?? defaultDecodeImageDimensions();

  for (const [index, candidate] of candidates.entries()) {
    if (index >= CANVAS_IMAGE_INPUT_MAX_FILES) {
      rejected.push(rejection(candidate, "too-many-images"));
      continue;
    }
    const file = candidate.file;
    if (file.size === 0) {
      rejected.push(rejection(candidate, "empty-file"));
      continue;
    }
    if (file.size > CANVAS_IMAGE_INPUT_MAX_BYTES) {
      rejected.push(rejection(candidate, "too-large"));
      continue;
    }
    if (!isSupportedMime(file.type)) {
      rejected.push(rejection(candidate, "unsupported-mime"));
      continue;
    }
    let dimensions: { width: number; height: number };
    try {
      dimensions = await decode(file);
    } catch {
      rejected.push(rejection(candidate, "decode-failed"));
      continue;
    }
    if (
      !Number.isSafeInteger(dimensions.width) ||
      !Number.isSafeInteger(dimensions.height) ||
      dimensions.width <= 0 ||
      dimensions.height <= 0 ||
      dimensions.width * dimensions.height > CANVAS_IMAGE_INPUT_MAX_PIXELS
    ) {
      rejected.push(rejection(candidate, "too-many-pixels"));
      continue;
    }
    try {
      const record = await options.repository.storeImage(
        inputForRepository(candidate, dimensions, options),
      );
      accepted.push({
        assetId: record.id,
        mimeType: record.mimeType,
        byteSize: record.byteSize,
        width: record.width,
        height: record.height,
        source: candidate.source,
      });
    } catch {
      rejected.push(rejection(candidate, "repository-failure"));
    }
  }
  return { accepted, rejected };
}

export function createObjectUrlRegistry(
  api: ObjectUrlApi = {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
  },
): ObjectUrlRegistry {
  const active = new Set<string>();
  return {
    create(blob) {
      const url = api.createObjectURL(blob);
      active.add(url);
      return url;
    },
    revoke(url) {
      if (!active.delete(url)) return;
      api.revokeObjectURL(url);
    },
    revokeAll() {
      for (const url of active) api.revokeObjectURL(url);
      active.clear();
    },
    count: () => active.size,
  };
}

function safeReadManifest(storage: Storage, key: string): string[] {
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(
        parsed.filter((value): value is string => typeof value === "string"),
      ),
    ];
  } catch {
    return [];
  }
}

function safeWriteManifest(storage: Storage, key: string, ids: string[]): void {
  try {
    storage.setItem(key, JSON.stringify(ids));
  } catch {
    // The laboratory remains usable for the current session if storage is blocked.
  }
}

export function createCanvasImageLabManifestStore(
  storage: Storage = window.localStorage,
  key = CANVAS_IMAGE_LAB_MANIFEST_KEY,
): CanvasImageLabManifestStore {
  let ids = safeReadManifest(storage, key);
  return {
    list: () => [...ids],
    add(assetId) {
      if (ids.includes(assetId)) return;
      ids = [...ids, assetId];
      safeWriteManifest(storage, key, ids);
    },
    remove(assetId) {
      ids = ids.filter((id) => id !== assetId);
      safeWriteManifest(storage, key, ids);
    },
    clear() {
      ids = [];
      safeWriteManifest(storage, key, ids);
    },
  };
}

export async function restoreCanvasImageLabEntries(
  repository: CanvasAssetRepository,
  manifest: CanvasImageLabManifestStore,
  registry: ObjectUrlRegistry,
  workspaceId = CANVAS_IMAGE_LAB_WORKSPACE_ID,
): Promise<CanvasImageLabRestoredEntry[]> {
  const entries: CanvasImageLabRestoredEntry[] = [];
  for (const assetId of manifest.list()) {
    const record = await repository.loadAsset({ workspaceId, assetId });
    if (!record) {
      manifest.remove(assetId);
      continue;
    }
    entries.push({ record, objectUrl: registry.create(record.blob) });
  }
  return entries;
}

export async function removeCanvasImageLabAsset(
  repository: CanvasAssetRepository,
  manifest: CanvasImageLabManifestStore,
  registry: ObjectUrlRegistry,
  entry: { assetId: string; objectUrl: string },
  workspaceId = CANVAS_IMAGE_LAB_WORKSPACE_ID,
): Promise<void> {
  registry.revoke(entry.objectUrl);
  await repository.markAssetDeleted({ workspaceId, assetId: entry.assetId });
  manifest.remove(entry.assetId);
}

export async function clearCanvasImageLabAssets(
  repository: CanvasAssetRepository,
  manifest: CanvasImageLabManifestStore,
  registry: ObjectUrlRegistry,
  entries: readonly { assetId: string; objectUrl: string }[],
  workspaceId = CANVAS_IMAGE_LAB_WORKSPACE_ID,
): Promise<void> {
  for (const entry of entries) {
    registry.revoke(entry.objectUrl);
    await repository.markAssetDeleted({ workspaceId, assetId: entry.assetId });
  }
  manifest.clear();
}

function eventPath(event: Event): unknown[] {
  return typeof event.composedPath === "function"
    ? event.composedPath()
    : [event.target];
}

function isEditableNode(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const node = value as {
    tagName?: string;
    isContentEditable?: boolean;
    contentEditable?: string;
    dataset?: Record<string, string | undefined>;
  };
  return (
    ["INPUT", "TEXTAREA", "SELECT"].includes(
      node.tagName?.toUpperCase() ?? "",
    ) ||
    node.isContentEditable === true ||
    node.contentEditable === "true" ||
    node.dataset?.canvasImageLabEditor === "true"
  );
}

export function eventTouchesEditingSurface(event: Event): boolean {
  const activeElement =
    typeof document === "undefined" ? null : document.activeElement;
  return eventPath(event).some(isEditableNode) || isEditableNode(activeElement);
}

export function eventPathSummary(event: Event): string[] {
  return eventPath(event)
    .slice(0, 6)
    .map((value) => {
      if (!value || typeof value !== "object") return String(value);
      const node = value as {
        tagName?: string;
        id?: string;
        className?: string;
      };
      return (
        [
          node.tagName?.toLowerCase(),
          node.id ? `#${node.id}` : "",
          node.className ? `.${String(node.className).split(" ")[0]}` : "",
        ]
          .filter(Boolean)
          .join("") || "node"
      );
    });
}

export function transferHasFiles(payload: CanvasImageTransferPayload): boolean {
  if (asFiles(payload.files).length > 0) return true;
  return Array.from(payload.items ?? []).some((item) => item.kind === "file");
}

export function transferHasSupportedImage(
  payload: CanvasImageTransferPayload,
): boolean {
  const extracted = extractCanvasImageTransfer(payload, "clipboard");
  return extracted.candidates.some((candidate) =>
    isSupportedMime(candidate.file.type),
  );
}

export function shouldPreventCanvasImagePaste(event: ClipboardEvent): boolean {
  if (eventTouchesEditingSurface(event) || event.clipboardData === null)
    return false;
  return transferHasSupportedImage({
    items: Array.from(event.clipboardData.items),
    files: Array.from(event.clipboardData.files),
    types: Array.from(event.clipboardData.types),
  });
}

export function shouldPreventFileNavigation(
  payload: CanvasImageTransferPayload,
): boolean {
  return transferHasFiles(payload);
}

export function attachCanvasImagePasteListener(
  listener: (event: ClipboardEvent) => void,
): () => void {
  document.addEventListener("paste", listener, true);
  return () => document.removeEventListener("paste", listener, true);
}

export function canvasImageMimeType(value: string): CanvasImageMimeType | null {
  return isSupportedMime(value) ? value : null;
}
