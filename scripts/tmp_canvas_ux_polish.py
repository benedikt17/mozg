from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


root = Path(__file__).resolve().parents[1]
frame_path = root / "src/prototype/infinite-canvas-local-shell/canvas-node-frame.tsx"
shell_path = root / "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx"
css_path = root / "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css"
selection_test_path = root / "tests/canvas-miro-selection-runtime.test.ts"

# ---------------------------------------------------------------------------
# Canvas node frame: hide per-node controls for multi-selection and remove the
# text-only wrapper that caused edit mode to become a full-size inner card.
# ---------------------------------------------------------------------------
frame = frame_path.read_text()
frame = replace_once(
    frame,
    '''  Position,\n  useInternalNode,\n  useNodeId,\n} from "@xyflow/react";\nimport {\n  cloneElement,\n  isValidElement,\n  type CSSProperties,\n  type ReactNode,\n} from "react";''',
    '''  Position,\n  useStore,\n} from "@xyflow/react";\nimport { type CSSProperties, type ReactNode } from "react";''',
    "frame imports",
)
frame = replace_once(
    frame,
    '''function SelectionLayer({\n  selected,\n}: {\n  selected: boolean;\n}): React.JSX.Element {\n  return (\n    <span\n      className={styles.selectionLayer}\n      data-selected={selected ? "true" : "false"}\n      aria-hidden="true"\n    />\n  );\n}\n''',
    '''function useIndividualSelectionVisible(selected: boolean): boolean {\n  const selectedNodeCount = useStore((state) =>\n    state.nodes.reduce(\n      (count, node) => count + (node.selected ? 1 : 0),\n      0,\n    ),\n  );\n  return selected && selectedNodeCount === 1;\n}\n\nfunction SelectionLayer({\n  selected,\n}: {\n  selected: boolean;\n}): React.JSX.Element {\n  return (\n    <span\n      className={styles.selectionLayer}\n      data-selected={selected ? "true" : "false"}\n      aria-hidden="true"\n    />\n  );\n}\n''',
    "selection visibility helper",
)
frame = replace_once(
    frame,
    '''function ResizeLayer({\n  keepAspectRatio,\n  minHeight,\n  minWidth,\n  selected,\n}: Pick<CanvasNodeFrameProps, "keepAspectRatio" | "minHeight" | "minWidth"> & {\n  selected: boolean;\n}): React.JSX.Element {\n  return (\n    <NodeResizer\n      color="#0f766e"\n      isVisible={selected}\n      keepAspectRatio={keepAspectRatio}\n      minWidth={minWidth}\n      minHeight={minHeight}\n    />\n  );\n}\n''',
    '''function ResizeLayer({\n  keepAspectRatio,\n  minHeight,\n  minWidth,\n  selected,\n}: Pick<CanvasNodeFrameProps, "keepAspectRatio" | "minHeight" | "minWidth"> & {\n  selected: boolean;\n}): React.JSX.Element {\n  return (\n    <NodeResizer\n      color="#0f766e"\n      isVisible={selected}\n      keepAspectRatio={keepAspectRatio}\n      minWidth={minWidth}\n      minHeight={minHeight}\n    />\n  );\n}\n''',
    "resize layer stable",
)
frame = replace_once(
    frame,
    '''export function ConnectionHandleLayer({\n  selected,\n}: {\n  selected: boolean;\n}): React.JSX.Element {\n  return (\n    <div className={styles.connectionHandleLayer} data-slot="connections">\n      {CONNECTION_HANDLES.map((handle) => (\n        <Handle\n          key={handle.id}\n          id={handle.id}\n          type="source"\n          position={handle.position}\n          className={`${styles.connectionHandle} nodrag nopan nowheel`}\n          data-side={handle.id}\n          data-visible={selected ? "true" : "false"}\n''',
    '''export function ConnectionHandleLayer({\n  selected,\n}: {\n  selected: boolean;\n}): React.JSX.Element {\n  const visible = useIndividualSelectionVisible(selected);\n  return (\n    <div className={styles.connectionHandleLayer} data-slot="connections">\n      {CONNECTION_HANDLES.map((handle) => (\n        <Handle\n          key={handle.id}\n          id={handle.id}\n          type="source"\n          position={handle.position}\n          className={`${styles.connectionHandle} nodrag nopan nowheel`}\n          data-side={handle.id}\n          data-visible={visible ? "true" : "false"}\n''',
    "multi-selection connection handles",
)
start = frame.index('type TextInnerStyle = CSSProperties & {')
end = frame.index('export function CanvasNodeFrame({', start)
frame = frame[:start] + frame[end:]
frame = replace_once(
    frame,
    '''  const nodeId = useNodeId();\n  const internalNode = useInternalNode(nodeId ?? "");\n  const isTextFrame = Boolean(className?.includes(styles.textNodeFrame));\n  const textAlign =\n    (\n      internalNode?.data as {\n        style?: { textAlign?: CanvasTextAlignment };\n      }\n    )?.style?.textAlign ?? "center";\n  const renderedToolbar = toolbar;\n  const renderedChildren = isTextFrame\n    ? withCenteredTextContent(children, textAlign)\n    : children;\n\n  return (\n''',
    '''  const renderedToolbar = toolbar;\n  const individualSelectionVisible = useIndividualSelectionVisible(selected);\n\n  return (\n''',
    "remove text wrapper",
)
frame = replace_once(
    frame,
    '''      data-canvas-node-frame="true"\n      data-canvas-text-align={isTextFrame ? textAlign : undefined}\n      data-selected={selected ? "true" : "false"}\n''',
    '''      data-canvas-node-frame="true"\n      data-selected={selected ? "true" : "false"}\n''',
    "remove text frame data alignment",
)
frame = replace_once(
    frame,
    '''      <SelectionLayer selected={selected} />\n      <ResizeLayer\n        selected={selected}\n''',
    '''      <SelectionLayer selected={individualSelectionVisible} />\n      <ResizeLayer\n        selected={individualSelectionVisible}\n''',
    "single-node controls",
)
frame = replace_once(
    frame,
    '''      <div className={styles.nodeBody}>{renderedChildren}</div>''',
    '''      <div className={styles.nodeBody}>{children}</div>''',
    "direct node children",
)
frame_path.write_text(frame)

