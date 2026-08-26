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
