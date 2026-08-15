import type { ProjectFileScope } from "./project-file-repository";

const PROJECT_FILE_SEARCH_INDEX_BATCH = 24;

const inFlightScopeIndexes = new Map<string, Promise<void>>();
const completedScopeIndexes = new Set<string>();

function scopeKey(scope: ProjectFileScope): string {
  return `${scope.workspaceId}:${scope.projectId}`;
}

type ProjectFileSearchIndexResponse = {
  attempted: number;
  indexed: number;
  failures: Array<{ fileId: string; reason: string }>;
  readOnly: boolean;
};

async function requestIndex(body: {
  workspaceId: string;
  projectId: string;
  fileId?: string;
  limit?: number;
}): Promise<ProjectFileSearchIndexResponse> {
  const response = await fetch("/api/files/search/index", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `Project file search indexing failed with ${response.status}.`,
    );
  }
  return (await response.json()) as ProjectFileSearchIndexResponse;
}

async function completeProjectFileSearchIndex(
  scope: ProjectFileScope,
): Promise<boolean> {
  while (true) {
    const result = await requestIndex({
      ...scope,
      limit: PROJECT_FILE_SEARCH_INDEX_BATCH,
    });

    if (result.readOnly) return true;
    if (result.attempted === 0) return true;

    const retryableFailures =
      result.failures.length > 0 && result.indexed < result.attempted;
    if (retryableFailures) return false;
    if (result.attempted < PROJECT_FILE_SEARCH_INDEX_BATCH) return true;
  }
}

export function ensureProjectFileSearchIndex(
  scope: ProjectFileScope,
): Promise<void> {
  const key = scopeKey(scope);
  if (completedScopeIndexes.has(key)) return Promise.resolve();

  const existing = inFlightScopeIndexes.get(key);
  if (existing) return existing;

  const pending = completeProjectFileSearchIndex(scope)
    .then((complete) => {
      if (complete) completedScopeIndexes.add(key);
    })
    .finally(() => {
      if (inFlightScopeIndexes.get(key) === pending) {
        inFlightScopeIndexes.delete(key);
      }
    });
  inFlightScopeIndexes.set(key, pending);
  return pending;
}

export async function indexProjectFileForSearch(
  input: ProjectFileScope & { fileId: string },
): Promise<void> {
  const key = scopeKey(input);
  const wasComplete = completedScopeIndexes.delete(key);
  const result = await requestIndex(input);
  if (wasComplete && result.indexed === 1 && result.failures.length === 0) {
    completedScopeIndexes.add(key);
  }
}
