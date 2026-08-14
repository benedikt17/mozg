import * as tus from "tus-js-client";

import {
  PROJECT_FILES_BUCKET,
  type ProjectFileMimeType,
  type ProjectFileUploadProgress,
} from "./project-file-repository";

export const PROJECT_FILE_TUS_RETRY_DELAYS = [0, 3_000, 5_000, 10_000, 20_000] as const;

export type ProjectFileResumableReservationStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export class ProjectFileUploadCancelledError extends Error {
  constructor() {
    super("Project file upload was cancelled.");
    this.name = "ProjectFileUploadCancelledError";
  }
}

export function projectFileResumableUploadEndpoint(supabaseUrl: string): string {
  const url = new URL(supabaseUrl);
  const suffix = ".supabase.co";
  if (url.protocol === "https:" && url.hostname.endsWith(suffix)) {
    const projectRef = url.hostname.slice(0, -suffix.length);
    if (/^[a-z0-9]+$/i.test(projectRef)) {
      return `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
    }
  }
  return `${url.origin}/storage/v1/upload/resumable`;
}

export function projectFileResumableReservationKey(input: {
  workspaceId: string;
  projectId: string;
  folderId: string | null;
  resumeKey: string;
}): string {
  return [
    "mozg:project-files:resumable:v1",
    input.workspaceId,
    encodeURIComponent(input.projectId),
    input.folderId ?? "inbox",
    encodeURIComponent(input.resumeKey),
  ].join(":");
}

export function projectFileTusFingerprint(input: {
  workspaceId: string;
  fileId: string;
  resumeKey: string;
}): string {
  return [
    "mozg-project-files-v1",
    input.workspaceId,
    input.fileId,
    encodeURIComponent(input.resumeKey),
  ].join(":");
}

export function getProjectFileResumableReservationStorage(): ProjectFileResumableReservationStorage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export async function uploadProjectFileResumable(input: {
  blob: Blob;
  endpoint: string;
  storageKey: string;
  mimeType: ProjectFileMimeType;
  fingerprint: string;
  getAccessToken: () => Promise<string>;
  signal?: AbortSignal;
  onProgress?: (progress: ProjectFileUploadProgress) => void;
  onResume?: () => void;
  onRetry?: (attempt: number) => void;
}): Promise<{ resumed: boolean }> {
  if (!tus.isSupported) {
    throw new Error("This browser does not support resumable uploads.");
  }
  if (input.signal?.aborted) throw new ProjectFileUploadCancelledError();

  return await new Promise<{ resumed: boolean }>((resolve, reject) => {
    let settled = false;
    let resumed = false;

    const finish = (
      outcome:
        | { kind: "resolve"; value: { resumed: boolean } }
        | { kind: "reject"; error: unknown },
    ) => {
      if (settled) return;
      settled = true;
      input.signal?.removeEventListener("abort", cancelUpload);
      if (outcome.kind === "resolve") resolve(outcome.value);
      else reject(outcome.error);
    };

    const upload = new tus.Upload(input.blob, {
      endpoint: input.endpoint,
      retryDelays: [...PROJECT_FILE_TUS_RETRY_DELAYS],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      fingerprint: async () => input.fingerprint,
      metadata: {
        bucketName: PROJECT_FILES_BUCKET,
        objectName: input.storageKey,
        contentType: input.mimeType,
        cacheControl: "3600",
      },
      onBeforeRequest: async (request) => {
        const accessToken = await input.getAccessToken();
        request.setHeader("authorization", `Bearer ${accessToken}`);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        input.onProgress?.({
          transport: "resumable",
          bytesUploaded,
          bytesTotal,
          percentage:
            bytesTotal > 0
              ? Math.min(100, Math.max(0, (bytesUploaded / bytesTotal) * 100))
              : 0,
        });
      },
      onShouldRetry: (error, retryAttempt) => {
        const online =
          typeof navigator === "undefined" || navigator.onLine !== false;
        const status = error.originalResponse?.getStatus() ?? 0;
        const retryable =
          online &&
          (status === 0 || status === 409 || status === 423 || status >= 500);
        if (retryable) input.onRetry?.(retryAttempt + 1);
        return retryable;
      },
      onError: (error) => {
        finish({
          kind: "reject",
          error: input.signal?.aborted
            ? new ProjectFileUploadCancelledError()
            : error,
        });
      },
      onSuccess: () => finish({ kind: "resolve", value: { resumed } }),
    });

    function cancelUpload() {
      if (settled) return;
      void upload
        .abort(true)
        .catch(() => undefined)
        .finally(() =>
          finish({
            kind: "reject",
            error: new ProjectFileUploadCancelledError(),
          }),
        );
    }

    input.signal?.addEventListener("abort", cancelUpload, { once: true });

    void upload
      .findPreviousUploads()
      .then((previousUploads) => {
        if (settled) return;
        if (previousUploads.length > 0) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
          resumed = true;
          input.onResume?.();
        }
        upload.start();
      })
      .catch((error) => finish({ kind: "reject", error }));
  });
}
