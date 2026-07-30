import type {
  PrototypeDocument,
  PrototypeOverviewDirection,
  PrototypeProject,
  PrototypeSubtask,
  PrototypeTask,
  PrototypeTaskGroup,
  PrototypeTaskLink,
  PrototypeTaskList,
} from "@/prototype/desktop-mock-data";
import type {
  DesktopPrototypeState,
  PrototypeKnowledgeFolder,
} from "@/prototype/state/types";

export const DESKTOP_DOMAIN_SCHEMA_VERSION = 1 as const;

export type DesktopDomainSnapshot = {
  schemaVersion: typeof DESKTOP_DOMAIN_SCHEMA_VERSION;
  projects: PrototypeProject[];
  overviewDirections: PrototypeOverviewDirection[];
  taskGroups: PrototypeTaskGroup[];
  taskLists: PrototypeTaskList[];
  tasks: PrototypeTask[];
  knowledgeFolders: PrototypeKnowledgeFolder[];
  documents: PrototypeDocument[];
};

export type DesktopDomainCollections = Omit<
  DesktopDomainSnapshot,
  "schemaVersion"
>;

export type DesktopDomainValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type ParseDesktopDomainSnapshotResult =
  | {
      ok: true;
      snapshot: DesktopDomainSnapshot;
      warnings: DesktopDomainValidationIssue[];
    }
  | { ok: false; errors: DesktopDomainValidationIssue[] };

export type DerivedPrototypeCounters = Pick<
  DesktopPrototypeState,
  | "nextProjectNumber"
  | "nextTaskNumber"
  | "nextTaskGroupNumber"
  | "nextTaskListNumber"
  | "nextDocumentNumber"
  | "nextKnowledgeFolderNumber"
>;

type UnknownRecord = Record<string, unknown>;

function cloneTaskLink(link: PrototypeTaskLink): PrototypeTaskLink {
  return { ...link };
}

function cloneSubtask(subtask: PrototypeSubtask): PrototypeSubtask {
  return { ...subtask };
}

function cloneTask(task: PrototypeTask): PrototypeTask {
  return {
    ...task,
    links: task.links.map(cloneTaskLink),
    linkedDocumentIds: [...task.linkedDocumentIds],
    subtasks: task.subtasks.map(cloneSubtask),
  };
}

function cloneDocument(document: PrototypeDocument): PrototypeDocument {
  return {
    ...document,
    ...(document.folderPath === undefined
      ? {}
      : { folderPath: [...document.folderPath] }),
    content: [...document.content],
    linkedTaskIds: [...document.linkedTaskIds],
    backlinks: [...document.backlinks],
  };
}

function cloneKnowledgeFolder(
  folder: PrototypeKnowledgeFolder,
): PrototypeKnowledgeFolder {
  return { ...folder, path: [...folder.path] };
}

export function createDesktopDomainSnapshot(
  state: DesktopPrototypeState,
): DesktopDomainSnapshot {
  return {
    schemaVersion: DESKTOP_DOMAIN_SCHEMA_VERSION,
    projects: state.projects.map((project) => ({ ...project })),
    overviewDirections: state.overviewDirections.map((direction) => ({
      ...direction,
    })),
    taskGroups: state.taskGroups.map((group) => ({ ...group })),
    taskLists: state.taskLists.map((list) => ({ ...list })),
    tasks: state.tasks.map(cloneTask),
    knowledgeFolders: state.knowledgeFolders.map(cloneKnowledgeFolder),
    documents: state.documents.map(cloneDocument),
  };
}

