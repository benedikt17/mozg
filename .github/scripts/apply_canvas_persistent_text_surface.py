from pathlib import Path
import subprocess

shell_path = Path("src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx")
shell = shell_path.read_text()

if "  useLayoutEffect," not in shell:
    shell = shell.replace(
        "  useEffect,\n  useMemo,",
        "  useEffect,\n  useLayoutEffect,\n  useMemo,",
        1,
    )

shell = shell.replace(
    'import { MarkdownStringPreview } from "@/prototype/knowledge/markdown-document-preview";\n',
    '',
    1,
)

start = shell.index("function CanvasTextEditor({")
end = shell.index("\nfunction TaskNodeBody({", start)
replacement = r'''type PendingCanvasTextCaret = {
  id: string;
  offset: number;
};

let pendingCanvasTextCaret: PendingCanvasTextCaret | null = null;

function canvasTextCaretOffsetAtPoint(
  surface: HTMLDivElement,
  clientX: number,
  clientY: number,
): number | null {
  const caretDocument = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  const caretPosition = caretDocument.caretPositionFromPoint?.(clientX, clientY);
  let node: Node | null = caretPosition?.offsetNode ?? null;
  let offset = caretPosition?.offset ?? 0;

  if (!node) {
    const range = caretDocument.caretRangeFromPoint?.(clientX, clientY);
    if (range) {
      node = range.startContainer;
      offset = range.startOffset;
    }
  }
  if (!node || !surface.contains(node)) return null;

  const range = document.createRange();
  range.selectNodeContents(surface);
  try {
    range.setEnd(node, offset);
  } catch {
    return null;
  }
  return range.toString().length;
}

function placeCanvasTextCaretAtOffset(
  surface: HTMLDivElement,
  requestedOffset: number,
): void {
  const selection = window.getSelection();
  if (!selection) return;

  const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, requestedOffset);
  let node = walker.nextNode();
  let lastTextNode: Text | null = null;

  while (node) {
    const textNode = node as Text;
    lastTextNode = textNode;
    if (remaining <= textNode.data.length) {
      const range = document.createRange();
      range.setStart(textNode, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= textNode.data.length;
    node = walker.nextNode();
  }

  const range = document.createRange();
  if (lastTextNode) {
    range.setStart(lastTextNode, lastTextNode.data.length);
  } else {
    range.selectNodeContents(surface);
    range.collapse(false);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function CanvasTextSurface({
  id,
  markdown,
  isEditing,
}: {
  id: string;
  markdown: string;
  isEditing: boolean;
}): React.JSX.Element {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef(markdown);
  const wasEditingRef = useRef(false);
  const skipNextBlurCommitRef = useRef(false);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const enteringEdit = isEditing && !wasEditingRef.current;
    if (enteringEdit) {
      draftRef.current = markdown;
      surface.focus({ preventScroll: true });
      const pending = pendingCanvasTextCaret;
      pendingCanvasTextCaret = null;
      placeCanvasTextCaretAtOffset(
        surface,
        pending?.id === id ? pending.offset : markdown.length,
      );
    } else if (!isEditing) {
      draftRef.current = markdown;
      if (surface.textContent !== markdown) surface.textContent = markdown;
    }

    wasEditingRef.current = isEditing;
  }, [id, isEditing, markdown]);

  const commit = () => {
    window.dispatchEvent(
      new CustomEvent("mozg:canvas-text-commit", {
        detail: { id, markdown: commitTextMarkdown(draftRef.current) },
      }),
    );
  };

  const cancel = () => {
    skipNextBlurCommitRef.current = true;
    window.dispatchEvent(
      new CustomEvent("mozg:canvas-text-cancel", { detail: { id } }),
    );
  };

  return (
    <div
      ref={surfaceRef}
      className={`${styles.textSurface} ${isEditing ? "nodrag nopan nowheel" : ""}`.trim()}
      role={isEditing ? "textbox" : undefined}
      aria-label={isEditing ? "Canvas text" : undefined}
      aria-multiline={isEditing ? "true" : undefined}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (isEditing) return;
        pendingCanvasTextCaret = {
          id,
          offset:
            canvasTextCaretOffsetAtPoint(
              event.currentTarget,
              event.clientX,
              event.clientY,
            ) ?? markdown.length,
        };
        window.dispatchEvent(
          new CustomEvent("mozg:canvas-text-edit", { detail: { id } }),
        );
      }}
      onBlur={() => {
        if (!isEditing) return;
        if (skipNextBlurCommitRef.current) {
          skipNextBlurCommitRef.current = false;
          return;
        }
        commit();
      }}
      onInput={(event) => {
        if (!isEditing) return;
        draftRef.current = event.currentTarget.innerText.replace(/\r/g, "");
        window.dispatchEvent(
          new CustomEvent("mozg:canvas-text-draft", {
            detail: { id, markdown: draftRef.current },
          }),
        );
      }}
      onKeyDown={(event) => {
        if (!isEditing) return;
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      onPaste={(event) => {
        if (isEditing) event.stopPropagation();
      }}
    >
      {markdown}
    </div>
  );
}

function TextNodeBody({
  data,
  selected,
  id,
}: NodeProps<CanvasTextFlowNode>): React.JSX.Element {
  const textStyle = canvasTextCss(data.style);
  return (
    <CanvasNodeFrame
      selected={selected}
      minWidth={120}
      minHeight={32}
      className={styles.textNodeFrame}
      toolbar={<TextSelectionToolbar id={id} style={data.style} />}
      connectionHandleLayer={<ConnectionHandleLayer selected={selected} />}
    >
      <div className={styles.textNodeContent} style={textStyle}>
        <CanvasTextSurface
          id={id}
          markdown={data.markdown}
          isEditing={Boolean(data.isEditing)}
        />
      </div>
    </CanvasNodeFrame>
  );
}
'''
shell_path.write_text(shell[:start] + replacement + shell[end:])

