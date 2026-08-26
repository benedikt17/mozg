#!/usr/bin/env bash
set -euo pipefail

python - <<'PY'
from pathlib import Path
workflow = Path('.github/workflows/apply-canvas-pdf.yml').read_text()
start_marker = "          python - <<'PY'\n"
end_marker = "          PY\n"
start = workflow.index(start_marker) + len(start_marker)
end = workflow.index(end_marker, start)
lines = workflow[start:end].splitlines()
script = "\n".join(line[10:] if line.startswith("          ") else line for line in lines) + "\n"
old_helper = '''def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, got {count}")
    return text.replace(old, new, 1)
'''
new_helper = '''def replace_once(text, old, new, label):
    count = text.count(old)
    if count == 1:
        return text.replace(old, new, 1)
    if label == "toolbar hidden pdf input":
        actual = ''' + '"""' + '''        <input
          accept="image/png,image/jpeg,image/webp"
          hidden
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length > 0) onAddImage(files);
          }}
          ref={fileInputRef}
          type="file"
        />''' + '"""' + '''
        replacement = actual + ''' + '"""' + '''
        <input
          accept="application/pdf,.pdf"
          hidden
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length > 0) onAddPdf(files);
          }}
          ref={pdfInputRef}
          type="file"
        />''' + '"""' + '''
        if text.count(actual) != 1:
            raise SystemExit(f"{label}: current toolbar input not found")
        return text.replace(actual, replacement, 1)
    if label == "toolbar pdf button":
        actual = ''' + '"""' + '''        <IconButton
          disabled={!isReady}
          icon={<UiIcon name="file-plus" />}
          label={copy.addImage}
          onClick={() => fileInputRef.current?.click()}
          title={copy.addImage}
          type="button"
          variant="quiet"
        />''' + '"""' + '''
        replacement = actual + ''' + '"""' + '''
        <IconButton
          disabled={!isReady}
          icon={<UiIcon name="file" />}
          label="Добавить PDF"
          onClick={() => pdfInputRef.current?.click()}
          title="Добавить PDF"
          type="button"
          variant="quiet"
        />''' + '"""' + '''
        if text.count(actual) != 1:
            raise SystemExit(f"{label}: current toolbar button not found")
        return text.replace(actual, replacement, 1)
    if label == "shell pdf factory import":
        actual = ''' + '"""' + '''  canvasImageAdapterDependenciesForCanvas,
  createCanvasTaskFlowNode,'''+ '"""' + '''
        replacement = ''' + '"""' + '''  canvasImageAdapterDependenciesForCanvas,
  createCanvasPdfFlowNode,
  createCanvasPdfId,
  createCanvasTaskFlowNode,'''+ '"""' + '''
        if text.count(actual) != 1:
            raise SystemExit(f"{label}: current adapter factory import not found")
        return text.replace(actual, replacement, 1)
    if label == "shell restore pdf nodes":
        actual = "        ...canvasDocumentToImageNodes(nextState.document),"
        replacement = actual + chr(10) + "        ...canvasDocumentToPdfNodes(nextState.document),"
        if text.count(actual) != 1:
            raise SystemExit(f"{label}: current restore placeholder not found")
        return text.replace(actual, replacement, 1)
    raise SystemExit(f"{label}: expected 1 match, got {count}")
'''
if old_helper not in script:
    raise SystemExit("replace_once helper marker not found")
script = script.replace(old_helper, new_helper, 1)
exec(compile(script, '/tmp/apply-canvas-pdf.py', 'exec'), {'__name__': '__main__'})
PY

pnpm exec prettier --write \
  src/lib/canvas/canvas-document.ts \
  src/lib/canvas/react-flow-canvas-adapter.ts \
  src/lib/canvas/canvas-node-clipboard.ts \
  src/prototype/canvases/canvas-project-file-picker.tsx \
  src/prototype/canvases/canvas-desktop-composition.tsx \
  src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx \
  src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css \
  supabase/migrations/20260826160000_canvas_pdf_nodes.sql \
  tests/canvas-document-v2.test.ts

git diff --check
pnpm test -- tests/canvas-document-v2.test.ts tests/canvas-node-clipboard.test.ts
pnpm typecheck

mkdir -p public/__canvas_pdf_patch__
cp src/lib/canvas/canvas-document.ts public/__canvas_pdf_patch__/canvas-document.ts.txt
cp src/lib/canvas/react-flow-canvas-adapter.ts public/__canvas_pdf_patch__/react-flow-canvas-adapter.ts.txt
cp src/lib/canvas/canvas-node-clipboard.ts public/__canvas_pdf_patch__/canvas-node-clipboard.ts.txt
cp src/prototype/canvases/canvas-project-file-picker.tsx public/__canvas_pdf_patch__/canvas-project-file-picker.tsx.txt
cp src/prototype/canvases/canvas-desktop-composition.tsx public/__canvas_pdf_patch__/canvas-desktop-composition.tsx.txt
cp src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx public/__canvas_pdf_patch__/infinite-canvas-local-shell.tsx.txt
cp src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css public/__canvas_pdf_patch__/infinite-canvas-local-shell.module.css.txt
cp supabase/migrations/20260826160000_canvas_pdf_nodes.sql public/__canvas_pdf_patch__/20260826160000_canvas_pdf_nodes.sql.txt
cp tests/canvas-document-v2.test.ts public/__canvas_pdf_patch__/canvas-document-v2.test.ts.txt

pnpm build
