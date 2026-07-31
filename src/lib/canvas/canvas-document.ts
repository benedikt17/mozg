export const CANVAS_DOCUMENT_SCHEMA_VERSION = 1 as const;

export const CANVAS_DOCUMENT_LIMITS = {
  maxNodes: 5_000,
  maxEdges: 10_000,
  maxMarkdownLength: 250_000,
  maxTitleLength: 200,
  maxIdLength: 256,
  maxAbsoluteCoordinate: 1_000_000_000,
  minNodeDimension: 1,
  maxNodeDimension: 100_000,
  minZIndex: -1_000_000,
  maxZIndex: 1_000_000,
} as const;

export const CANVAS_VIEWPORT_LIMITS = {
  minZoom: 0.1,
  maxZoom: 4,
} as const;

export type CanvasPoint = {
  x: number;
  y: number;
};

export type CanvasSize = {
  width: number;
  height: number;
};

export type CanvasNodeBase = {
  id: string;
  position: CanvasPoint;
  size: CanvasSize;
  zIndex: number;
};

export type CanvasTaskNode = CanvasNodeBase & {
  kind: "task";
  taskId: string;
  lastKnownTitle?: string;
};

export type CanvasArticleNode = CanvasNodeBase & {
  kind: "article";
  articleId: string;
  lastKnownTitle?: string;
};

export type CanvasTextNode = CanvasNodeBase & {
  kind: "text";
  markdown: string;
};

export type CanvasImageNode = CanvasNodeBase & {
  kind: "image";
  assetId: string;
  aspectRatioLocked: boolean;
};

export type CanvasNode =
  CanvasTaskNode | CanvasArticleNode | CanvasTextNode | CanvasImageNode;

export type CanvasEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
};

export type CanvasViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type CanvasDocumentV1 = {
  schemaVersion: typeof CANVAS_DOCUMENT_SCHEMA_VERSION;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};

export type CanvasDocumentValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type CanvasDocumentValidationResult =
  | { ok: true; document: CanvasDocumentV1 }
  | { ok: false; errors: CanvasDocumentValidationIssue[] };

export class CanvasDocumentValidationError extends Error {
  readonly issues: CanvasDocumentValidationIssue[];

  constructor(issue: CanvasDocumentValidationIssue) {
    super(issue.message);
    this.name = "CanvasDocumentValidationError";
    this.issues = [issue];
  }
}

export const EMPTY_CANVAS_DOCUMENT_V1: CanvasDocumentV1 = {
  schemaVersion: CANVAS_DOCUMENT_SCHEMA_VERSION,
  nodes: [],
  edges: [],
};

export function createEmptyCanvasDocumentV1(): CanvasDocumentV1 {
  return {
    schemaVersion: CANVAS_DOCUMENT_SCHEMA_VERSION,
    nodes: [],
    edges: [],
  };
}

type UnknownRecord = Record<string, unknown>;

const BASE_NODE_KEYS = ["id", "kind", "position", "size", "zIndex"];
const EDGE_KEYS = ["id", "sourceNodeId", "targetNodeId"];
const POINT_KEYS = ["x", "y"];
const SIZE_KEYS = ["width", "height"];

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(code: string, path: string, message: string): never {
  throw new CanvasDocumentValidationError({ code, path, message });
}

function requireRecord(value: unknown, path: string): UnknownRecord {
  if (!isRecord(value)) {
    fail("object_required", path, "Expected a JSON object");
  }
  return value;
}

function requireExactKeys(
  value: UnknownRecord,
  required: readonly string[],
  optional: readonly string[],
  path: string,
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      fail("unknown_property", `${path}.${key}`, "Unknown property");
    }
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail(
        "missing_property",
        `${path}.${key}`,
        "Required property is missing",
      );
    }
  }
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    fail("string_required", path, "Expected a string");
  }
  return value;
}

function requireIdentifier(value: unknown, path: string): string {
  const identifier = requireString(value, path);
  if (
    identifier.length === 0 ||
    identifier.trim().length === 0 ||
    identifier.length > CANVAS_DOCUMENT_LIMITS.maxIdLength ||
    /[\u0000-\u001f\u007f]/u.test(identifier)
  ) {
    fail("invalid_identifier", path, "Expected a non-empty stable identifier");
  }
  return identifier;
}

function requireFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail("finite_number_required", path, "Expected a finite JSON number");
  }
  return value;
}

