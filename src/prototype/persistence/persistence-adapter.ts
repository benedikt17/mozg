import type {
  DesktopDomainSnapshot,
  DesktopDomainValidationIssue,
} from "@/prototype/persistence/domain-snapshot";

export type DesktopPersistenceLoadResult =
  | { kind: "empty" }
  | {
      kind: "loaded";
      snapshot: DesktopDomainSnapshot;
      revision: number;
      savedAt: string;
    };

export type DesktopPersistenceSaveResult = {
  revision: number;
  savedAt: string;
};

export interface DesktopPersistenceAdapter {
  loadWorkspace(storageKey: string): Promise<DesktopPersistenceLoadResult>;
  loadLatestWorkspace?(
    storageKey: string,
  ): Promise<DesktopPersistenceLoadResult>;
  initializeWorkspace(
    storageKey: string,
    snapshot: DesktopDomainSnapshot,
  ): Promise<DesktopPersistenceSaveResult>;
  saveWorkspace(
    storageKey: string,
    snapshot: DesktopDomainSnapshot,
    expectedRevision: number,
  ): Promise<DesktopPersistenceSaveResult>;
  close(): void;
}

export type DesktopPersistenceErrorCode =
  | "unavailable"
  | "blocked"
  | "corrupt-data"
  | "unsupported-version"
  | "conflict"
  | "not-initialized"
  | "already-initialized"
  | "invalid-storage-key"
  | "invalid-snapshot"
  | "transaction-failed"
  | "unknown";

export type DesktopPersistenceErrorDetails = {
  cause?: unknown;
  validationErrors?: DesktopDomainValidationIssue[];
  expectedRevision?: number;
  actualRevision?: number;
};

export class DesktopPersistenceError extends Error {
  readonly code: DesktopPersistenceErrorCode;
  readonly validationErrors?: DesktopDomainValidationIssue[];
  readonly expectedRevision?: number;
  readonly actualRevision?: number;

  constructor(
    code: DesktopPersistenceErrorCode,
    message: string,
    details: DesktopPersistenceErrorDetails = {},
  ) {
    super(
      message,
      details.cause === undefined ? undefined : { cause: details.cause },
    );
    this.name = "DesktopPersistenceError";
    this.code = code;
    this.validationErrors = details.validationErrors;
    this.expectedRevision = details.expectedRevision;
    this.actualRevision = details.actualRevision;
  }
}