# ---------------------------------------------------------------------------
# CSS: zero hover affordance, in-place vertically centered editor, native dark
# blinking caret, and no full-height editing surface.
# ---------------------------------------------------------------------------
css = css_path.read_text()
css = replace_once(
    css,
    '''.connectionHandle[data-visible="true"],\n.nodeFrame:hover .connectionHandle {\n  opacity: 1;\n}\n''',
    '''.connectionHandle[data-visible="true"] {\n  opacity: 1;\n}\n''',
    "remove hover handles",
)
css = replace_once(
    css,
    '''.textNodeContent {\n  box-sizing: border-box;\n  width: 100%;\n  height: 100%;\n  min-width: 0;\n  min-height: 0;\n  overflow: visible;\n  line-height: 1.25;\n  white-space: pre-wrap;\n}\n.textPreview {\n  width: 100%;\n  height: 100%;\n  overflow: visible;\n''',
    '''.textNodeContent {\n  box-sizing: border-box;\n  width: 100%;\n  height: 100%;\n  min-width: 0;\n  min-height: 0;\n  display: flex;\n  align-items: center;\n  overflow: visible;\n  line-height: 1.25;\n  white-space: pre-wrap;\n}\n.textPreview {\n  width: 100%;\n  height: auto;\n  max-height: 100%;\n  overflow: visible;\n''',
    "center preview and editor host",
)
css = replace_once(
    css,
    '''.textEditorInput {\n  box-sizing: border-box;\n  width: 100%;\n  height: 100%;\n  min-width: 0;\n  min-height: 0;\n  resize: none;\n  overflow: hidden;\n  border: 0;\n  outline: 0;\n  padding: 0;\n  color: inherit;\n  background: transparent;\n  font: inherit;\n  line-height: inherit;\n  text-decoration: inherit;\n}\n''',
    '''.textEditorInput {\n  box-sizing: border-box;\n  width: 100%;\n  height: auto;\n  max-height: 100%;\n  min-width: 0;\n  min-height: 1.25em;\n  align-self: center;\n  field-sizing: content;\n  resize: none;\n  overflow: hidden;\n  border: 0;\n  outline: 0;\n  padding: 0;\n  color: inherit;\n  caret-color: #111111;\n  background: transparent;\n  font: inherit;\n  line-height: inherit;\n  text-align: inherit;\n  text-decoration: inherit;\n  white-space: pre-wrap;\n}\n''',
    "in-place text editor css",
)
css = replace_once(
    css,
    '''.textEditorInput::placeholder,\n.textPlaceholder {\n  color: #a8a29e;\n''',
    '''.textEditorInput::placeholder,\n.textPlaceholder {\n  color: #a8a29e;\n''',
    "placeholder stable",
)
css = replace_once(
    css,
    '''  text-decoration: none;\n}\n.textSelectionToolbar {\n''',
    '''  text-decoration: none;\n}\n.textPlaceholder {\n  width: 100%;\n}\n.textSelectionToolbar {\n''',
    "placeholder width",
)
css_path.write_text(css)

