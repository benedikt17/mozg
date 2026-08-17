from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


def insert_before(text: str, marker: str, addition: str, label: str) -> str:
    if text.count(marker) != 1:
        raise RuntimeError(f"{label}: marker count={text.count(marker)}")
    return text.replace(marker, addition + marker, 1)


# canvas-document.ts
path = "src/lib/canvas/canvas-document.ts"
text = read(path)
text = replace_once(
    text,
    '} from "@/lib/canvas/canvas-text-style";\n',
    '} from "@/lib/canvas/canvas-text-style";\nimport type { CanvasShapeStyle } from "@/lib/canvas/canvas-shape-style";\n',
    "document shape style import",
)
text = replace_once(
    text,
    '''export type CanvasTextNode = CanvasNodeBase & {
  kind: "text";
  markdown: string;
  style?: CanvasTextStyle;
};

''',
    '''export type CanvasTextNode = CanvasNodeBase & {
  kind: "text";
  markdown: string;
  style?: CanvasTextStyle;
};

export const CANVAS_SHAPE_VARIANTS = ["rectangle", "circle"] as const;
export type CanvasShapeVariant = (typeof CANVAS_SHAPE_VARIANTS)[number];

export type CanvasShapeNode = CanvasNodeBase & {
  kind: "shape";
  shape: CanvasShapeVariant;
  markdown: string;
  style: CanvasShapeStyle;
};

''',
    "document shape type",
)
text = replace_once(
    text,
    '''export type CanvasNode =
  CanvasTaskNode | CanvasArticleNode | CanvasTextNode | CanvasImageNode;
''',
    '''export type CanvasNode =
  | CanvasTaskNode
  | CanvasArticleNode
  | CanvasTextNode
  | CanvasShapeNode
  | CanvasImageNode;
''',
    "document node union",
)
text = replace_once(
    text,
    '''const TEXT_STYLE_OPTIONAL_KEYS = ["textAlign"];
''',
    '''const TEXT_STYLE_OPTIONAL_KEYS = ["textAlign"];
const SHAPE_STYLE_KEYS = [
  "fontFamily",
  "fontSize",
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "color",
  "fillColor",
];
const SHAPE_STYLE_OPTIONAL_KEYS = ["textAlign"];
''',
    "document shape style keys",
)
shape_style_parser = '''function requireCanvasShapeStyle(
  value: unknown,
  path: string,
): CanvasShapeStyle {
  const style = requireRecord(value, path);
  requireExactKeys(style, SHAPE_STYLE_KEYS, SHAPE_STYLE_OPTIONAL_KEYS, path);
  const textStyle = requireCanvasTextStyle(
    {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      bold: style.bold,
      italic: style.italic,
      underline: style.underline,
      strikethrough: style.strikethrough,
      color: style.color,
      backgroundColor: style.fillColor,
      ...(Object.prototype.hasOwnProperty.call(style, "textAlign")
        ? { textAlign: style.textAlign }
        : {}),
    },
    path,
  );
  return {
    fontFamily: textStyle.fontFamily,
    fontSize: textStyle.fontSize,
    bold: textStyle.bold,
    italic: textStyle.italic,
    underline: textStyle.underline,
    strikethrough: textStyle.strikethrough,
    color: textStyle.color,
    fillColor: textStyle.backgroundColor,
    textAlign: textStyle.textAlign,
  };
}

'''
text = insert_before(
    text,
    "function parseNode(value: unknown, path: string): CanvasNode {\n",
    shape_style_parser,
    "document shape style parser",
)
text = replace_once(
    text,
    "function parseNode(value: unknown, path: string): CanvasNode {\n",
    "function parseNode(value: unknown, path: string, allowShape = false): CanvasNode {\n",
    "document parseNode signature",
)
text = replace_once(
    text,
    '''  const kind = requireString(node.kind, `${path}.kind`) as CanvasNode["kind"];
  const optionalKeys = ["lastKnownTitle"];
''',
    '''  const kind = requireString(node.kind, `${path}.kind`) as CanvasNode["kind"];
  if (kind === "shape" && !allowShape) {
    fail(
      "unsupported_node_kind",
      `${path}.kind`,
      "Canvas shape nodes require CanvasDocumentV2",
    );
  }
  const optionalKeys = ["lastKnownTitle"];
''',
    "document V2-only shape guard",
)
text = replace_once(
    text,
    '''        : kind === "text"
          ? "markdown"
          : kind === "image"
            ? hasImageFileId
              ? "fileId"
              : "assetId"
            : null;
''',
    '''        : kind === "text"
          ? "markdown"
          : kind === "shape"
            ? "shape"
            : kind === "image"
              ? hasImageFileId
                ? "fileId"
                : "assetId"
              : null;
''',
    "document shape key",
)
text = replace_once(
    text,
    '''  if (kind === "image") {
    requiredKeys.push("aspectRatioLocked");
  }
''',
    '''  if (kind === "image") {
    requiredKeys.push("aspectRatioLocked");
  }
  if (kind === "shape") {
    requiredKeys.push("markdown", "style");
  }
''',
    "document shape required keys",
)
shape_branch = '''  if (kind === "shape") {
    const shape = requireString(node.shape, `${path}.shape`);
    if (!CANVAS_SHAPE_VARIANTS.includes(shape as CanvasShapeVariant)) {
      fail(
        "invalid_shape_variant",
        `${path}.shape`,
        "Unsupported Canvas shape variant",
      );
    }
    const markdown = requireString(node.markdown, `${path}.markdown`);
    if (markdown.length > CANVAS_DOCUMENT_LIMITS.maxMarkdownLength) {
      fail(
        "markdown_too_long",
        `${path}.markdown`,
        "Markdown exceeds the Canvas limit",
      );
    }
    return {
      id,
      kind,
      shape: shape as CanvasShapeVariant,
      position,
      size,
      zIndex,
      markdown,
      style: requireCanvasShapeStyle(node.style, `${path}.style`),
    };
  }

'''
text = insert_before(
    text,
    "  const aspectRatioLocked = node.aspectRatioLocked;\n",
    shape_branch,
    "document shape parse branch",
)
# Only V2 is allowed to accept shape nodes.
v2_marker = "export function parseCanvasDocumentV2(input: unknown): CanvasDocumentV2 {"
v2_index = text.index(v2_marker)
head, tail = text[:v2_index], text[v2_index:]
tail = replace_once(
    tail,
    '''  const nodes = document.nodes.map((node, index) =>
    parseNode(node, `document.nodes[${index}]`),
  );
''',
    '''  const nodes = document.nodes.map((node, index) =>
    parseNode(node, `document.nodes[${index}]`, true),
  );
''',
    "document V2 shape parser opt-in",
)
text = head + tail
write(path, text)