function requirePoint(value: unknown, path: string): CanvasPoint {
  const point = requireRecord(value, path);
  requireExactKeys(point, POINT_KEYS, [], path);
  const x = requireFiniteNumber(point.x, `${path}.x`);
  const y = requireFiniteNumber(point.y, `${path}.y`);
  if (
    Math.abs(x) > CANVAS_DOCUMENT_LIMITS.maxAbsoluteCoordinate ||
    Math.abs(y) > CANVAS_DOCUMENT_LIMITS.maxAbsoluteCoordinate
  ) {
    fail(
      "coordinate_out_of_range",
      path,
      "Coordinate exceeds the Canvas limit",
    );
  }
  return { x, y };
}

function requireSize(value: unknown, path: string): CanvasSize {
  const size = requireRecord(value, path);
  requireExactKeys(size, SIZE_KEYS, [], path);
  const width = requireFiniteNumber(size.width, `${path}.width`);
  const height = requireFiniteNumber(size.height, `${path}.height`);
  if (
    width < CANVAS_DOCUMENT_LIMITS.minNodeDimension ||
    height < CANVAS_DOCUMENT_LIMITS.minNodeDimension ||
    width > CANVAS_DOCUMENT_LIMITS.maxNodeDimension ||
    height > CANVAS_DOCUMENT_LIMITS.maxNodeDimension
  ) {
    fail(
      "dimension_out_of_range",
      path,
      "Node dimensions are outside the Canvas limits",
    );
  }
  return { width, height };
}

function requireZIndex(value: unknown, path: string): number {
  const zIndex = requireFiniteNumber(value, path);
  if (
    !Number.isSafeInteger(zIndex) ||
    zIndex < CANVAS_DOCUMENT_LIMITS.minZIndex ||
    zIndex > CANVAS_DOCUMENT_LIMITS.maxZIndex
  ) {
    fail(
      "invalid_z_index",
      path,
      "zIndex must be a safe integer in the Canvas range",
    );
  }
  return zIndex;
}

function requireLastKnownTitle(value: unknown, path: string): string {
  const title = requireString(value, path);
  if (title.length > CANVAS_DOCUMENT_LIMITS.maxTitleLength) {
    fail(
      "title_too_long",
      path,
      "lastKnownTitle exceeds the Canvas title limit",
    );
  }
  return title;
}

function parseNode(value: unknown, path: string): CanvasNode {
  const node = requireRecord(value, path);
  const kind = requireString(node.kind, `${path}.kind`) as CanvasNode["kind"];
  const optionalKeys = ["lastKnownTitle"];
  const allowedKeys = kind === "task" || kind === "article" ? optionalKeys : [];
  const specificKey =
    kind === "task"
      ? "taskId"
      : kind === "article"
        ? "articleId"
        : kind === "text"
          ? "markdown"
          : kind === "image"
            ? "assetId"
            : null;
  if (specificKey === null) {
    fail(
      "unsupported_node_kind",
      `${path}.kind`,
      "Unsupported Canvas node kind",
    );
  }
  const requiredKeys = [...BASE_NODE_KEYS, specificKey];
  if (kind === "image") {
    requiredKeys.push("aspectRatioLocked");
  }
  requireExactKeys(node, requiredKeys, allowedKeys, path);
  const id = requireIdentifier(node.id, `${path}.id`);
  const position = requirePoint(node.position, `${path}.position`);
  const size = requireSize(node.size, `${path}.size`);
  const zIndex = requireZIndex(node.zIndex, `${path}.zIndex`);

  if (kind === "task") {
    const result: CanvasTaskNode = {
      id,
      kind,
      position,
      size,
      zIndex,
      taskId: requireIdentifier(node.taskId, `${path}.taskId`),
    };
    if (Object.prototype.hasOwnProperty.call(node, "lastKnownTitle")) {
      result.lastKnownTitle = requireLastKnownTitle(
        node.lastKnownTitle,
        `${path}.lastKnownTitle`,
      );
    }
    return result;
  }

  if (kind === "article") {
    const result: CanvasArticleNode = {
      id,
      kind,
      position,
      size,
      zIndex,
      articleId: requireIdentifier(node.articleId, `${path}.articleId`),
    };
    if (Object.prototype.hasOwnProperty.call(node, "lastKnownTitle")) {
      result.lastKnownTitle = requireLastKnownTitle(
        node.lastKnownTitle,
        `${path}.lastKnownTitle`,
      );
    }
    return result;
  }

  if (kind === "text") {
    const markdown = requireString(node.markdown, `${path}.markdown`);
    if (markdown.length > CANVAS_DOCUMENT_LIMITS.maxMarkdownLength) {
      fail(
        "markdown_too_long",
        `${path}.markdown`,
        "Markdown exceeds the Canvas limit",
      );
    }
    return { id, kind, position, size, zIndex, markdown };
  }

  const aspectRatioLocked = node.aspectRatioLocked;
  if (typeof aspectRatioLocked !== "boolean") {
    fail("boolean_required", `${path}.aspectRatioLocked`, "Expected a boolean");
  }
  return {
    id,
    kind,
    position,
    size,
    zIndex,
    assetId: requireIdentifier(node.assetId, `${path}.assetId`),
    aspectRatioLocked,
  };
}