export function snapshotToDomainCollections(
  snapshot: DesktopDomainSnapshot,
): DesktopDomainCollections {
  return {
    projects: snapshot.projects.map((project) => ({ ...project })),
    overviewDirections: snapshot.overviewDirections.map((direction) => ({
      ...direction,
    })),
    taskGroups: snapshot.taskGroups.map((group) => ({ ...group })),
    taskLists: snapshot.taskLists.map((list) => ({ ...list })),
    tasks: snapshot.tasks.map(cloneTask),
    knowledgeFolders: snapshot.knowledgeFolders.map(cloneKnowledgeFolder),
    documents: snapshot.documents.map(cloneDocument),
  };
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addIssue(
  issues: DesktopDomainValidationIssue[],
  code: string,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function rejectUnknownFields(
  record: UnknownRecord,
  path: string,
  allowedKeys: readonly string[],
  issues: DesktopDomainValidationIssue[],
): void {
  const allowed = new Set(allowedKeys);
  Object.keys(record).forEach((key) => {
    if (allowed.has(key)) return;
    addIssue(
      issues,
      "unknown-field",
      path === "$" ? key : `${path}.${key}`,
      "Field is not part of the desktop snapshot v1 contract.",
    );
  });
}

function readString(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: DesktopDomainValidationIssue[],
  options: { nonEmpty?: boolean; optional?: boolean } = {},
): string | undefined {
  const value = record[key];
  if (value === undefined && options.optional) return undefined;
  if (
    typeof value !== "string" ||
    (options.nonEmpty === true && value.trim().length === 0)
  ) {
    addIssue(issues, "invalid-string", `${path}.${key}`, "Expected a string.");
    return undefined;
  }
  return value;
}

function readBoolean(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: DesktopDomainValidationIssue[],
  optional = false,
): boolean | undefined {
  const value = record[key];
  if (value === undefined && optional) return undefined;
  if (typeof value !== "boolean") {
    addIssue(
      issues,
      "invalid-boolean",
      `${path}.${key}`,
      "Expected a boolean.",
    );
    return undefined;
  }
  return value;
}

function readOrder(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: DesktopDomainValidationIssue[],
  optional = false,
): number | undefined {
  const value = record[key];
  if (value === undefined && optional) return undefined;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    addIssue(
      issues,
      "invalid-order",
      `${path}.${key}`,
      "Expected a non-negative finite integer.",
    );
    return undefined;
  }
  return value;
}

function readStringArray(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: DesktopDomainValidationIssue[],
  options: { nonEmptyItems?: boolean; nonEmptyArray?: boolean } = {},
): string[] | undefined {
  const value = record[key];
  if (!Array.isArray(value)) {
    addIssue(issues, "invalid-array", `${path}.${key}`, "Expected an array.");
    return undefined;
  }
  if (options.nonEmptyArray === true && value.length === 0) {
    addIssue(
      issues,
      "invalid-array",
      `${path}.${key}`,
      "Expected a non-empty array.",
    );
    return undefined;
  }
  const result: string[] = [];
  value.forEach((item, index) => {
    if (
      typeof item !== "string" ||
      (options.nonEmptyItems === true && item.trim().length === 0)
    ) {
      addIssue(
        issues,
        "invalid-string",
        `${path}.${key}[${index}]`,
        "Expected a string.",
      );
      return;
    }
    result.push(item);
  });
  return result.length === value.length ? result : undefined;
}

function readOptionalFolderPath(
  record: UnknownRecord,
  path: string,
  issues: DesktopDomainValidationIssue[],
): string[] | undefined {
  if (record.folderPath === undefined) return undefined;
  return readStringArray(record, "folderPath", path, issues, {
    nonEmptyItems: true,
  });
}

function parseProject(
  value: unknown,
  path: string,
  issues: DesktopDomainValidationIssue[],
): PrototypeProject | undefined {
  if (!isRecord(value)) {
    addIssue(issues, "invalid-record", path, "Expected an object.");
    return undefined;
  }
  rejectUnknownFields(
    value,
    path,
    ["id", "name", "shortName", "description"],
    issues,
  );
  const id = readString(value, "id", path, issues, { nonEmpty: true });
  const name = readString(value, "name", path, issues);
  const shortName = readString(value, "shortName", path, issues);
  const description = readString(value, "description", path, issues);
  return id !== undefined &&
    name !== undefined &&
    shortName !== undefined &&
    description !== undefined
    ? { id, name, shortName, description }
    : undefined;
}

function parseDirection(
  value: unknown,
  path: string,
  issues: DesktopDomainValidationIssue[],
): PrototypeOverviewDirection | undefined {
  if (!isRecord(value)) {
    addIssue(issues, "invalid-record", path, "Expected an object.");
    return undefined;
  }
  rejectUnknownFields(
    value,
    path,
    ["id", "projectId", "title", "order"],
    issues,
  );
  const id = readString(value, "id", path, issues, { nonEmpty: true });
  const projectId = readString(value, "projectId", path, issues, {
    nonEmpty: true,
  });
  const title = readString(value, "title", path, issues);
  const order = readOrder(value, "order", path, issues);
  return id !== undefined &&
    projectId !== undefined &&
    title !== undefined &&
    order !== undefined
    ? { id, projectId, title, order }
    : undefined;
}

function parseKind(
  value: unknown,
  path: string,
  issues: DesktopDomainValidationIssue[],
): "system" | "user" | undefined {
  if (value !== "system" && value !== "user") {
    addIssue(issues, "invalid-enum", path, "Expected system or user.");
    return undefined;
  }
  return value;
}

function parseTaskGroup(
  value: unknown,
  path: string,
  issues: DesktopDomainValidationIssue[],
): PrototypeTaskGroup | undefined {
  if (!isRecord(value)) {
    addIssue(issues, "invalid-record", path, "Expected an object.");
    return undefined;
  }
  rejectUnknownFields(
    value,
    path,
    ["id", "projectId", "title", "order", "kind"],
    issues,
  );
  const id = readString(value, "id", path, issues, { nonEmpty: true });
  const projectId = readString(value, "projectId", path, issues, {
    nonEmpty: true,
  });
  const title = readString(value, "title", path, issues);
  const order = readOrder(value, "order", path, issues);
  const kind = parseKind(value.kind, `${path}.kind`, issues);
  return id !== undefined &&
    projectId !== undefined &&
    title !== undefined &&
    order !== undefined &&
    kind !== undefined
    ? { id, projectId, title, order, kind }
    : undefined;
}

function parseTaskList(
  value: unknown,
  path: string,
  issues: DesktopDomainValidationIssue[],
): PrototypeTaskList | undefined {
  if (!isRecord(value)) {
    addIssue(issues, "invalid-record", path, "Expected an object.");
    return undefined;
  }
  rejectUnknownFields(
    value,
    path,
    [
      "id",
      "projectId",
      "groupId",
      "title",
      "order",
      "kind",
      "overviewDirectionId",
    ],
    issues,
  );
  const id = readString(value, "id", path, issues, { nonEmpty: true });
  const projectId = readString(value, "projectId", path, issues, {
    nonEmpty: true,
  });
  const groupId = readString(value, "groupId", path, issues, {
    nonEmpty: true,
  });
  const title = readString(value, "title", path, issues);
  const order = readOrder(value, "order", path, issues);
  const kind = parseKind(value.kind, `${path}.kind`, issues);
  const overviewDirectionId = readString(
    value,
    "overviewDirectionId",
    path,
    issues,
    { nonEmpty: true, optional: true },
  );
  return id !== undefined &&
    projectId !== undefined &&
    groupId !== undefined &&
    title !== undefined &&
    order !== undefined &&
    kind !== undefined
    ? {
        id,
        projectId,
        groupId,
        title,
        order,
        kind,
        ...(overviewDirectionId === undefined ? {} : { overviewDirectionId }),
      }
    : undefined;
}

function parseTaskLinks(
  value: unknown,
  path: string,
  issues: DesktopDomainValidationIssue[],
): PrototypeTaskLink[] | undefined {
  if (!Array.isArray(value)) {
    addIssue(issues, "invalid-array", path, "Expected an array.");
    return undefined;
  }
  const links = value.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) {
      addIssue(issues, "invalid-record", itemPath, "Expected an object.");
      return undefined;
    }
    rejectUnknownFields(item, itemPath, ["id", "title", "url"], issues);
    const id = readString(item, "id", itemPath, issues, { nonEmpty: true });
    const title = readString(item, "title", itemPath, issues);
    const url = readString(item, "url", itemPath, issues);
    return id !== undefined && title !== undefined && url !== undefined
      ? { id, title, url }
      : undefined;
  });
  return links.every((link) => link !== undefined)
    ? (links as PrototypeTaskLink[])
    : undefined;
}