# react-flow-canvas-adapter.ts
path = "src/lib/canvas/react-flow-canvas-adapter.ts"
text = read(path)
text = replace_once(
    text,
    '''  type CanvasSize,
  type CanvasTextNode,
} from "@/lib/canvas/canvas-document";
''',
    '''  type CanvasSize,
  type CanvasShapeNode,
  type CanvasShapeVariant,
  type CanvasTextNode,
} from "@/lib/canvas/canvas-document";
''',
    "adapter shape canonical imports",
)
text = replace_once(
    text,
    '''import {
  DEFAULT_CANVAS_TEXT_STYLE,
  type CanvasTextStyle,
} from "@/lib/canvas/canvas-text-style";
''',
    '''import {
  DEFAULT_CANVAS_TEXT_STYLE,
  type CanvasTextStyle,
} from "@/lib/canvas/canvas-text-style";
import {
  DEFAULT_CANVAS_SHAPE_STYLE,
  type CanvasShapeStyle,
} from "@/lib/canvas/canvas-shape-style";
''',
    "adapter shape style import",
)
text = replace_once(
    text,
    '''export const CANVAS_TEXT_NODE_TYPE = "canvasText";
export const CANVAS_TASK_NODE_TYPE = "canvasTask";
''',
    '''export const CANVAS_TEXT_NODE_TYPE = "canvasText";
export const CANVAS_SHAPE_NODE_TYPE = "canvasShape";
export const CANVAS_TASK_NODE_TYPE = "canvasTask";
''',
    "adapter shape runtime constant",
)
text = replace_once(
    text,
    '''export type CanvasTextFlowNode = Node<
  CanvasTextNodeData,
  typeof CANVAS_TEXT_NODE_TYPE
>;

''',
    '''export type CanvasTextFlowNode = Node<
  CanvasTextNodeData,
  typeof CANVAS_TEXT_NODE_TYPE
>;

export type CanvasShapeNodeData = {
  shape: CanvasShapeVariant;
  markdown: string;
  style: CanvasShapeStyle;
  isEditing?: boolean;
};

export type CanvasShapeFlowNode = Node<
  CanvasShapeNodeData,
  typeof CANVAS_SHAPE_NODE_TYPE
>;

''',
    "adapter shape runtime type",
)
text = replace_once(
    text,
    '''export type CanvasFlowNode =
  CanvasImageFlowNode | CanvasTextFlowNode | CanvasTaskFlowNode;
''',
    '''export type CanvasFlowNode =
  | CanvasImageFlowNode
  | CanvasTextFlowNode
  | CanvasShapeFlowNode
  | CanvasTaskFlowNode;
''',
    "adapter flow union",
)
shape_factory = '''export function createCanvasShapeId(
  idGenerator: () => string = () =>
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`,
): string {
  return `shape-${idGenerator()}`;
}

export function createCanvasShapeFlowNode(input: {
  id: string;
  shape: CanvasShapeVariant;
  markdown: string;
  position?: FlowPosition;
  size?: CanvasSize;
  zIndex?: number;
  style?: CanvasShapeStyle;
  isEditing?: boolean;
}): CanvasShapeFlowNode {
  const defaultSize =
    input.shape === "circle"
      ? { width: 160, height: 160 }
      : { width: 220, height: 120 };
  const size = input.size ?? defaultSize;
  return {
    id: input.id,
    type: CANVAS_SHAPE_NODE_TYPE,
    position: { ...(input.position ?? { x: 0, y: 0 }) },
    width: size.width,
    height: size.height,
    style: { width: size.width, height: size.height },
    zIndex: input.zIndex,
    data: {
      shape: input.shape,
      markdown: input.markdown,
      style: { ...(input.style ?? DEFAULT_CANVAS_SHAPE_STYLE) },
      isEditing: input.isEditing,
    },
  };
}

'''
text = insert_before(
    text,
    "export function createCanvasTaskId(\n",
    shape_factory,
    "adapter shape factory",
)
shape_projection = '''export function canvasDocumentToShapeNodes(
  document: CanvasDocument,
): CanvasShapeFlowNode[] {
  return document.nodes
    .filter((node): node is CanvasShapeNode => node.kind === "shape")
    .map((node) =>
      createCanvasShapeFlowNode({
        id: node.id,
        shape: node.shape,
        markdown: node.markdown,
        position: node.position,
        size: node.size,
        zIndex: node.zIndex,
        style: node.style,
      }),
    );
}

'''
text = insert_before(
    text,
    "export function canvasDocumentToTaskNodes(\n",
    shape_projection,
    "adapter document shape projection",
)
text = replace_once(
    text,
    '''    if (node.kind === "task" && runtime.type === CANVAS_TASK_NODE_TYPE) {
''',
    '''    if (node.kind === "shape" && runtime.type === CANVAS_SHAPE_NODE_TYPE) {
      return {
        ...node,
        shape: runtime.data.shape,
        markdown: runtime.data.markdown,
        style: { ...runtime.data.style },
        position: { ...runtime.position },
        size: runtimeNodeSize(runtime),
      };
    }
    if (node.kind === "task" && runtime.type === CANVAS_TASK_NODE_TYPE) {
''',
    "adapter runtime shape projection",
)
write(path, text)