# ---------------------------------------------------------------------------
# Runtime: focus a native caret at the end of the existing text, and duplicate
# the dragged node/selection in place when Alt is held at drag start.
# ---------------------------------------------------------------------------
shell = shell_path.read_text()
shell = replace_once(
    shell,
    '''  type DragEvent as ReactDragEvent,\n  type PointerEvent as ReactPointerEvent,\n} from "react";''',
    '''  type DragEvent as ReactDragEvent,\n  type MouseEvent as ReactMouseEvent,\n  type PointerEvent as ReactPointerEvent,\n} from "react";''',
    "mouse event import",
)
shell = replace_once(
    shell,
    '''  const nodeGeometrySignatureRef = useRef("");\n  const nodeDragActiveRef = useRef(false);\n  const middlePanActiveRef = useRef(false);''',
    '''  const nodeGeometrySignatureRef = useRef("");\n  const nodeDragActiveRef = useRef(false);\n  const altDuplicateGestureRef = useRef(false);\n  const middlePanActiveRef = useRef(false);''',
    "alt drag ref",
)
shell = replace_once(
    shell,
    '''function CanvasTextEditor({\n  id,\n  markdown,\n}: {\n  id: string;\n  markdown: string;\n}): React.JSX.Element {\n  const [draft, setDraft] = useState(markdown);\n  const skipNextBlurCommitRef = useRef(false);\n''',
    '''function CanvasTextEditor({\n  id,\n  markdown,\n}: {\n  id: string;\n  markdown: string;\n}): React.JSX.Element {\n  const [draft, setDraft] = useState(markdown);\n  const inputRef = useRef<HTMLTextAreaElement | null>(null);\n  const skipNextBlurCommitRef = useRef(false);\n\n  useEffect(() => {\n    const input = inputRef.current;\n    if (!input) return;\n    input.focus({ preventScroll: true });\n    const caret = input.value.length;\n    input.setSelectionRange(caret, caret);\n  }, []);\n''',
    "editor caret focus",
)
shell = replace_once(
    shell,
    '''    <textarea\n      autoFocus\n      value={draft}\n''',
    '''    <textarea\n      ref={inputRef}\n      value={draft}\n''',
    "textarea ref",
)
# Remove the old drag-start callback, which appears before pasteCanvasNodes.
shell = replace_once(
    shell,
    '''  const handleNodeDragStart = useCallback((): void => {\n    nodeDragActiveRef.current = true;\n    edgeRemovalSuppressionUntilRef.current = Date.now() + 5000;\n  }, []);\n\n''',
    '''''',
    "remove old drag start",
)
shell = replace_once(
    shell,
    '''  const handleNodeDragStop = useCallback((): void => {\n    nodeDragActiveRef.current = false;\n    edgeRemovalSuppressionUntilRef.current = Date.now() + 5000;\n''',
    '''  const handleNodeDragStop = useCallback((): void => {\n    nodeDragActiveRef.current = false;\n    altDuplicateGestureRef.current = false;\n    edgeRemovalSuppressionUntilRef.current = Date.now() + 5000;\n''',
    "reset alt gesture",
)
# Paste can now target an explicit flow coordinate and optionally preserve the
# current selection; normal Ctrl/Cmd+V behavior remains unchanged.
shell = replace_once(
    shell,
    '''  const pasteCanvasNodes = useCallback(\n    async (payload: CanvasNodeClipboardPayload) => {\n''',
    '''  const pasteCanvasNodes = useCallback(\n    async (\n      payload: CanvasNodeClipboardPayload,\n      options?: { target?: FlowPosition; selectPasted?: boolean },\n    ) => {\n''',
    "paste options",
)
shell = replace_once(
    shell,
    '''      const target = pointerRef.current\n        ? screenToFlowRef.current(pointerRef.current)\n        : centerPosition();\n''',
    '''      const target =\n        options?.target ??\n        (pointerRef.current\n          ? screenToFlowRef.current(pointerRef.current)\n          : centerPosition());\n''',
    "explicit paste target",
)
shell = replace_once(
    shell,
    '''        setNodes((current) => [\n          ...current.map((node) =>\n            node.selected ? { ...node, selected: false } : node,\n          ),\n          ...runtimeNodes.map((node) => ({ ...node, selected: true })),\n        ]);\n''',
    '''        const selectPasted = options?.selectPasted !== false;\n        setNodes((current) => [\n          ...(selectPasted\n            ? current.map((node) =>\n                node.selected ? { ...node, selected: false } : node,\n              )\n            : current),\n          ...runtimeNodes.map((node) => ({\n            ...node,\n            selected: selectPasted,\n          })),\n        ]);\n''',
    "preserve selection for alt duplicate",
)
# Insert the Alt-drag logic after pasteCanvasNodes, where the callback is in
# scope and before clipboard listeners/rendering consume the drag handlers.
needle = '''  useEffect(() => {\n    const onCopy = (event: ClipboardEvent) => {\n'''
insert = '''  const duplicateSelectionAtDragStart = useCallback(\n    (event: ReactMouseEvent, dragNodes: readonly CanvasFlowNode[]): void => {\n      if (!event.altKey || altDuplicateGestureRef.current) return;\n      const selectedNodeIds = new Set(dragNodes.map((node) => node.id));\n      const payload = createCanvasNodeClipboardPayload(\n        controller.state.document,\n        selectedNodeIds,\n      );\n      if (!payload) return;\n\n      let minX = Number.POSITIVE_INFINITY;\n      let minY = Number.POSITIVE_INFINITY;\n      let maxX = Number.NEGATIVE_INFINITY;\n      let maxY = Number.NEGATIVE_INFINITY;\n      for (const node of payload.nodes) {\n        minX = Math.min(minX, node.position.x);\n        minY = Math.min(minY, node.position.y);\n        maxX = Math.max(maxX, node.position.x + node.size.width);\n        maxY = Math.max(maxY, node.position.y + node.size.height);\n      }\n      altDuplicateGestureRef.current = true;\n      void pasteCanvasNodes(payload, {\n        target: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },\n        selectPasted: false,\n      });\n    },\n    [controller, pasteCanvasNodes],\n  );\n\n  const handleNodeDragStart = useCallback(\n    (event: ReactMouseEvent, node: CanvasFlowNode): void => {\n      nodeDragActiveRef.current = true;\n      edgeRemovalSuppressionUntilRef.current = Date.now() + 5000;\n      const selectedNodes = nodesRef.current.filter((candidate) =>\n        Boolean(candidate.selected),\n      );\n      if (selectedNodes.length > 1) return;\n      duplicateSelectionAtDragStart(event, [node]);\n    },\n    [duplicateSelectionAtDragStart],\n  );\n\n  const handleSelectionDragStart = useCallback(\n    (event: ReactMouseEvent, selectedNodes: CanvasFlowNode[]): void => {\n      nodeDragActiveRef.current = true;\n      edgeRemovalSuppressionUntilRef.current = Date.now() + 5000;\n      duplicateSelectionAtDragStart(event, selectedNodes);\n    },\n    [duplicateSelectionAtDragStart],\n  );\n\n'''
if shell.count(needle) != 1:
    raise RuntimeError(f"insert alt drag handlers: expected one match, found {shell.count(needle)}")