function parseSubtasks(
  value: unknown,
  path: string,
  issues: DesktopDomainValidationIssue[],
): PrototypeSubtask[] | undefined {
  if (!Array.isArray(value)) {
    addIssue(issues, "invalid-array", path, "Expected an array.");
    return undefined;
  }
  const subtasks = value.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) {
      addIssue(issues, "invalid-record", itemPath, "Expected an object.");
      return undefined;
    }
    rejectUnknownFields(item, itemPath, ["id", "title", "done"], issues);
    const id = readString(item, "id", itemPath, issues, { nonEmpty: true });
    const title = readString(item, "title", itemPath, issues);
    const done = readBoolean(item, "done", itemPath, issues);
    return id !== undefined && title !== undefined && done !== undefined
      ? { id, title, done }
      : undefined;
  });
  return subtasks.every((subtask) => subtask !== undefined)
    ? (subtasks as PrototypeSubtask[])
    : undefined;
}

function parseSignal(
  value: unknown,
  path: string,
  issues: DesktopDomainValidationIssue[],
): PrototypeTask["signal"] | undefined {
  if (!["none", "green", "yellow", "red"].includes(String(value))) {
    addIssue(issues, "invalid-enum", path, "Expected a valid task signal.");
    return undefined;
  }
  return value as PrototypeTask["signal"];
}