css_path = Path("src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css")
css = css_path.read_text()
start = css.index(".textPreview {")
end = css.index("\n.textSelectionToolbar {", start)
css_replacement = '''.textSurface {
  box-sizing: border-box;
  display: block;
  width: 100%;
  height: auto;
  max-height: 100%;
  min-width: 0;
  min-height: 1.25em;
  align-self: center;
  overflow: visible;
  margin: 0;
  border: 0;
  outline: 0;
  padding: 0;
  color: inherit;
  caret-color: #111111;
  background: transparent;
  font: inherit;
  line-height: inherit;
  text-align: inherit;
  text-decoration: inherit;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: normal;
}
.textSurface[contenteditable="true"] {
  cursor: text;
}
.textSurface:empty::before {
  content: "Type something";
  color: #a8a29e;
  font: inherit;
  font-style: normal;
  font-weight: 400;
  text-decoration: none;
  pointer-events: none;
}
'''
css_path.write_text(css[:start] + css_replacement + css[end:])

frame_path = Path("src/prototype/infinite-canvas-local-shell/canvas-node-frame.tsx")
clean_frame = subprocess.check_output([
    "git", "show",
    "50db4788e91c51a4dbb8a6923bd07efb5d2d7083:src/prototype/infinite-canvas-local-shell/canvas-node-frame.tsx",
], text=True)
frame_path.write_text(clean_frame)

test_path = Path("tests/canvas-miro-text-editing-runtime.test.ts")
test_path.write_text(r'''import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const shell = fs.readFileSync(
  path.resolve(process.cwd(), "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx"),
  "utf8",
);
const frame = fs.readFileSync(
  path.resolve(process.cwd(), "src/prototype/infinite-canvas-local-shell/canvas-node-frame.tsx"),
  "utf8",
);
const css = fs.readFileSync(
  path.resolve(process.cwd(), "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css"),
  "utf8",
);

describe("Canvas Miro-style in-place text editing", () => {
  it("uses one persistent DOM surface in reading and editing states", () => {
    expect(shell).toContain("function CanvasTextSurface({");
    expect(shell).toContain("contentEditable={isEditing}");
    expect(shell).toContain("useLayoutEffect(() => {");
    expect(shell).not.toContain("function CanvasTextEditor({");
    expect(shell).not.toContain("<MarkdownStringPreview contentId={id}");
    expect(shell).not.toMatch(/<textarea[\s\S]*?aria-label="Canvas text"/);
    expect(frame).not.toContain("restoreCanvasTextEditSnapshot");
  });

  it("maps the double-click point to the caret before edit mode starts", () => {
    expect(shell).toContain("canvasTextCaretOffsetAtPoint(");
    expect(shell).toContain("pendingCanvasTextCaret = {");
    expect(shell).toContain("clientX");
    expect(shell).toContain("clientY");
    expect(shell).toContain("placeCanvasTextCaretAtOffset(");
  });

  it("keeps exactly the same typography box while contentEditable toggles", () => {
    expect(css).toMatch(/\.textNodeContent \{[\s\S]*display: flex;[\s\S]*align-items: center;/);
    expect(css).toMatch(/\.textSurface \{[\s\S]*display: block;[\s\S]*width: 100%;[\s\S]*align-self: center;/);
    expect(css).toContain("caret-color: #111111");
    expect(css).not.toContain("field-sizing: content");
  });
});
''')