# clipboard
path = "src/lib/canvas/canvas-node-clipboard.ts"
text = read(path)
text = replace_once(
    text,
    '  return node.kind === "image" || node.kind === "text" || node.kind === "task";\n',
    '  return (\n    node.kind === "image" ||\n    node.kind === "text" ||\n    node.kind === "shape" ||\n    node.kind === "task"\n  );\n',
    "clipboard shape support",
)
write(path, text)


# Alt-drag runtime clone
path = "src/lib/canvas/canvas-alt-drag-duplicate.ts"
text = read(path)
text = replace_once(
    text,
    '''import {
  CANVAS_TEXT_NODE_TYPE,
  type CanvasFlowNode,
} from "@/lib/canvas/react-flow-canvas-adapter";
''',
    '''import {
  CANVAS_SHAPE_NODE_TYPE,
  CANVAS_TEXT_NODE_TYPE,
  type CanvasFlowNode,
} from "@/lib/canvas/react-flow-canvas-adapter";
''',
    "alt shape runtime import",
)
text = replace_once(
    text,
    '''  const data =
    source.type === CANVAS_TEXT_NODE_TYPE
      ? {
          ...source.data,
          style: { ...source.data.style },
          isEditing: false,
        }
      : { ...source.data };
''',
    '''  const data =
    source.type === CANVAS_TEXT_NODE_TYPE || source.type === CANVAS_SHAPE_NODE_TYPE
      ? {
          ...source.data,
          style: { ...source.data.style },
          isEditing: false,
        }
      : { ...source.data };
''',
    "alt shape runtime clone",
)
write(path, text)


# Canvas node frame shared centered-text / alignment callback
path = "src/prototype/infinite-canvas-local-shell/canvas-node-frame.tsx"
text = read(path)
text = replace_once(
    text,
    '''  keepAspectRatio?: boolean;
  className?: string;
''',
    '''  keepAspectRatio?: boolean;
  centerTextContent?: boolean;
  className?: string;
''',
    "node frame center text prop",
)
text = replace_once(
    text,
    '''export function TextAlignmentControls({
  id,
  value,
}: {
  id: string;
  value: CanvasTextAlignment;
}): React.JSX.Element {
''',
    '''export function TextAlignmentControls({
  id,
  value,
  onChange,
}: {
  id: string;
  value: CanvasTextAlignment;
  onChange?: (alignment: CanvasTextAlignment) => void;
}): React.JSX.Element {
''',
    "alignment callback prop",
)
text = replace_once(
    text,
    '''          onClick={() => dispatchCanvasTextAlignment(id, alignment)}
''',
    '''          onClick={() => {
            if (onChange) onChange(alignment);
            else dispatchCanvasTextAlignment(id, alignment);
          }}
''',
    "alignment callback use",
)
text = replace_once(
    text,
    '''  keepAspectRatio = false,
  className,
''',
    '''  keepAspectRatio = false,
  centerTextContent,
  className,
''',
    "node frame center destructure",
)
text = replace_once(
    text,
    '''  const isTextFrame = Boolean(className?.includes(styles.textNodeFrame));
''',
    '''  const isTextFrame =
    centerTextContent ?? Boolean(className?.includes(styles.textNodeFrame));
''',
    "node frame centered content decision",
)
write(path, text)