function parseTask(
  value: unknown,
  path: string,
  issues: DesktopDomainValidationIssue[],
): PrototypeTask | undefined {
  if (!isRecord(value)) {
    addIssue(issues, "invalid-record", path, "Expected an object.");
    return undefined;
  }
  rejectUnknownFields(
    value,
    path,
    [
      "id",
      "projectId",
      "title",
      "overviewDirectionId",
      "overviewOrder",
      "taskListOrder",
      "listId",
      "showOnOverview",
      "completedAt",
      "signal",
      "starred",
      "myDay",
      "area",
      "dueDate",
      "links",
      "linkedDocumentIds",
      "subtasks",
      "notes",
    ],
    issues,
  );
  const id = readString(value, "id", path, issues, { nonEmpty: true });
  const projectId = readString(value, "projectId", path, issues, {
    nonEmpty: true,
  });
  const title = readString(value, "title", path, issues);
  const overviewDirectionId = readString(
    value,
    "overviewDirectionId",
    path,
    issues,
  );
  const overviewOrder = readOrder(value, "overviewOrder", path, issues);
  const taskListOrder = readOrder(value, "taskListOrder", path, issues);
  const listId = readString(value, "listId", path, issues, { nonEmpty: true });
  const showOnOverview = readBoolean(value, "showOnOverview", path, issues);
  const completedAtValue = value.completedAt;
  const completedAt =
    completedAtValue === null || typeof completedAtValue === "string"
      ? completedAtValue
      : undefined;
  if (completedAt === undefined) {
    addIssue(
      issues,
      "invalid-completion",
      `${path}.completedAt`,
      "Expected a string or null.",
    );
  }
  const signal = parseSignal(value.signal, `${path}.signal`, issues);
  const starred = readBoolean(value, "starred", path, issues);
  const myDay = readBoolean(value, "myDay", path, issues);
  const area = readString(value, "area", path, issues, { optional: true });
  const dueDate = readString(value, "dueDate", path, issues, {
    optional: true,
  });
  const links = parseTaskLinks(value.links, `${path}.links`, issues);
  const linkedDocumentIds = readStringArray(
    value,
    "linkedDocumentIds",
    path,
    issues,
    { nonEmptyItems: true },
  );
  const subtasks = parseSubtasks(value.subtasks, `${path}.subtasks`, issues);
  const notes = readString(value, "notes", path, issues, { optional: true });
  if (
    id === undefined ||
    projectId === undefined ||
    title === undefined ||
    overviewDirectionId === undefined ||
    overviewOrder === undefined ||
    taskListOrder === undefined ||
    listId === undefined ||
    showOnOverview === undefined ||
    completedAt === undefined ||
    signal === undefined ||
    starred === undefined ||
    myDay === undefined ||
    links === undefined ||
    linkedDocumentIds === undefined ||
    subtasks === undefined
  ) {
    return undefined;
  }
  return {
    id,
    projectId,
    title,
    overviewDirectionId,
    overviewOrder,
    taskListOrder,
    listId,
    showOnOverview,
    completedAt,
    signal,
    starred,
    myDay,
    ...(area === undefined ? {} : { area }),
    ...(dueDate === undefined ? {} : { dueDate }),
    links,
    linkedDocumentIds,
    subtasks,
    ...(notes === undefined ? {} : { notes }),
  };
}

