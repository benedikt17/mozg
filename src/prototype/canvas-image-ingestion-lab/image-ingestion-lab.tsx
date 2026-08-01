"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent as ReactDragEvent,
} from "react";
import {
  CANVAS_IMAGE_INPUT_MAX_FILES,
  CANVAS_IMAGE_INPUT_MAX_BYTES,
  CANVAS_IMAGE_INPUT_MAX_PIXELS,
  CANVAS_IMAGE_LAB_DATABASE_NAME,
  CANVAS_IMAGE_LAB_WORKSPACE_ID,
  createCanvasImageLabManifestStore,
  createObjectUrlRegistry,
  eventPathSummary,
  extractCanvasImageTransfer,
  ingestCanvasImageCandidates,
  removeCanvasImageLabAsset,
  restoreCanvasImageLabEntries,
  clearCanvasImageLabAssets,
  attachCanvasImagePasteListener,
  shouldPreventCanvasImagePaste,
  transferHasFiles,
  type CanvasImageCandidate,
  type CanvasImageInputSource,
  type CanvasImageLabManifestStore,
  type ObjectUrlRegistry,
  type RejectedCanvasImage,
} from "@/lib/canvas/canvas-image-ingestion";
import {
  IndexedDbCanvasRepository,
  type CanvasAssetRecord,
} from "@/lib/canvas/local-canvas-repository";
import styles from "./image-ingestion-lab.module.css";

type LabEntry = CanvasAssetRecord & {
  assetId: string;
  objectUrl: string;
  source: CanvasImageInputSource | "restored";
};
type LabEvent = {
  pasteCount: number;
  dragEnterCount: number;
  dragOverCount: number;
  dropCount: number;
  filePickerCount: number;
  lastSource: string;
  eventTarget: string;
  activeElement: string;
  path: string[];
  transferTypes: string[];
  itemCount: number;
  fileCount: number;
  supportedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  rejectionReasons: string[];
  defaultPrevented: boolean;
  dropClient: string;
  storedAssetIds: string[];
  objectUrlCount: number;
  repositoryWrite: string;
  repositoryRead: string;
};

type TransferInfo = {
  event?: Event;
  source: CanvasImageInputSource;
  client?: { x: number; y: number };
  countField?:
    | "pasteCount"
    | "dragEnterCount"
    | "dragOverCount"
    | "dropCount"
    | "filePickerCount";
};

const INITIAL_EVENT: LabEvent = {
  pasteCount: 0,
  dragEnterCount: 0,
  dragOverCount: 0,
  dropCount: 0,
  filePickerCount: 0,
  lastSource: "—",
  eventTarget: "—",
  activeElement: "—",
  path: [],
  transferTypes: [],
  itemCount: 0,
  fileCount: 0,
  supportedCount: 0,
  acceptedCount: 0,
  rejectedCount: 0,
  rejectionReasons: [],
  defaultPrevented: false,
  dropClient: "—",
  storedAssetIds: [],
  objectUrlCount: 0,
  repositoryWrite: "idle",
  repositoryRead: "reading",
};

function targetName(target: EventTarget | null): string {
  if (!target || typeof target !== "object") return "—";
  const value = target as { tagName?: string; id?: string; className?: string };
  return (
    [
      value.tagName?.toLowerCase(),
      value.id ? `#${value.id}` : "",
      value.className ? `.${String(value.className).split(" ")[0]}` : "",
    ]
      .filter(Boolean)
      .join("") || "node"
  );
}

function activeElementName(): string {
  return typeof document === "undefined"
    ? "—"
    : targetName(document.activeElement);
}

function transferPayload(event: ClipboardEvent | globalThis.DragEvent) {
  const transfer =
    "clipboardData" in event ? event.clipboardData : event.dataTransfer;
  return {
    items: transfer ? Array.from(transfer.items) : [],
    files: transfer ? Array.from(transfer.files) : [],
    types: transfer ? Array.from(transfer.types) : [],
  };
}

function resultReasonSummary(rejected: RejectedCanvasImage[]): string[] {
  return [...new Set(rejected.map((item) => item.reason))];
}