shell = shell.replace(needle, insert + needle, 1)
shell = shell.replace(
    '''            onNodeDragStart={handleNodeDragStart}\n            onNodeDragStop={handleNodeDragStop}\n''',
    '''            onNodeDragStart={handleNodeDragStart}\n            onSelectionDragStart={handleSelectionDragStart}\n            onNodeDragStop={handleNodeDragStop}\n''',
)
if shell.count('onSelectionDragStart={handleSelectionDragStart}') != 2:
    raise RuntimeError("expected Alt selection handler on both ReactFlow surfaces")
shell_path.write_text(shell)

# ---------------------------------------------------------------------------
# Regression contracts. These complement the full Vitest/RLS/E2E gate and the
# owner Preview smoke that is required before Production.
# ---------------------------------------------------------------------------
selection_test = selection_test_path.read_text()
selection_test = replace_once(
    selection_test,
    '''  it("keeps the arrow cursor while dragging a multi-selection", () => {\n    const css = fs.readFileSync(shellCssPath, "utf8");\n\n    expect(css).toContain(".react-flow__nodesselection-rect");\n    expect(css).toContain("cursor: default !important");\n  });\n''',
    '''  it("keeps the arrow cursor while dragging a multi-selection", () => {\n    const css = fs.readFileSync(shellCssPath, "utf8");\n\n    expect(css).toContain(".react-flow__nodesselection-rect");\n    expect(css).toContain("cursor: default !important");\n  });\n\n  it("keeps hover visually silent and suppresses per-node controls for multi-selection", () => {\n    const css = fs.readFileSync(shellCssPath, "utf8");\n    const frame = fs.readFileSync(\n      path.resolve(\n        process.cwd(),\n        "src/prototype/infinite-canvas-local-shell/canvas-node-frame.tsx",\n      ),\n      "utf8",\n    );\n\n    expect(css).not.toContain(".nodeFrame:hover .connectionHandle");\n    expect(frame).toContain("selectedNodeCount === 1");\n    expect(frame).toContain("isVisible={selected}");\n    expect(frame).toContain('data-visible={visible ? "true" : "false"}');\n  });\n''',
    "selection regression test",
)
selection_test_path.write_text(selection_test)