function parseKnowledgeFolder(
  value: unknown,
  path: string,
  issues: DesktopDomainValidationIssue[],
): PrototypeKnowledgeFolder | undefined {
  if (!isRecord(value)) {
    addIssue(issues, "invalid-record", path, "Expected an object.");
    return undefined;
  }
  rejectUnknownFields(value, path, ["id", "projectId", "path"], issues);
  const id = readString(value, "id", path, issues, { nonEmpty: true });
  const projectId = readString(value, "projectId", path, issues, {
    nonEmpty: true,
  });
  const folderPath = readStringArray(value, "path", path, issues, {
    nonEmptyItems: true,
    nonEmptyArray: true,
  });
  return id !== undefined && projectId !== undefined && folderPath !== undefined
    ? { id, projectId, path: folderPath }
    : undefined;
}

function parseDocument(
  value: unknown,
  path: string,
  issues: DesktopDomainValidationIssue[],
): PrototypeDocument | undefined {
  if (!isRecord(value)) {
    addIssue(issues, "invalid-record", path, "Expected an object.");
    return undefined;
  }
  rejectUnknownFields(
    value,
    path,
    [
      "id",
      "projectId",
      "order",
      "folder",
      "folderPath",
      "isKeyDocument",
      "title",
      "excerpt",
      "content",
      "linkedTaskIds",
      "backlinks",
    ],
    issues,
  );
  const id = readString(value, "id", path, issues, { nonEmpty: true });
  const projectId = readString(value, "projectId", path, issues, {
    nonEmpty: true,
  });
  const order = readOrder(value, "order", path, issues, true);
  const folder = readString(value, "folder", path, issues);
  const folderPath = readOptionalFolderPath(value, path, issues);
  const isKeyDocument = readBoolean(value, "isKeyDocument", path, issues, true);
  const title = readString(value, "title", path, issues);
  const excerpt = readString(value, "excerpt", path, issues);
  const content = readStringArray(value, "content", path, issues);
  const linkedTaskIds = readStringArray(value, "linkedTaskIds", path, issues, {
    nonEmptyItems: true,
  });
  const backlinks = readStringArray(value, "backlinks", path, issues);
  if (
    id === undefined ||
    projectId === undefined ||
    folder === undefined ||
    (value.folderPath !== undefined && folderPath === undefined) ||
    title === undefined ||
    excerpt === undefined ||
    content === undefined ||
    linkedTaskIds === undefined ||
    backlinks === undefined
  ) {
    return undefined;
  }
  return {
    id,
    projectId,
    ...(order === undefined ? {} : { order }),
    folder,
    ...(folderPath === undefined ? {} : { folderPath }),
    ...(isKeyDocument === undefined ? {} : { isKeyDocument }),
    title,
    excerpt,
    content,
    linkedTaskIds,
    backlinks,
  };
}

function parseCollection<T>(
  record: UnknownRecord,
  key: string,
  issues: DesktopDomainValidationIssue[],
  parser: (
    value: unknown,
    path: string,
    issues: DesktopDomainValidationIssue[],
  ) => T | undefined,
): T[] | undefined {
  const value = record[key];
  if (!Array.isArray(value)) {
    addIssue(issues, "invalid-collection", key, "Expected a top-level array.");
    return undefined;
  }
  const parsed = value.map((item, index) =>
    parser(item, `${key}[${index}]`, issues),
  );
  return parsed.every((item) => item !== undefined)
    ? (parsed as T[])
    : undefined;
}