# minimap
path = "src/lib/canvas/canvas-minimap.ts"
text = read(path)
text = replace_once(
    text,
    '''  CANVAS_IMAGE_NODE_TYPE,
  CANVAS_TASK_NODE_TYPE,
  CANVAS_TEXT_NODE_TYPE,
''',
    '''  CANVAS_IMAGE_NODE_TYPE,
  CANVAS_SHAPE_NODE_TYPE,
  CANVAS_TASK_NODE_TYPE,
  CANVAS_TEXT_NODE_TYPE,
''',
    "minimap shape import",
)
text = replace_once(
    text,
    '''    case CANVAS_TASK_NODE_TYPE:
      return "#0f766e";
    case CANVAS_TEXT_NODE_TYPE:
''',
    '''    case CANVAS_TASK_NODE_TYPE:
      return "#0f766e";
    case CANVAS_SHAPE_NODE_TYPE:
      return "#d97706";
    case CANVAS_TEXT_NODE_TYPE:
''',
    "minimap shape color",
)
write(path, text)


# Desktop toolbar direct Rectangle / Circle buttons
path = "src/prototype/canvases/canvas-desktop-composition.tsx"
text = read(path)
text = replace_once(
    text,
    '''  onAddImage,
  onAddText,
''',
    '''  onAddImage,
  onAddText,
  onAddRectangle,
  onAddCircle,
''',
    "toolbar shape callback destructure",
)
text = replace_once(
    text,
    '''  onAddImage: (files: File[]) => void;
  onAddText: () => void;
''',
    '''  onAddImage: (files: File[]) => void;
  onAddText: () => void;
  onAddRectangle: () => void;
  onAddCircle: () => void;
''',
    "toolbar shape callback types",
)
shape_toolbar_buttons = '''        <IconButton
          disabled={!isReady}
          icon={
            <svg aria-hidden="true" height="18" viewBox="0 0 18 18" width="18">
              <rect
                fill="none"
                height="11"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.5"
                width="14"
                x="2"
                y="3.5"
              />
            </svg>
          }
          label="Добавить прямоугольник"
          onClick={onAddRectangle}
          title="Прямоугольник"
          variant="quiet"
        />
        <IconButton
          disabled={!isReady}
          icon={
            <svg aria-hidden="true" height="18" viewBox="0 0 18 18" width="18">
              <circle
                cx="9"
                cy="9"
                fill="none"
                r="6"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          }
          label="Добавить круг"
          onClick={onAddCircle}
          title="Круг"
          variant="quiet"
        />
'''
text = replace_once(
    text,
    '''        <IconButton
          disabled={!isReady}
          icon={<UiIcon name="text" />}
          label={copy.text}
          onClick={onAddText}
          title={copy.text}
          variant="quiet"
        />
''',
    '''        <IconButton
          disabled={!isReady}
          icon={<UiIcon name="text" />}
          label={copy.text}
          onClick={onAddText}
          title={copy.text}
          variant="quiet"
        />
''' + shape_toolbar_buttons,
    "toolbar shape buttons",
)
write(path, text)


