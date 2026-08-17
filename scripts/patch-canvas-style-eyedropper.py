from pathlib import Path

SHELL = Path(
    "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx"
)
CSS = Path(
    "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css"
)

text = SHELL.read_text()


def require_once(value: str, label: str) -> int:
    count = text.count(value)
    if count != 1:
        raise SystemExit(f"{label}: expected once, found {count}")
    return text.index(value)


# 1. Toolbar dispatch helper.
if '"mozg:canvas-style-eyedropper-start"' not in text:
    marker = "function TextSelectionToolbar({"
    index = require_once(marker, "TextSelectionToolbar")
    helper = '''function dispatchCanvasStyleEyedropperStart(id: string): void {
  window.dispatchEvent(
    new CustomEvent("mozg:canvas-style-eyedropper-start", {
      detail: { id },
    }),
  );
}

'''
    text = text[:index] + helper + text[index:]

# 2. Pipette button immediately after background color picker and before divider.
if 'aria-label="Пипетка"' not in text:
    background_label = 'label="Цвет фона"'
    label_index = text.index(background_label)
    picker_end = text.index("/>", label_index) + 2
    divider = '<span className={styles.textToolbarDivider} aria-hidden="true" />'
    divider_index = text.index(divider, picker_end)
    button = '''<button
        type="button"
        className={`${styles.textToolbarButton} ${styles.styleEyedropperButton}`}
        aria-label="Пипетка"
        title="Скопировать цвет текста и фона"
        onClick={() => dispatchCanvasStyleEyedropperStart(id)}
      >
        <svg
          className={styles.styleEyedropperIcon}
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="m14.5 5.5 4-4a2.12 2.12 0 0 1 3 3l-4 4m-3-3 4 4m-4-4-9.8 9.8a2 2 0 0 0-.5.8L3 21l4.9-1.2a2 2 0 0 0 .8-.5l9.8-9.8"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      '''
    text = text[:divider_index] + button + text[divider_index:]

# 3. Transient picker source state.
if "styleEyedropperSourceId" not in text:
    state_marker = '''  const [touchViewportGestureActive, setTouchViewportGestureActive] =
    useState(false);'''
    state_index = require_once(state_marker, "touch viewport state")
    state_end = state_index + len(state_marker)
    state_addition = '''
  const [styleEyedropperSourceId, setStyleEyedropperSourceId] = useState<
    string | null
  >(null);'''
    text = text[:state_end] + state_addition + text[state_end:]

# 4. Start event listener piggybacks on the existing text runtime effect.
if "const onEyedropperStart" not in text:
    listener_anchor = '    window.addEventListener("mozg:canvas-text-edit", onEdit);'
    listener_index = require_once(listener_anchor, "text edit event listener")
    listener = '''    const onEyedropperStart = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) setStyleEyedropperSourceId(id);
    };
'''
    text = text[:listener_index] + listener + text[listener_index:]

    style_add_anchor = '    window.addEventListener("mozg:canvas-text-style", onStyle);'
    style_add_index = require_once(style_add_anchor, "text style event listener")
    style_add_end = style_add_index + len(style_add_anchor)
    add_listener = '''
    window.addEventListener(
      "mozg:canvas-style-eyedropper-start",
      onEyedropperStart,
    );'''
    text = text[:style_add_end] + add_listener + text[style_add_end:]

    style_remove_anchor = (
        '      window.removeEventListener("mozg:canvas-text-style", onStyle);'
    )
    style_remove_index = require_once(style_remove_anchor, "text style remove listener")
    style_remove_end = style_remove_index + len(style_remove_anchor)
    remove_listener = '''
      window.removeEventListener(
        "mozg:canvas-style-eyedropper-start",
        onEyedropperStart,
      );'''
    text = text[:style_remove_end] + remove_listener + text[style_remove_end:]

# 5. Capture a target before normal React Flow selection/drag logic.
handler_marker = "  const handleCanvasPointerDown = useCallback("
handler_index = require_once(handler_marker, "Canvas pointer handler")
touch_marker = '      if (event.pointerType === "touch") {'
touch_index = text.index(touch_marker, handler_index)
handler_slice = text[handler_index:touch_index]
if "targetNode?.type !== CANVAS_TEXT_NODE_TYPE" not in handler_slice:
    logic = '''      if (styleEyedropperSourceId && event.button === 0) {
        const targetElement =
          event.target instanceof Element
            ? event.target.closest<HTMLElement>(".react-flow__node")
            : null;
        if (!targetElement) {
          setStyleEyedropperSourceId(null);
        } else {
          event.preventDefault();
          event.stopPropagation();
          const sourceId = styleEyedropperSourceId;
          const targetId = targetElement.dataset.id;
          if (!targetId || targetId === sourceId) return;
          const runtimeNodes = reactFlow.getNodes();
          const sourceNode = runtimeNodes.find((node) => node.id === sourceId);
          const targetNode = runtimeNodes.find((node) => node.id === targetId);
          if (
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
        }
      }
'''
    text = text[:touch_index] + logic + text[touch_index:]

# 6. Add dependencies only to this callback.
handler_index = text.index(handler_marker)
handler_end = text.index("  const handleCanvasPointerMove", handler_index)
handler_block = text[handler_index:handler_end]
old_deps = "    [beginTouchViewportGesture, cancelPanInertia, reactFlow],\n  );"
if old_deps in handler_block:
    new_deps = '''    [
      beginTouchViewportGesture,
      cancelPanInertia,
      reactFlow,
      styleEyedropperSourceId,
      updateTextStyle,
    ],
  );'''
    handler_block = handler_block.replace(old_deps, new_deps, 1)
    text = text[:handler_index] + handler_block + text[handler_end:]
elif "styleEyedropperSourceId," not in handler_block:
    raise SystemExit("Canvas pointer handler dependencies not found")

# 7. Crosshair state on the two shell wrappers.
old_class = 'className={`${styles.canvas} ${dropActive ? styles.dropActive : ""}`}'
new_class = 'className={`${styles.canvas} ${dropActive ? styles.dropActive : ""} ${styleEyedropperSourceId ? styles.canvasStyleEyedropperActive : ""}`}'
if old_class in text:
    count = text.count(old_class)
    if count != 2:
        raise SystemExit(f"expected 2 Canvas wrapper classes, found {count}")
    text = text.replace(old_class, new_class)
elif text.count(new_class) != 2:
    raise SystemExit("Canvas wrapper eyedropper class state missing")

SHELL.write_text(text)

css = CSS.read_text()
if ".styleEyedropperButton {" not in css:
    marker = '''.textToolbarButton:disabled {
  color: #a8a29e;
  cursor: default;
}
'''
    if css.count(marker) != 1:
        raise SystemExit("toolbar disabled CSS marker missing")
    addition = '''.styleEyedropperButton {
  display: grid;
  place-items: center;
}

.styleEyedropperIcon {
  width: 16px;
  height: 16px;
}

.canvasStyleEyedropperActive,
.canvasStyleEyedropperActive :global(.react-flow__node) {
  cursor: crosshair !important;
}

'''
    css = css.replace(marker, marker + addition, 1)
CSS.write_text(css)