function validateUniqueIds<T extends { id: string }>(
  records: T[],
  path: string,
  issues: DesktopDomainValidationIssue[],
): void {
  const seen = new Set<string>();
  records.forEach((record, index) => {
    if (seen.has(record.id)) {
      addIssue(
        issues,
        "duplicate-id",
        `${path}[${index}].id`,
        `Duplicate ID: ${record.id}.`,
      );
    }
    seen.add(record.id);
  });
}

function validateNestedIds(
  task: PrototypeTask,
  index: number,
  issues: DesktopDomainValidationIssue[],
): void {
  validateUniqueIds(task.links, `tasks[${index}].links`, issues);
  validateUniqueIds(task.subtasks, `tasks[${index}].subtasks`, issues);
  const documentIds = new Set<string>();
  task.linkedDocumentIds.forEach((documentId, documentIndex) => {
    if (documentIds.has(documentId)) {
      addIssue(
        issues,
        "duplicate-id",
        `tasks[${index}].linkedDocumentIds[${documentIndex}]`,
        `Duplicate document relation: ${documentId}.`,
      );
    }
    documentIds.add(documentId);
  });
}

function validateIntegrity(
  snapshot: DesktopDomainSnapshot,
): DesktopDomainValidationIssue[] {
  const issues: DesktopDomainValidationIssue[] = [];
  validateUniqueIds(snapshot.projects, "projects", issues);
  validateUniqueIds(snapshot.overviewDirections, "overviewDirections", issues);
  validateUniqueIds(snapshot.taskGroups, "taskGroups", issues);
  validateUniqueIds(snapshot.taskLists, "taskLists", issues);
  validateUniqueIds(snapshot.tasks, "tasks", issues);
  validateUniqueIds(snapshot.knowledgeFolders, "knowledgeFolders", issues);
  validateUniqueIds(snapshot.documents, "documents", issues);

  const projects = new Set(snapshot.projects.map((project) => project.id));
  const directions = new Map(
    snapshot.overviewDirections.map((direction) => [direction.id, direction]),
  );
  const groups = new Map(snapshot.taskGroups.map((group) => [group.id, group]));
  const lists = new Map(snapshot.taskLists.map((list) => [list.id, list]));
  const tasks = new Map(snapshot.tasks.map((task) => [task.id, task]));
  const documents = new Map(
    snapshot.documents.map((document) => [document.id, document]),
  );

  const requireProject = (projectId: string, path: string): void => {
    if (!projects.has(projectId)) {
      addIssue(
        issues,
        "missing-project",
        path,
        `Missing project: ${projectId}.`,
      );
    }
  };

  snapshot.overviewDirections.forEach((direction, index) =>
    requireProject(
      direction.projectId,
      `overviewDirections[${index}].projectId`,
    ),
  );
  snapshot.taskGroups.forEach((group, index) =>
    requireProject(group.projectId, `taskGroups[${index}].projectId`),
  );
  snapshot.taskLists.forEach((list, index) => {
    requireProject(list.projectId, `taskLists[${index}].projectId`);
    const group = groups.get(list.groupId);
    if (!group) {
      addIssue(
        issues,
        "missing-group",
        `taskLists[${index}].groupId`,
        `Missing group: ${list.groupId}.`,
      );
    } else if (group.projectId !== list.projectId || group.kind !== list.kind) {
      addIssue(
        issues,
        "invalid-list-group",
        `taskLists[${index}].groupId`,
        "List and group must have the same project and kind.",
      );
    }
    const direction = list.overviewDirectionId
      ? directions.get(list.overviewDirectionId)
      : undefined;
    if (list.kind === "system" && !direction) {
      addIssue(
        issues,
        "invalid-overview-link",
        `taskLists[${index}].overviewDirectionId`,
        "System lists require an existing Overview direction.",
      );
    }
    if (list.kind === "user" && list.overviewDirectionId !== undefined) {
      addIssue(
        issues,
        "invalid-overview-link",
        `taskLists[${index}].overviewDirectionId`,
        "User lists cannot reference an Overview direction.",
      );
    }
    if (direction && direction.projectId !== list.projectId) {
      addIssue(
        issues,
        "cross-project-relation",
        `taskLists[${index}].overviewDirectionId`,
        "List and direction must belong to the same project.",
      );
    }
  });

  snapshot.tasks.forEach((task, index) => {
    requireProject(task.projectId, `tasks[${index}].projectId`);
    validateNestedIds(task, index, issues);
    const list = lists.get(task.listId);
    if (!list) {
      addIssue(
        issues,
        "missing-list",
        `tasks[${index}].listId`,
        `Missing list: ${task.listId}.`,
      );
    } else if (list.projectId !== task.projectId) {
      addIssue(
        issues,
        "cross-project-relation",
        `tasks[${index}].listId`,
        "Task and list must belong to the same project.",
      );
    }
    const direction = task.overviewDirectionId
      ? directions.get(task.overviewDirectionId)
      : undefined;
    if (task.overviewDirectionId && !direction) {
      addIssue(
        issues,
        "invalid-overview-link",
        `tasks[${index}].overviewDirectionId`,
        "Task references a missing Overview direction.",
      );
    } else if (direction && direction.projectId !== task.projectId) {
      addIssue(
        issues,
        "cross-project-relation",
        `tasks[${index}].overviewDirectionId`,
        "Task and direction must belong to the same project.",
      );
    }
    if (
      task.showOnOverview &&
      (!list ||
        list.kind !== "system" ||
        !direction ||
        list.overviewDirectionId !== direction.id)
    ) {
      addIssue(
        issues,
        "invalid-overview-link",
        `tasks[${index}].showOnOverview`,
        "Overview tasks require a matching system list and direction.",
      );
    }
    task.linkedDocumentIds.forEach((documentId, documentIndex) => {
      const document = documents.get(documentId);
      if (!document) {
        addIssue(
          issues,
          "missing-document",
          `tasks[${index}].linkedDocumentIds[${documentIndex}]`,
          `Missing document: ${documentId}.`,
        );
      } else if (document.projectId !== task.projectId) {
        addIssue(
          issues,
          "cross-project-relation",
          `tasks[${index}].linkedDocumentIds[${documentIndex}]`,
          "Task and document must belong to the same project.",
        );
      }
    });
  });

  const folderPaths = new Set<string>();
  snapshot.knowledgeFolders.forEach((folder, index) => {
    requireProject(folder.projectId, `knowledgeFolders[${index}].projectId`);
    const pathKey = `${folder.projectId}\u0000${folder.path.join("\u0000")}`;
    if (folderPaths.has(pathKey)) {
      addIssue(
        issues,
        "duplicate-folder-path",
        `knowledgeFolders[${index}].path`,
        "Materialized folder path must be unique within a project.",
      );
    }
    folderPaths.add(pathKey);
    if (
      folder.id.includes(":") &&
      !folder.id.startsWith(`${folder.projectId}:`)
    ) {
      addIssue(
        issues,
        "cross-project-relation",
        `knowledgeFolders[${index}].id`,
        "Derived folder ID must match its project.",
      );
    }
  });

  snapshot.documents.forEach((document, index) => {
    requireProject(document.projectId, `documents[${index}].projectId`);
    const linkedTaskIds = new Set<string>();
    document.linkedTaskIds.forEach((taskId, taskIndex) => {
      if (linkedTaskIds.has(taskId)) {
        addIssue(
          issues,
          "duplicate-id",
          `documents[${index}].linkedTaskIds[${taskIndex}]`,
          `Duplicate task relation: ${taskId}.`,
        );
      }
      linkedTaskIds.add(taskId);
      const task = tasks.get(taskId);
      if (!task) {
        addIssue(
          issues,
          "missing-task",
          `documents[${index}].linkedTaskIds[${taskIndex}]`,
          `Missing task: ${taskId}.`,
        );
      } else if (task.projectId !== document.projectId) {
        addIssue(
          issues,
          "cross-project-relation",
          `documents[${index}].linkedTaskIds[${taskIndex}]`,
          "Document and task must belong to the same project.",
        );
      }
    });
  });
  return issues;
}

