from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


root = Path(__file__).resolve().parents[1]
shell_path = root / "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx"
shell = shell_path.read_text()

shell = replace_once(
    shell,
    '''  const duplicateSelectionAtDragStart = useCallback(\n    (event: ReactMouseEvent, dragNodes: readonly CanvasFlowNode[]): void => {\n      if (!event.altKey || altDuplicateGestureRef.current) return;\n''',
    '''  const duplicateSelectionAtDragStart = useCallback(\n    (altKey: boolean, dragNodes: readonly CanvasFlowNode[]): void => {\n      if (!altKey || altDuplicateGestureRef.current) return;\n''',
    "duplicate helper event type",
)

shell = replace_once(
    shell,
    '''  const handleNodeDragStart = useCallback(\n    (event: ReactMouseEvent, node: CanvasFlowNode): void => {\n''',
    '''  const handleNodeDragStart = useCallback(\n    (event: MouseEvent | TouchEvent, node: CanvasFlowNode): void => {\n''',
    "React Flow native node drag event",
)

shell = replace_once(
    shell,
    '''      duplicateSelectionAtDragStart(event, [node]);\n''',
    '''      duplicateSelectionAtDragStart(event.altKey, [node]);\n''',
    "single-node alt flag",
)

shell = replace_once(
    shell,
    '''      duplicateSelectionAtDragStart(event, selectedNodes);\n''',
    '''      duplicateSelectionAtDragStart(event.altKey, selectedNodes);\n''',
    "selection alt flag",
)

shell_path.write_text(shell)
