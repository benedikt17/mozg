import type { ProjectFileScope } from "./project-file-repository";

const inFlightScopeIndexes = new Map<string, Promise<void>>();

function scopeKey(scope: ProjectFileScope): string {
  return `${scope.workspaceId}:${scope.projectId}`;
}

async function requestIndex(body: {
  workspaceId: string;
  projectId: string;
  fileId?: string;
  limit?: number;
}): Promise<void> {
  const response = await fetch("/api/files/search/index", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Project file search indexing failed with ${response.status}.`);
  }
}

export function ensureProjectFileSearchIndex(
  scope: ProjectFileScope,
): Promise<void> {
  const key = scopeKey(scope);
  const existing = inFlightScopeIndexes.get(key);
  if (existing) return existing;

  const pending = requestIndex({ ...scope, limit: 8 }).finally(() => {
    if (inFlightScopeIndexes.get(key) === pending) {
      inFlightScopeIndexes.delete(key);
    }
  });
  inFlightScopeIndexes.set(key, pending);
  return pending;
}

export function indexProjectFileForSearch(
  input: ProjectFileScope & { fileId: string },
): Promise<void> {
  return requestIndex(input);
}