export function parseDesktopDomainSnapshot(
  value: unknown,
): ParseDesktopDomainSnapshotResult {
  const errors: DesktopDomainValidationIssue[] = [];
  if (!isRecord(value)) {
    return {
      ok: false,
      errors: [
        {
          code: "invalid-snapshot",
          path: "$",
          message: "Expected a snapshot object.",
        },
      ],
    };
  }
  rejectUnknownFields(
    value,
    "$",
    [
      "schemaVersion",
      "projects",
      "overviewDirections",
      "taskGroups",
      "taskLists",
      "tasks",
      "knowledgeFolders",
      "documents",
    ],
    errors,
  );
  if (value.schemaVersion !== DESKTOP_DOMAIN_SCHEMA_VERSION) {
    addIssue(
      errors,
      "unsupported-schema-version",
      "schemaVersion",
      `Expected schema version ${DESKTOP_DOMAIN_SCHEMA_VERSION}.`,
    );
  }
  const projects = parseCollection(value, "projects", errors, parseProject);
  const overviewDirections = parseCollection(
    value,
    "overviewDirections",
    errors,
    parseDirection,
  );
  const taskGroups = parseCollection(
    value,
    "taskGroups",
    errors,
    parseTaskGroup,
  );
  const taskLists = parseCollection(value, "taskLists", errors, parseTaskList);
  const tasks = parseCollection(value, "tasks", errors, parseTask);
  const knowledgeFolders = parseCollection(
    value,
    "knowledgeFolders",
    errors,
    parseKnowledgeFolder,
  );
  const documents = parseCollection(value, "documents", errors, parseDocument);
  if (
    errors.length > 0 ||
    projects === undefined ||
    overviewDirections === undefined ||
    taskGroups === undefined ||
    taskLists === undefined ||
    tasks === undefined ||
    knowledgeFolders === undefined ||
    documents === undefined
  ) {
    return { ok: false, errors };
  }
  const snapshot: DesktopDomainSnapshot = {
    schemaVersion: DESKTOP_DOMAIN_SCHEMA_VERSION,
    projects,
    overviewDirections,
    taskGroups,
    taskLists,
    tasks,
    knowledgeFolders,
    documents,
  };
  const integrityErrors = validateIntegrity(snapshot);
  return integrityErrors.length > 0
    ? { ok: false, errors: integrityErrors }
    : { ok: true, snapshot, warnings: [] };
}