# Infinite Canvas shell
path = "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx"
text = read(path)
text = replace_once(
    text,
    '''} from "@/lib/canvas/canvas-text-style";
import {
  CANVAS_NODE_CLIPBOARD_MIME,
''',
    '''} from "@/lib/canvas/canvas-text-style";
import {
  DEFAULT_CANVAS_SHAPE_STYLE,
  canvasShapeStyleAsTextStyle,
  canvasTextStylePatchToShapeStyle,
  type CanvasShapeStyle,
} from "@/lib/canvas/canvas-shape-style";
import {
  CANVAS_NODE_CLIPBOARD_MIME,
''',
    "shell shape style imports",
)
text = replace_once(
    text,
    '''  CANVAS_IMAGE_NODE_TYPE,
  CANVAS_TASK_NODE_TYPE,
  CANVAS_TEXT_NODE_TYPE,
''',
    '''  CANVAS_IMAGE_NODE_TYPE,
  CANVAS_SHAPE_NODE_TYPE,
  CANVAS_TASK_NODE_TYPE,
  CANVAS_TEXT_NODE_TYPE,
''',
    "shell shape runtime constant",
)
text = replace_once(
    text,
    '''  canvasDocumentToImageNodes,
  canvasDocumentToTaskNodes,
  canvasDocumentToTextNodes,
''',
    '''  canvasDocumentToImageNodes,
  canvasDocumentToShapeNodes,
  canvasDocumentToTaskNodes,
  canvasDocumentToTextNodes,
''',
    "shell shape projection import",
)
text = replace_once(
    text,
    '''  createCanvasTaskFlowNode,
  createCanvasTaskId,
  createCanvasEdgeFromConnection,
  createCanvasTextFlowNode,
''',
    '''  createCanvasTaskFlowNode,
  createCanvasTaskId,
  createCanvasEdgeFromConnection,
  createCanvasShapeFlowNode,
  createCanvasShapeId,
  createCanvasTextFlowNode,
''',
    "shell shape factory imports",
)
text = replace_once(
    text,
    '''  type CanvasImageFlowNode,
  type CanvasTaskFlowNode,
  type CanvasTextFlowNode,
''',
    '''  type CanvasImageFlowNode,
  type CanvasShapeFlowNode,
  type CanvasTaskFlowNode,
  type CanvasTextFlowNode,
''',
    "shell shape runtime type import",
)
text = replace_once(
    text,
    '''  type CanvasEdgeRouting,
  type CanvasHandleSide,
} from "@/lib/canvas/canvas-document";
''',
    '''  type CanvasEdgeRouting,
  type CanvasHandleSide,
  type CanvasShapeNode,
  type CanvasShapeVariant,
} from "@/lib/canvas/canvas-document";
''',
    "shell shape canonical imports",
)
# Genericize existing formatting toolbar just enough for shapes.
text = replace_once(
    text,
    '''function TextSelectionToolbar({
  id,
  style,
}: {
  id: string;
  style: CanvasTextStyle;
}): React.JSX.Element {
  const patchStyle = (patch: Partial<CanvasTextStyle>) =>
    dispatchCanvasTextStylePatch(id, patch);
''',
    '''function TextSelectionToolbar({
  id,
  style,
  onPatchStyle,
  toolbarLabel = "Панель форматирования текста",
  typeLabel = "Текст",
  typeGlyph = "T",
  fillLabel = "Цвет фона",
  eyedropperTitle = "Скопировать цвет текста и фона",
  resetLabel = "Убрать цвет фона",
  resetTitle = "Убрать фон",
}: {
  id: string;
  style: CanvasTextStyle;
  onPatchStyle?: (patch: Partial<CanvasTextStyle>) => void;
  toolbarLabel?: string;
  typeLabel?: string;
  typeGlyph?: string;
  fillLabel?: string;
  eyedropperTitle?: string;
  resetLabel?: string;
  resetTitle?: string;
}): React.JSX.Element {
  const patchStyle =
    onPatchStyle ??
    ((patch: Partial<CanvasTextStyle>) => dispatchCanvasTextStylePatch(id, patch));
''',
    "shell generic formatting toolbar signature",
)
text = replace_once(
    text,
    '      aria-label="Панель форматирования текста"\n',
    '      aria-label={toolbarLabel}\n',
    "shell formatting toolbar aria",
)
text = replace_once(
    text,
    '''        aria-label="Текст"
        title="Текст"
        disabled
      >
        T
''',
    '''        aria-label={typeLabel}
        title={typeLabel}
        disabled
      >
        {typeGlyph}
''',
    "shell formatting toolbar type glyph",
)
text = replace_once(
    text,
    '        label="Цвет фона"\n',
    '        label={fillLabel}\n',
    "shell formatting toolbar fill label",
)
text = replace_once(
    text,
    '        title="Скопировать цвет текста и фона"\n',
    '        title={eyedropperTitle}\n',
    "shell formatting toolbar eyedropper title",
)
text = replace_once(
    text,
    '''      <TextAlignmentControls id={id} value={style.textAlign} />
''',
    '''      <TextAlignmentControls
        id={id}
        value={style.textAlign}
        onChange={(textAlign) => patchStyle({ textAlign })}
      />
''',
    "shell formatting toolbar alignment",
)
text = replace_once(
    text,
    '''        aria-label="Убрать цвет фона"
        title="Убрать фон"
''',
    '''        aria-label={resetLabel}
        title={resetTitle}
''',
    "shell formatting toolbar reset labels",
)
# Shape style dispatch and toolbar.
shape_toolbar = '''function dispatchCanvasShapeStylePatch(
  id: string,
  patch: Partial<CanvasShapeStyle>,
): void {
  window.dispatchEvent(
    new CustomEvent("mozg:canvas-shape-style", { detail: { id, patch } }),
  );
}

function ShapeSelectionToolbar({
  id,
  style,
}: {
  id: string;
  style: CanvasShapeStyle;
}): React.JSX.Element {
  return (
    <TextSelectionToolbar
      id={id}
      style={canvasShapeStyleAsTextStyle(style)}
      onPatchStyle={(patch) =>
        dispatchCanvasShapeStylePatch(id, canvasTextStylePatchToShapeStyle(patch))
      }
      toolbarLabel="Панель форматирования фигуры"
      typeLabel="Фигура"
      typeGlyph="◇"
      fillLabel="Цвет заливки"
      eyedropperTitle="Скопировать цвет текста и заливки"
      resetLabel="Убрать заливку"
      resetTitle="Убрать заливку"
    />
  );
}

'''
text = insert_before(
    text,
    "function canvasTextCss(style: CanvasTextStyle): CSSProperties {\n",
    shape_toolbar,
    "shell shape formatting toolbar",
)
# Editor can dispatch either text or shape events.
text = replace_once(
    text,
    '''function CanvasTextEditor({
  id,
  markdown,
}: {
  id: string;
  markdown: string;
}): React.JSX.Element {
''',
    '''function CanvasTextEditor({
  id,
  markdown,
  eventKind = "text",
}: {
  id: string;
  markdown: string;
  eventKind?: "text" | "shape";
}): React.JSX.Element {
''',
    "shell editor event kind",
)
text = replace_once(
    text,
    '      new CustomEvent("mozg:canvas-text-draft", {\n',
    '      new CustomEvent(`mozg:canvas-${eventKind}-draft`, {\n',
    "shell editor draft event",
)
text = replace_once(
    text,
    '      new CustomEvent("mozg:canvas-text-commit", {\n',
    '      new CustomEvent(`mozg:canvas-${eventKind}-commit`, {\n',
    "shell editor commit event",
)
text = replace_once(
    text,
    '      new CustomEvent("mozg:canvas-text-cancel", { detail: { id } }),\n',
    '      new CustomEvent(`mozg:canvas-${eventKind}-cancel`, { detail: { id } }),\n',
    "shell editor cancel event",
)
# Shape node body.
shape_body = '''function ShapeNodeBody({
  data,
  selected,
  id,
}: NodeProps<CanvasShapeFlowNode>): React.JSX.Element {
  const visualStyle = canvasTextCss(canvasShapeStyleAsTextStyle(data.style));
  return (
    <CanvasNodeFrame
      selected={selected}
      minWidth={data.shape === "circle" ? 80 : 100}
      minHeight={data.shape === "circle" ? 80 : 60}
      keepAspectRatio={data.shape === "circle"}
      centerTextContent
      className={styles.shapeNodeFrame}
      toolbar={<ShapeSelectionToolbar id={id} style={data.style} />}
      connectionHandleLayer={<ConnectionHandleLayer selected={selected} />}
    >
      <div
        className={`${styles.shapeNodeContent} ${
          data.shape === "circle"
            ? styles.shapeNodeCircle
            : styles.shapeNodeRectangle
        }`}
        style={visualStyle}
        data-canvas-shape={data.shape}
        onDoubleClick={(event) => {
          event.stopPropagation();
          window.dispatchEvent(
            new CustomEvent("mozg:canvas-shape-edit", { detail: { id } }),
          );
        }}
      >
        {data.isEditing ? (
          <CanvasTextEditor
            id={id}
            markdown={data.markdown}
            eventKind="shape"
          />
        ) : data.markdown.trim() ? (
          <div className={styles.textPreview}>
            <MarkdownStringPreview contentId={id} markdown={data.markdown} />
          </div>
        ) : (
          <span className={styles.textPlaceholder}>Введите текст</span>
        )}
      </div>
    </CanvasNodeFrame>
  );
}

'''
text = insert_before(text, "function TaskNodeBody({\n", shape_body, "shell shape node body")
text = replace_once(
    text,
    '''const nodeTypes = {
  [CANVAS_IMAGE_NODE_TYPE]: ImageNodeBody,
  [CANVAS_TASK_NODE_TYPE]: TaskNodeBody,
  [CANVAS_TEXT_NODE_TYPE]: TextNodeBody,
};
''',
    '''const nodeTypes = {
  [CANVAS_IMAGE_NODE_TYPE]: ImageNodeBody,
  [CANVAS_TASK_NODE_TYPE]: TaskNodeBody,
  [CANVAS_TEXT_NODE_TYPE]: TextNodeBody,
  [CANVAS_SHAPE_NODE_TYPE]: ShapeNodeBody,
};
''',
    "shell shape node type",
)
text = replace_once(
    text,
    '''        ...canvasDocumentToTextNodes(nextState.document),
      ];
''',
    '''        ...canvasDocumentToTextNodes(nextState.document),
        ...canvasDocumentToShapeNodes(nextState.document),
      ];
''',
    "shell shape restore",
)
# Runtime shape editing/style/create functions inserted before task create.
shape_runtime = '''  const setShapeEditing = useCallback(
    (id: string, isEditing: boolean) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === id && node.type === CANVAS_SHAPE_NODE_TYPE
            ? { ...node, data: { ...node.data, isEditing } }
            : node,
        ),
      );
    },
    [setNodes],
  );

  const commitShapeNode = useCallback(
    (id: string, markdown: string) => {
      const committedMarkdown = commitTextMarkdown(markdown);
      const nextNodes = nodesRef.current.map((node) =>
        node.id === id && node.type === CANVAS_SHAPE_NODE_TYPE
          ? {
              ...node,
              data: {
                ...node.data,
                markdown: committedMarkdown,
                isEditing: false,
              },
            }
          : node,
      );
      if (!nextNodes.some((node) => node.id === id && node.type === CANVAS_SHAPE_NODE_TYPE))
        return;
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
      controller.setRuntimeNodes(nextNodes);
      syncState();
      scheduleSave();
    },
    [controller, scheduleSave, setNodes, syncState],
  );

  const updateShapeStyle = useCallback(
    (id: string, patch: Partial<CanvasShapeStyle>) => {
      let found = false;
      const nextNodes = nodesRef.current.map((node) => {
        if (node.id !== id || node.type !== CANVAS_SHAPE_NODE_TYPE) return node;
        found = true;
        return {
          ...node,
          data: {
            ...node.data,
            style: { ...node.data.style, ...patch },
          },
        };
      });
      if (!found) return;
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
      controller.setRuntimeNodes(nextNodes);
      syncState();
      scheduleSave();
    },
    [controller, scheduleSave, setNodes, syncState],
  );

  const createShapeNode = useCallback(
    (shape: CanvasShapeVariant) => {
      if (!shellState.canvasId) return;
      const size =
        shape === "circle"
          ? { width: 160, height: 160 }
          : { width: 220, height: 120 };
      const center = centerPosition();
      const position = {
        x: center.x - size.width / 2,
        y: center.y - size.height / 2,
      };
      const zIndex =
        shellState.document.nodes.reduce(
          (maximum, current) => Math.max(maximum, current.zIndex),
          0,
        ) + 1;
      const canonical: CanvasShapeNode = {
        id: createCanvasShapeId(),
        kind: "shape",
        shape,
        markdown: "",
        position,
        size,
        zIndex,
        style: { ...DEFAULT_CANVAS_SHAPE_STYLE },
      };
      const runtime = createCanvasShapeFlowNode({
        id: canonical.id,
        shape: canonical.shape,
        markdown: canonical.markdown,
        position: canonical.position,
        size: canonical.size,
        zIndex: canonical.zIndex,
        style: canonical.style,
        isEditing: true,
      });
      setNodes((current) => [
        ...current.map((item) =>
          item.selected ? { ...item, selected: false } : item,
        ),
        { ...runtime, selected: true },
      ]);
      controller.insertCanvasNodes([canonical]);
      syncState();
    },
    [
      centerPosition,
      controller,
      setNodes,
      shellState.canvasId,
      shellState.document.nodes,
      syncState,
    ],
  );

'''
text = insert_before(
    text,
    "  const createTaskNode = useCallback(\n",
    shape_runtime,
    "shell shape runtime functions",
)
# Add shape events into the existing event effect.
text = replace_once(
    text,
    '''    const onEyedropperStart = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) setStyleEyedropperSourceId(id);
    };
''',
    '''    const onShapeEdit = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) setShapeEditing(id, true);
    };
    const onShapeCommit = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; markdown?: string }>).detail;
      if (detail.id && typeof detail.markdown === "string")
        commitShapeNode(detail.id, detail.markdown);
    };
    const onShapeCancel = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) setShapeEditing(id, false);
    };
    const onShapeStyle = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          id?: string;
          patch?: Partial<CanvasShapeStyle>;
        }>
      ).detail;
      if (detail.id && detail.patch) updateShapeStyle(detail.id, detail.patch);
    };
    const onEyedropperStart = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) setStyleEyedropperSourceId(id);
    };
''',
    "shell shape event handlers",
)
text = replace_once(
    text,
    '''    window.addEventListener("mozg:canvas-text-style", onStyle);
    window.addEventListener(
''',
    '''    window.addEventListener("mozg:canvas-text-style", onStyle);
    window.addEventListener("mozg:canvas-shape-edit", onShapeEdit);
    window.addEventListener("mozg:canvas-shape-commit", onShapeCommit);
    window.addEventListener("mozg:canvas-shape-cancel", onShapeCancel);
    window.addEventListener("mozg:canvas-shape-style", onShapeStyle);
    window.addEventListener(
''',
    "shell shape event listeners",
)
text = replace_once(
    text,
    '''      window.removeEventListener("mozg:canvas-text-style", onStyle);
      window.removeEventListener(
''',
    '''      window.removeEventListener("mozg:canvas-text-style", onStyle);
      window.removeEventListener("mozg:canvas-shape-edit", onShapeEdit);
      window.removeEventListener("mozg:canvas-shape-commit", onShapeCommit);
      window.removeEventListener("mozg:canvas-shape-cancel", onShapeCancel);
      window.removeEventListener("mozg:canvas-shape-style", onShapeStyle);
      window.removeEventListener(
''',
    "shell shape event cleanup",
)
text = replace_once(
    text,
    '''  }, [commitTextNode, setTextEditing, updateTextStyle]);
''',
    '''  }, [
    commitShapeNode,
    commitTextNode,
    setShapeEditing,
    setTextEditing,
    updateShapeStyle,
    updateTextStyle,
  ]);
''',
    "shell shape event dependencies",
)
# Paste shape runtime materialization.
text = replace_once(
    text,
    '''          } else if (node.kind === "task") {
            runtimeNodes.push(
''',
    '''          } else if (node.kind === "shape") {
            runtimeNodes.push(
              createCanvasShapeFlowNode({
                id: node.id,
                shape: node.shape,
                markdown: node.markdown,
                position: node.position,
                size: node.size,
                style: node.style,
                zIndex: node.zIndex,
              }),
            );
          } else if (node.kind === "task") {
            runtimeNodes.push(
''',
    "shell shape clipboard paste",
)
# Eyedropper now supports same-family shape sampling.
text = replace_once(
    text,
    '''          if (
            sourceNode?.type !== CANVAS_TEXT_NODE_TYPE ||
            targetNode?.type !== CANVAS_TEXT_NODE_TYPE
          )
            return;
          updateTextStyle(sourceId, {
            color: targetNode.data.style.color,
            backgroundColor: targetNode.data.style.backgroundColor,
          });
          setStyleEyedropperSourceId(null);
          return;
''',
    '''          if (
            sourceNode?.type === CANVAS_TEXT_NODE_TYPE &&
            targetNode?.type === CANVAS_TEXT_NODE_TYPE
          ) {
            updateTextStyle(sourceId, {
              color: targetNode.data.style.color,
              backgroundColor: targetNode.data.style.backgroundColor,
            });
            setStyleEyedropperSourceId(null);
            return;
          }
          if (
            sourceNode?.type === CANVAS_SHAPE_NODE_TYPE &&
            targetNode?.type === CANVAS_SHAPE_NODE_TYPE
          ) {
            updateShapeStyle(sourceId, {
              color: targetNode.data.style.color,
              fillColor: targetNode.data.style.fillColor,
            });
            setStyleEyedropperSourceId(null);
            return;
          }
          return;
''',
    "shell shape eyedropper",
)
text = replace_once(
    text,
    '''      styleEyedropperSourceId,
      updateTextStyle,
''',
    '''      styleEyedropperSourceId,
      updateShapeStyle,
      updateTextStyle,
''',
    "shell shape eyedropper deps",
)
# Desktop toolbar wiring.
text = replace_once(
    text,
    '''      onAddText={() => createTextNode(null, "", true)}
      onCloseFilePicker={() => setFilePickerOpen(false)}
''',
    '''      onAddText={() => createTextNode(null, "", true)}
      onAddRectangle={() => createShapeNode("rectangle")}
      onAddCircle={() => createShapeNode("circle")}
      onCloseFilePicker={() => setFilePickerOpen(false)}
''',
    "shell desktop shape toolbar wiring",
)
# Non-embedded fallback buttons.
text = replace_once(
    text,
    '''          <button
            className={styles.button}
            type="button"
            onClick={() => createTextNode(null, "", true)}
          >
            {copy.text}
          </button>
''',
    '''          <button
            className={styles.button}
            type="button"
            onClick={() => createTextNode(null, "", true)}
          >
            {copy.text}
          </button>
          <button
            className={styles.button}
            type="button"
            onClick={() => createShapeNode("rectangle")}
          >
            Прямоугольник
          </button>
          <button
            className={styles.button}
            type="button"
            onClick={() => createShapeNode("circle")}
          >
            Круг
          </button>
''',
    "shell fallback shape buttons",
)
write(path, text)


# Shape visual CSS
path = "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css"
text = read(path)
shape_css = '''
.shapeNodeFrame {
  --node-visual-border: 0;
  --node-visual-radius: 0;
  --node-visual-background: transparent;
  --node-visual-shadow: none;
}

.shapeNodeFrame .nodeBody {
  border: 0;
  background: transparent;
  box-shadow: none;
}

.shapeNodeContent {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 12px;
  line-height: 1.25;
  white-space: pre-wrap;
}

.shapeNodeRectangle {
  border-radius: 2px;
}

.shapeNodeCircle {
  border-radius: 50%;
  padding: 18%;
}

.shapeNodeContent .textPreview {
  overflow: hidden;
}
'''
if ".shapeNodeFrame {" in text:
    raise RuntimeError("shape CSS already exists")
text += shape_css
write(path, text)