(root / "tests/canvas-miro-text-editing-runtime.test.ts").write_text(
    '''import fs from "node:fs";\nimport path from "node:path";\nimport { describe, expect, it } from "vitest";\n\nconst shell = fs.readFileSync(\n  path.resolve(\n    process.cwd(),\n    "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",\n  ),\n  "utf8",\n);\nconst frame = fs.readFileSync(\n  path.resolve(\n    process.cwd(),\n    "src/prototype/infinite-canvas-local-shell/canvas-node-frame.tsx",\n  ),\n  "utf8",\n);\nconst css = fs.readFileSync(\n  path.resolve(\n    process.cwd(),\n    "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css",\n  ),\n  "utf8",\n);\n\ndescribe("Canvas Miro-style in-place text editing", () => {\n  it("focuses a native caret without replacing the node with a full-size edit card", () => {\n    expect(shell).toContain("input.focus({ preventScroll: true })");\n    expect(shell).toContain("input.setSelectionRange(caret, caret)");\n    expect(frame).not.toContain("withCenteredTextContent");\n    expect(css).toContain("caret-color: #111111");\n    expect(css).toContain("field-sizing: content");\n  });\n\n  it("keeps preview and editor vertically centered in the same node geometry", () => {\n    expect(css).toMatch(/\\.textNodeContent \\{[\\s\\S]*display: flex;[\\s\\S]*align-items: center;/);\n    expect(css).toMatch(/\\.textPreview \\{[\\s\\S]*height: auto;[\\s\\S]*max-height: 100%;/);\n    expect(css).toMatch(/\\.textEditorInput \\{[\\s\\S]*height: auto;[\\s\\S]*align-self: center;/);\n  });\n});\n'''
)

(root / "tests/canvas-alt-drag-duplicate-runtime.test.ts").write_text(
    '''import fs from "node:fs";\nimport path from "node:path";\nimport { describe, expect, it } from "vitest";\n\nconst shell = fs.readFileSync(\n  path.resolve(\n    process.cwd(),\n    "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",\n  ),\n  "utf8",\n);\n\ndescribe("Canvas Alt-drag duplication", () => {\n  it("duplicates the dragged object or selection at its original center", () => {\n    expect(shell).toContain("if (!event.altKey || altDuplicateGestureRef.current) return");\n    expect(shell).toContain("createCanvasNodeClipboardPayload(");\n    expect(shell).toContain("target: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }");\n    expect(shell).toContain("selectPasted: false");\n  });\n\n  it("supports both single-node and multi-selection drag starts", () => {\n    expect(shell.match(/onNodeDragStart=\\{handleNodeDragStart\\}/g)).toHaveLength(2);\n    expect(shell.match(/onSelectionDragStart=\\{handleSelectionDragStart\\}/g)).toHaveLength(2);\n    expect(shell).toContain("if (selectedNodes.length > 1) return");\n  });\n});\n'''
)