function deriveNextNumber(ids: string[], prefixes: string[]): number {
  let maximum = 0;
  for (const id of ids) {
    for (const prefix of prefixes) {
      if (!id.startsWith(prefix)) continue;
      const suffix = id.slice(prefix.length);
      if (/^[1-9]\d*$/.test(suffix))
        maximum = Math.max(maximum, Number(suffix));
    }
  }
  return maximum + 1;
}

export function deriveNextPrototypeCounters(
  snapshot: DesktopDomainSnapshot,
): DerivedPrototypeCounters {
  return {
    nextProjectNumber: deriveNextNumber(
      snapshot.projects.map((project) => project.id),
      ["mock-project-"],
    ),
    nextTaskNumber: deriveNextNumber(
      snapshot.tasks.map((task) => task.id),
      ["mock-task-", "ai-task-"],
    ),
    nextTaskGroupNumber: deriveNextNumber(
      snapshot.taskGroups.map((group) => group.id),
      ["mock-task-group-"],
    ),
    nextTaskListNumber: deriveNextNumber(
      snapshot.taskLists.map((list) => list.id),
      ["mock-task-list-"],
    ),
    nextDocumentNumber: deriveNextNumber(
      snapshot.documents.map((document) => document.id),
      ["mock-document-"],
    ),
    nextKnowledgeFolderNumber: deriveNextNumber(
      snapshot.knowledgeFolders.map((folder) => folder.id),
      ["mock-knowledge-folder-"],
    ),
  };
}
