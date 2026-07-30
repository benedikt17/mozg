import { createClient } from "@/lib/supabase/browser";
import {
  DESKTOP_DOMAIN_SCHEMA_VERSION,
  parseDesktopDomainSnapshot,
  type DesktopDomainSnapshot,
} from "@/prototype/persistence/domain-snapshot";
import {
  DesktopPersistenceError,
  type DesktopPersistenceAdapter,
  type DesktopPersistenceLoadResult,
  type DesktopPersistenceSaveResult,
} from "@/prototype/persistence/persistence-adapter";
import type { DesktopCloudBootstrap } from "@/prototype/persistence/cloud-snapshot-bridge";
import type { Database, Json } from "@/lib/supabase/database.types";

type SaveResult =
  Database["public"]["Functions"]["save_workspace_snapshot"]["Returns"][number];

type SaveStatus = "saved" | "conflict";

export class CloudDesktopPersistenceAdapter implements DesktopPersistenceAdapter {
  private readonly bootstrap: DesktopCloudBootstrap;
  private readonly supabase = createClient();

  constructor(bootstrap: DesktopCloudBootstrap) {
    this.bootstrap = bootstrap;
  }

  async loadWorkspace(
    storageKey: string,
  ): Promise<DesktopPersistenceLoadResult> {
    void storageKey;
    return {
      kind: "loaded",
      snapshot: structuredClone(this.bootstrap.snapshot),
      revision: this.bootstrap.revision,
      savedAt: this.bootstrap.updatedAt,
    };
  }

  async initializeWorkspace(): Promise<DesktopPersistenceSaveResult> {
    throw new DesktopPersistenceError(
      "not-initialized",
      "Cloud workspace snapshot is not initialized.",
    );
  }

  async saveWorkspace(
    _storageKey: string,
    snapshot: DesktopDomainSnapshot,
    expectedRevision: number,
  ): Promise<DesktopPersistenceSaveResult> {
    const parsed = parseDesktopDomainSnapshot(snapshot);
    if (!parsed.ok) {
      throw new DesktopPersistenceError(
        "invalid-snapshot",
        "Invalid desktop snapshot.",
        {
          validationErrors: parsed.errors,
        },
      );
    }

    const { data, error } = await this.supabase.rpc("save_workspace_snapshot", {
      target_workspace_id: this.bootstrap.workspaceId,
      target_expected_revision: expectedRevision,
      target_schema_version: DESKTOP_DOMAIN_SCHEMA_VERSION,
      target_snapshot: parsed.snapshot as unknown as Json,
    });
    if (error) {
      if (error.code === "40001") {
        throw new DesktopPersistenceError(
          "conflict",
          "Cloud snapshot revision is stale.",
        );
      }
      if (error.code === "42501" || error.code === "PGRST301") {
        throw new DesktopPersistenceError(
          "unavailable",
          "Cloud workspace is unavailable.",
        );
      }
      if (error.code === "22023") {
        throw new DesktopPersistenceError(
          "invalid-snapshot",
          "Cloud snapshot validation failed.",
        );
      }
      throw new DesktopPersistenceError(
        "unavailable",
        "Cloud snapshot save failed.",
      );
    }
    const result = (data as SaveResult[] | null)?.[0];
    if (
      !result ||
      !["saved", "conflict"].includes(result.status) ||
      !Number.isSafeInteger(result.revision) ||
      result.revision < 1
    ) {
      throw new DesktopPersistenceError(
        "transaction-failed",
        "Cloud snapshot save returned no revision.",
      );
    }
    if ((result.status as SaveStatus) === "conflict") {
      throw new DesktopPersistenceError(
        "conflict",
        "Cloud snapshot revision is stale.",
      );
    }
    return { revision: result.revision, savedAt: new Date().toISOString() };
  }

  close(): void {}
}
