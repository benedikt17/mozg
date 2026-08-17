import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const shellSource = readFileSync(
  "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
  "utf8",
);
const pickerSource = readFileSync(
  "src/prototype/infinite-canvas-local-shell/canvas-color-picker.tsx",
  "utf8",
);

describe("Canvas custom color picker runtime", () => {
  it("uses direct color swatches for text and background", () => {
    expect(shellSource).toContain(
      'import { CanvasColorPicker } from "./canvas-color-picker";',
    );
    expect(shellSource.match(/<CanvasColorPicker/g)).toHaveLength(2);
    expect(shellSource).not.toContain('type="color"');
    expect(shellSource).not.toContain('glyph="A"');
    expect(shellSource).not.toContain('glyph="▣"');
    expect(pickerSource).not.toContain("styles.glyph");
    expect(pickerSource).toContain("className={styles.swatch}");
  });

  it("keeps HEX visibly editable in the picker", () => {
    expect(pickerSource).toContain("className={styles.hexLabel}>HEX</span>");
    expect(pickerSource).toContain("aria-label={`${label}: HEX`}");
    expect(pickerSource).toContain("normalizeCanvasHexColor(draftHex)");
  });

  it("commits saturation/value only when the pointer gesture ends", () => {
    expect(pickerSource).toContain("onPointerMove={(event) => {");
    expect(pickerSource).toContain("setDraftHsv(hsvFromPointer(event));");
    expect(pickerSource).toContain("onPointerUp={(event) => {");
    expect(pickerSource).toContain("commitHsv(next);");
  });

  it("resynchronizes from the committed Canvas value when reopened", () => {
    expect(pickerSource).toContain("const toggleOpen = (): void => {");
    expect(pickerSource).toContain(
      "lastCommittedRef.current = normalizedValue;",
    );
    expect(pickerSource).toContain("setHsv(hsvForHex(normalizedValue));");
    expect(pickerSource).toContain("setDraftHex(displayHex(normalizedValue));");
    expect(pickerSource).toContain("onClick={toggleOpen}");
    expect(pickerSource).not.toContain("}, [normalizedValue]);");
  });
});
