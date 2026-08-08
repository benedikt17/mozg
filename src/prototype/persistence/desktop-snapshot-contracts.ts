/**
 * Historical Desktop Snapshot contracts.
 *
 * These types intentionally do not extend the current prototype domain types.
 * V1 and V2 are shipped persistent formats; adding a persisted field requires
 * a new schema version instead of silently changing one of these contracts.
 *
 * The optional document/task fields below reflect the V1/V2 payloads accepted
 * by the current application and database compatibility path. They are kept
 * explicit here so future runtime-model changes cannot widen old snapshots.
 */

export type DesktopSnapshotTaskSignal = "none" | "green" | "yellow" | "red";
export type DesktopSnapshotEntityKind = "system" | "user";

export type DesktopSnapshotProject = {
  id: string;
  name: string;
  shortName: string;
  description: string;
};

export type DesktopSnapshotOverviewDirection = {
  id: string;
  projectId: string;
  title: string;
  order: number;
};

export type DesktopSnapshotTaskGroup = {
  id: string;
  projectId: string;
  title: string;
  order: number;
  kind: DesktopSnapshotEntityKind;
};

export type DesktopSnapshotTaskList = {
  id: string;
  projectId: string;
  groupId: string;
  title: string;
  order: number;
  kind: DesktopSnapshotEntityKind;
  overviewDirectionId?: string;
};

export type DesktopSnapshotTaskLink = {
  id: string;
  title: string;
  url: string;
};

export type DesktopSnapshotSubtaskV1 = {
  id: string;
  title: string;
  done: boolean;
};

export type DesktopSnapshotSubtaskV2 = DesktopSnapshotSubtaskV1 & {
  detailsMarkdown: string;
};

type DesktopSnapshotTaskFields = {
  id: string;
  projectId: string;
  title: string;
  overviewDirectionId: string;
  overviewOrder: number;
  taskListOrder: number;
  listId: string;
  showOnOverview: boolean;
  completedAt: string | null;
  signal: DesktopSnapshotTaskSignal;
  starred: boolean;
  myDay: boolean;
  area?: string;
  dueDate?: string;
  links: DesktopSnapshotTaskLink[];
  linkedDocumentIds: string[];
  notes?: string;
};

export type DesktopSnapshotTaskV1 = DesktopSnapshotTaskFields & {
  subtasks: DesktopSnapshotSubtaskV1[];
};

export type DesktopSnapshotTaskV2 = DesktopSnapshotTaskFields & {
  subtasks: DesktopSnapshotSubtaskV2[];
};

export type DesktopSnapshotKnowledgeFolder = {
  id: string;
  projectId: string;
  path: string[];
};

export type DesktopSnapshotDocument = {
  id: string;
  projectId: string;
  order?: number;
  folder: string;
  folderPath?: string[];
  deletedAt?: string;
  isKeyDocument?: boolean;
  title: string;
  excerpt: string;
  content: string[];
  linkedTaskIds: string[];
  backlinks: string[];
};

export type DesktopDomainSnapshotV1 = {
  schemaVersion: 1;
  projects: DesktopSnapshotProject[];
  overviewDirections: DesktopSnapshotOverviewDirection[];
  taskGroups: DesktopSnapshotTaskGroup[];
  taskLists: DesktopSnapshotTaskList[];
  tasks: DesktopSnapshotTaskV1[];
  knowledgeFolders: DesktopSnapshotKnowledgeFolder[];
  documents: DesktopSnapshotDocument[];
};

export type DesktopDomainSnapshotV2 = {
  schemaVersion: 2;
  projects: DesktopSnapshotProject[];
  overviewDirections: DesktopSnapshotOverviewDirection[];
  taskGroups: DesktopSnapshotTaskGroup[];
  taskLists: DesktopSnapshotTaskList[];
  tasks: DesktopSnapshotTaskV2[];
  knowledgeFolders: DesktopSnapshotKnowledgeFolder[];
  documents: DesktopSnapshotDocument[];
};