export function CanvasImageIngestionLab(): React.JSX.Element {
  const [repository] = useState(
    () =>
      new IndexedDbCanvasRepository({
        databaseName: CANVAS_IMAGE_LAB_DATABASE_NAME,
      }),
  );
  const registryRef = useRef<ObjectUrlRegistry>(createObjectUrlRegistry());
  const manifestRef = useRef<CanvasImageLabManifestStore | null>(null);
  const dropZoneRef = useRef<HTMLDivElement | null>(null);
  const ingestRef = useRef<
    (
      candidates: readonly CanvasImageCandidate[],
      info: TransferInfo,
    ) => Promise<void>
  >(async () => undefined);
  const [entries, setEntries] = useState<LabEntry[]>([]);
  const [lastRejected, setLastRejected] = useState<RejectedCanvasImage[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Preparing isolated laboratory…");
  const [telemetry, setTelemetry] = useState<LabEvent>(INITIAL_EVENT);

  const updateTelemetry = useCallback(
    (event: LabEvent | ((current: LabEvent) => LabEvent)) =>
      setTelemetry((current) =>
        typeof event === "function" ? event(current) : event,
      ),
    [],
  );

  const ingestCandidates = useCallback(
    async (candidates: readonly CanvasImageCandidate[], info: TransferInfo) => {
      const manifest = manifestRef.current;
      if (!manifest) {
        setStatus("Laboratory storage is not ready yet.");
        return;
      }
      setBusy(true);
      const event = info.event;
      const extracted = {
        candidates,
        itemCount: candidates.length,
        fileCount: candidates.length,
        types: candidates.map((candidate) => candidate.file.type),
      };
      updateTelemetry((current) => ({
        ...current,
        ...(info.countField
          ? { [info.countField]: current[info.countField] + 1 }
          : {}),
        lastSource: info.source,
        eventTarget: targetName(event?.target ?? null),
        activeElement: activeElementName(),
        path: event ? eventPathSummary(event) : [],
        transferTypes: extracted.types,
        itemCount: extracted.itemCount,
        fileCount: extracted.fileCount,
        supportedCount: candidates.filter((candidate) =>
          ["image/png", "image/jpeg", "image/webp"].includes(
            candidate.file.type,
          ),
        ).length,
        dropClient: info.client ? `${info.client.x}, ${info.client.y}` : "—",
        repositoryWrite: "writing",
      }));
      const result = await ingestCanvasImageCandidates(candidates, {
        repository,
        workspaceId: CANVAS_IMAGE_LAB_WORKSPACE_ID,
      });
      const newEntries: LabEntry[] = [];
      for (const accepted of result.accepted) {
        const record = await repository.loadAsset({
          workspaceId: CANVAS_IMAGE_LAB_WORKSPACE_ID,
          assetId: accepted.assetId,
        });
        if (!record) continue;
        manifest.add(record.id);
        newEntries.push({
          ...record,
          assetId: record.id,
          objectUrl: registryRef.current.create(record.blob),
          source: accepted.source,
        });
      }
      setEntries((current) => [...current, ...newEntries]);
      setLastRejected(result.rejected);
      updateTelemetry((current) => ({
        ...current,
        acceptedCount: result.accepted.length,
        rejectedCount: result.rejected.length,
        rejectionReasons: resultReasonSummary(result.rejected),
        storedAssetIds: [
          ...current.storedAssetIds,
          ...newEntries.map((entry) => entry.id),
        ],
        objectUrlCount: registryRef.current.count(),
        repositoryWrite: result.rejected.some(
          (item) => item.reason === "repository-failure",
        )
          ? "failed"
          : "ready",
        repositoryRead: "ready",
        defaultPrevented: event?.defaultPrevented ?? false,
      }));
      setStatus(
        `${result.accepted.length} accepted · ${result.rejected.length} rejected`,
      );
      setBusy(false);
    },
    [repository, updateTelemetry],
  );

  useEffect(() => {
    ingestRef.current = ingestCandidates;
  }, [ingestCandidates]);

  useEffect(() => {
    const manifest = createCanvasImageLabManifestStore(window.localStorage);
    manifestRef.current = manifest;
    let cancelled = false;
    void restoreCanvasImageLabEntries(
      repository,
      manifest,
      registryRef.current,
      CANVAS_IMAGE_LAB_WORKSPACE_ID,
    )
      .then((restored) => {
        if (cancelled) return;
        setEntries(
          restored.map(({ record, objectUrl }) => ({
            ...record,
            assetId: record.id,
            objectUrl,
            source: "restored" as const,
          })),
        );
        updateTelemetry((current) => ({
          ...current,
          repositoryRead: "ready",
          storedAssetIds: restored.map(({ record }) => record.id),
          objectUrlCount: registryRef.current.count(),
        }));
        setStatus(
          `Restored ${restored.length} laboratory image${restored.length === 1 ? "" : "s"}.`,
        );
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("Laboratory repository read failed.");
        updateTelemetry((current) => ({
          ...current,
          repositoryRead: "failed",
        }));
      });
    const registry = registryRef.current;
    return () => {
      cancelled = true;
      registry.revokeAll();
      repository.close();
      manifestRef.current = null;
    };
  }, [repository, updateTelemetry]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const payload = transferPayload(event);
      updateTelemetry((current) => ({
        ...current,
        pasteCount: current.pasteCount + 1,
        lastSource: "clipboard",
        eventTarget: targetName(event.target),
        activeElement: activeElementName(),
        path: eventPathSummary(event),
        transferTypes: payload.types,
        itemCount: payload.items.length,
        fileCount: payload.files.length,
      }));
      if (!shouldPreventCanvasImagePaste(event)) return;
      event.preventDefault();
      const extracted = extractCanvasImageTransfer(payload, "clipboard");
      void ingestRef.current(extracted.candidates, {
        event,
        source: "clipboard",
        countField: undefined,
      });
    };
    return attachCanvasImagePasteListener(onPaste);
  }, [updateTelemetry]);

  useEffect(() => {
    const guard = (event: globalThis.DragEvent) => {
      const payload = transferPayload(event);
      if (!transferHasFiles(payload)) return;
      const path = eventPathSummary(event);
      const inside =
        dropZoneRef.current !== null &&
        event.composedPath().includes(dropZoneRef.current);
      if (inside) return;
      event.preventDefault();
      if (event.type === "drop") event.stopPropagation();
      updateTelemetry((current) => ({
        ...current,
        lastSource: "drop outside target",
        eventTarget: targetName(event.target),
        activeElement: activeElementName(),
        path,
        transferTypes: payload.types,
        itemCount: payload.items.length,
        fileCount: payload.files.length,
        rejectionReasons: ["drop outside target"],
        rejectedCount: 1,
        defaultPrevented: event.defaultPrevented,
      }));
    };
    window.addEventListener("dragover", guard, true);
    window.addEventListener("drop", guard, true);
    return () => {
      window.removeEventListener("dragover", guard, true);
      window.removeEventListener("drop", guard, true);
    };
  }, [updateTelemetry]);

  const handleFilePicker = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    const nativeEvent = event.nativeEvent;
    event.currentTarget.value = "";
    const candidates = files.map((file, inputIndex) => ({
      file,
      source: "file-picker" as const,
      inputIndex,
    }));
    void ingestRef.current(candidates, {
      source: "file-picker",
      event: nativeEvent,
      countField: "filePickerCount",
    });
  };

  const dropFiles = (event: ReactDragEvent<HTMLDivElement>) => {
    const payload = transferPayload(event.nativeEvent);
    if (!transferHasFiles(payload)) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      event.dataTransfer.dropEffect = "copy";
    } catch {
      // Some browser automation DataTransfer objects expose a read-only effect.
    }
    setDragActive(false);
    const extracted = extractCanvasImageTransfer(payload, "drop");
    void ingestRef.current(extracted.candidates, {
      source: "drop",
      event: event.nativeEvent,
      client: { x: event.clientX, y: event.clientY },
      countField: "dropCount",
    });
  };

  const clearLaboratory = async () => {
    const manifest = manifestRef.current;
    if (!manifest) return;
    setBusy(true);
    try {
      await clearCanvasImageLabAssets(
        repository,
        manifest,
        registryRef.current,
        entries,
        CANVAS_IMAGE_LAB_WORKSPACE_ID,
      );
      setEntries([]);
      setLastRejected([]);
      updateTelemetry((current) => ({
        ...current,
        storedAssetIds: [],
        objectUrlCount: registryRef.current.count(),
        repositoryWrite: "ready",
      }));
      setStatus("Laboratory cleared; unrelated workspaces were not touched.");
    } catch {
      setStatus("Laboratory cleanup failed.");
      updateTelemetry((current) => ({ ...current, repositoryWrite: "failed" }));
    } finally {
      setBusy(false);
    }
  };

  const removeEntry = async (entry: LabEntry) => {
    const manifest = manifestRef.current;
    if (!manifest) return;
    setBusy(true);
    try {
      await removeCanvasImageLabAsset(
        repository,
        manifest,
        registryRef.current,
        entry,
        CANVAS_IMAGE_LAB_WORKSPACE_ID,
      );
      setEntries((current) =>
        current.filter((candidate) => candidate.assetId !== entry.assetId),
      );
      updateTelemetry((current) => ({
        ...current,
        storedAssetIds: current.storedAssetIds.filter(
          (id) => id !== entry.assetId,
        ),
        objectUrlCount: registryRef.current.count(),
        repositoryWrite: "ready",
      }));
      setStatus(`Removed ${entry.assetId}.`);
    } catch {
      setStatus(`Could not remove ${entry.assetId}.`);
      updateTelemetry((current) => ({ ...current, repositoryWrite: "failed" }));
    } finally {
      setBusy(false);
    }
  };

  const clearTelemetry = () => {
    updateTelemetry({
      ...INITIAL_EVENT,
      objectUrlCount: registryRef.current.count(),
      storedAssetIds: entries.map((entry) => entry.assetId),
    });
    setLastRejected([]);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            Disposable browser boundary · no Canvas engine
          </p>
          <h1>Canvas image ingestion lab</h1>
          <p className={styles.subtitle}>
            A plain React route for proving clipboard, Explorer drop and
            file-picker delivery into the accepted local Blob repository.
          </p>
        </div>
        <span className={styles.badge}>workspace: isolated lab</span>
      </header>

      <section className={styles.layout}>
        <div className={styles.primaryColumn}>
          <div
            ref={dropZoneRef}
            className={`${styles.dropZone} ${dragActive ? styles.dragActive : ""}`}
            data-canvas-image-lab-target="true"
            onDragEnter={(event) => {
              if (!transferHasFiles(transferPayload(event.nativeEvent))) return;
              event.preventDefault();
              setDragActive(true);
              updateTelemetry((current) => ({
                ...current,
                dragEnterCount: current.dragEnterCount + 1,
              }));
            }}
            onDragOver={(event) => {
              if (!transferHasFiles(transferPayload(event.nativeEvent))) return;
              event.preventDefault();
              try {
                event.dataTransfer.dropEffect = "copy";
              } catch {}
              setDragActive(true);
              updateTelemetry((current) => ({
                ...current,
                dragOverCount: current.dragOverCount + 1,
              }));
            }}
            onDragLeave={(event) => {
              if (
                event.relatedTarget &&
                event.currentTarget.contains(event.relatedTarget as Node)
              )
                return;
              setDragActive(false);
            }}
            onDrop={dropFiles}
          >
            <div className={styles.dropIcon} aria-hidden="true">
              ＋
            </div>
            <div>
              <strong>Drop PNG, JPEG or WebP files here</strong>
              <p>
                Explorer drops stay inside this route. Multiple files are
                accepted, validated and stored independently.
              </p>
            </div>
            <label className={styles.fileButton}>
              Choose images
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={handleFilePicker}
              />
            </label>
          </div>

          <div className={styles.instructions}>
            <span>
              <b>Clipboard</b> Win + Shift + S, then Ctrl+V
            </span>
            <span>
              <b>Explorer</b> copy an image, then Ctrl+V where Chrome exposes it
            </span>
            <span>
              <b>Guard</b> unsupported files and outside drops never navigate
              away
            </span>
          </div>

          <div className={styles.galleryHeader}>
            <div>
              <p className={styles.sectionKicker}>Stored laboratory assets</p>
              <h2>
                Gallery <span>{entries.length}</span>
              </h2>
            </div>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => void clearLaboratory()}
              disabled={busy || entries.length === 0}
            >
              Clear laboratory
            </button>
          </div>
          <div className={styles.gallery}>
            {entries.length === 0 ? (
              <div className={styles.emptyGallery}>
                No stored test images yet. Use any of the three input paths
                above.
              </div>
            ) : (
              entries.map((entry) => (
                <article className={styles.card} key={entry.assetId}>
                  <div className={styles.previewFrame}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={entry.objectUrl}
                      alt={`Stored ${entry.assetId}`}
                    />
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardTitle}>
                      <strong>{entry.assetId}</strong>
                      <button
                        type="button"
                        onClick={() => void removeEntry(entry)}
                        disabled={busy}
                        aria-label={`Remove ${entry.assetId}`}
                      >
                        ×
                      </button>
                    </div>
                    <dl>
                      <div>
                        <dt>MIME</dt>
                        <dd>{entry.mimeType}</dd>
                      </div>
                      <div>
                        <dt>bytes</dt>
                        <dd>{entry.byteSize.toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt>dimensions</dt>
                        <dd>
                          {entry.width} × {entry.height}
                        </dd>
                      </div>
                      <div>
                        <dt>source</dt>
                        <dd>{entry.source}</dd>
                      </div>
                    </dl>
                  </div>
                </article>
              ))
            )}
          </div>
          <p className={styles.statusLine} role="status">
            {status}
          </p>
        </div>

        <aside className={styles.telemetryPanel}>
          <div className={styles.telemetryHeader}>
            <div>
              <p className={styles.sectionKicker}>Observable boundary</p>
              <h2>Telemetry</h2>
            </div>
            <button
              className={styles.iconButton}
              type="button"
              onClick={clearTelemetry}
            >
              Clear
            </button>
          </div>
          <div className={styles.telemetryScroll}>
            <TelemetryGroup title="events">
              <TelemetryRow label="paste" value={telemetry.pasteCount} />
              <TelemetryRow
                label="dragenter"
                value={telemetry.dragEnterCount}
              />
              <TelemetryRow label="dragover" value={telemetry.dragOverCount} />
              <TelemetryRow label="drop" value={telemetry.dropCount} />
              <TelemetryRow
                label="file picker"
                value={telemetry.filePickerCount}
              />
              <TelemetryRow label="last source" value={telemetry.lastSource} />
            </TelemetryGroup>
            <TelemetryGroup title="event context">
              <TelemetryRow label="target" value={telemetry.eventTarget} />
              <TelemetryRow label="active" value={telemetry.activeElement} />
              <TelemetryRow
                label="path"
                value={telemetry.path.join(" → ") || "—"}
              />
              <TelemetryRow
                label="types"
                value={telemetry.transferTypes.join(", ") || "—"}
              />
              <TelemetryRow
                label="items / files"
                value={`${telemetry.itemCount} / ${telemetry.fileCount}`}
              />
              <TelemetryRow label="drop client" value={telemetry.dropClient} />
              <TelemetryRow
                label="defaultPrevented"
                value={String(telemetry.defaultPrevented)}
              />
            </TelemetryGroup>
            <TelemetryGroup title="validation">
              <TelemetryRow
                label="supported"
                value={telemetry.supportedCount}
              />
              <TelemetryRow label="accepted" value={telemetry.acceptedCount} />
              <TelemetryRow label="rejected" value={telemetry.rejectedCount} />
              <TelemetryRow
                label="reasons"
                value={telemetry.rejectionReasons.join(", ") || "—"}
              />
              <TelemetryRow
                label="last results"
                value={
                  lastRejected
                    .map((item) => `${item.fileName}: ${item.reason}`)
                    .join(" · ") || "—"
                }
              />
            </TelemetryGroup>
            <TelemetryGroup title="repository / lifecycle">
              <TelemetryRow
                label="workspace"
                value={CANVAS_IMAGE_LAB_WORKSPACE_ID}
              />
              <TelemetryRow
                label="stored IDs"
                value={telemetry.storedAssetIds.join(", ") || "—"}
              />
              <TelemetryRow
                label="active Object URLs"
                value={telemetry.objectUrlCount}
              />
              <TelemetryRow
                label="repository write"
                value={telemetry.repositoryWrite}
              />
              <TelemetryRow
                label="repository read"
                value={telemetry.repositoryRead}
              />
            </TelemetryGroup>
            <div className={styles.contractNote}>
              <strong>Contract</strong>
              <span>
                {CANVAS_IMAGE_INPUT_MAX_FILES} images / paste or drop ·{" "}
                {CANVAS_IMAGE_INPUT_MAX_BYTES / (1024 * 1024)} MB each ·{" "}
                {CANVAS_IMAGE_INPUT_MAX_PIXELS / 1_000_000} MP decoded maximum
              </span>
              <span>
                Original Blobs only; no Base64, data URLs, Canvas nodes or
                engine state.
              </span>
              <span>
                Dedicated IndexedDB database: {CANVAS_IMAGE_LAB_DATABASE_NAME}
              </span>
            </div>
          </div>
        </aside>
      </section>

      <input
        data-canvas-image-lab-editor="true"
        className={styles.testEditor}
        aria-label="Plain text editor guard test"
        placeholder="Paste here remains normal"
      />
    </main>
  );
}

function TelemetryGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className={styles.telemetryGroup}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function TelemetryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className={styles.telemetryRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