function parseEdge(value: unknown, path: string): CanvasEdge {
  const edge = requireRecord(value, path);
  requireExactKeys(edge, EDGE_KEYS, [], path);
  return {
    id: requireIdentifier(edge.id, `${path}.id`),
    sourceNodeId: requireIdentifier(edge.sourceNodeId, `${path}.sourceNodeId`),
    targetNodeId: requireIdentifier(edge.targetNodeId, `${path}.targetNodeId`),
  };
}

export function parseCanvasDocumentV1(input: unknown): CanvasDocumentV1 {
  const document = requireRecord(input, "document");
  requireExactKeys(
    document,
    ["schemaVersion", "nodes", "edges"],
    [],
    "document",
  );
  if (document.schemaVersion !== CANVAS_DOCUMENT_SCHEMA_VERSION) {
    fail(
      "unsupported_schema_version",
      "document.schemaVersion",
      "Only CanvasDocumentV1 is supported",
    );
  }
  if (!Array.isArray(document.nodes)) {
    fail("array_required", "document.nodes", "nodes must be an array");
  }
  if (!Array.isArray(document.edges)) {
    fail("array_required", "document.edges", "edges must be an array");
  }
  if (document.nodes.length > CANVAS_DOCUMENT_LIMITS.maxNodes) {
    fail("node_limit_exceeded", "document.nodes", "Canvas node limit exceeded");
  }
  if (document.edges.length > CANVAS_DOCUMENT_LIMITS.maxEdges) {
    fail("edge_limit_exceeded", "document.edges", "Canvas edge limit exceeded");
  }

  const nodes = document.nodes.map((node, index) =>
    parseNode(node, `document.nodes[${index}]`),
  );
  const nodeIds = new Set<string>();
  for (const [index, node] of nodes.entries()) {
    if (nodeIds.has(node.id)) {
      fail(
        "duplicate_node_id",
        `document.nodes[${index}].id`,
        "Canvas node IDs must be unique",
      );
    }
    nodeIds.add(node.id);
  }

  const edges = document.edges.map((edge, index) =>
    parseEdge(edge, `document.edges[${index}]`),
  );
  const edgeIds = new Set<string>();
  const edgeEndpoints = new Set<string>();
  for (const [index, edge] of edges.entries()) {
    if (edgeIds.has(edge.id)) {
      fail(
        "duplicate_edge_id",
        `document.edges[${index}].id`,
        "Canvas edge IDs must be unique",
      );
    }
    if (edge.sourceNodeId === edge.targetNodeId) {
      fail(
        "self_edge",
        `document.edges[${index}]`,
        "Canvas edges cannot target the same node",
      );
    }
    const endpointKey = `${edge.sourceNodeId}\u0000${edge.targetNodeId}`;
    if (edgeEndpoints.has(endpointKey)) {
      fail(
        "duplicate_edge_endpoints",
        `document.edges[${index}]`,
        "Canvas edge endpoints must be unique",
      );
    }
    if (!nodeIds.has(edge.sourceNodeId)) {
      fail(
        "dangling_edge",
        `document.edges[${index}].sourceNodeId`,
        "Edge source node does not exist",
      );
    }
    if (!nodeIds.has(edge.targetNodeId)) {
      fail(
        "dangling_edge",
        `document.edges[${index}].targetNodeId`,
        "Edge target node does not exist",
      );
    }
    edgeIds.add(edge.id);
    edgeEndpoints.add(endpointKey);
  }

  return {
    schemaVersion: CANVAS_DOCUMENT_SCHEMA_VERSION,
    nodes,
    edges,
  };
}

export function validateCanvasDocumentV1(
  input: unknown,
): CanvasDocumentValidationResult {
  try {
    return { ok: true, document: parseCanvasDocumentV1(input) };
  } catch (error) {
    if (error instanceof CanvasDocumentValidationError) {
      return { ok: false, errors: error.issues };
    }
    throw error;
  }
}

export const parseCanvasDocument = parseCanvasDocumentV1;
export const validateCanvasDocument = validateCanvasDocumentV1;
