#!/usr/bin/env bash
set -euo pipefail

python - <<'PY'
from pathlib import Path
source = Path('scripts/vercel-canvas-pdf-bootstrap.sh').read_text()
source = '\n'.join(
    line
    for line in source.splitlines()
    if 'supabase/migrations/20260826160000_canvas_pdf_nodes.sql' not in line
) + '\n'
marker = 'pnpm exec prettier --write \\\n'
if marker not in source:
    raise SystemExit('preview bootstrap prettier marker not found')
post_patch = r'''python - <<'POSTPATCH'
from pathlib import Path

shell_path = Path('src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx')
shell = shell_path.read_text()
old_filter = ''' + '"""' + '''                file.readyAt !== null &&
                file.deletedAt === null &&
                file.width !== null &&
                file.height !== null &&
                isProjectFileImageMimeType(file.mimeType),''' + '"""' + '''
new_filter = ''' + '"""' + '''                file.readyAt !== null &&
                file.deletedAt === null &&
                (file.mimeType === "application/pdf" ||
                  (file.width !== null &&
                    file.height !== null &&
                    isProjectFileImageMimeType(file.mimeType))),''' + '"""' + '''
if shell.count(old_filter) != 1:
    raise SystemExit('PDF Files picker filter marker not found')
shell_path.write_text(shell.replace(old_filter, new_filter, 1))

migration_path = Path('supabase/migrations/20260826160000_canvas_pdf_nodes.sql')
migration = migration_path.read_text()
if migration.count("'fontFamily','sans'") != 1:
    raise SystemExit('PDF migration font marker not found')
migration_path.write_text(migration.replace("'fontFamily','sans'", "'fontFamily','system'", 1))
POSTPATCH

'''
source = source.replace(marker, post_patch + marker, 1)
Path('/tmp/canvas-pdf-bootstrap.sh').write_text(source)
PY

bash /tmp/canvas-pdf-bootstrap.sh

echo '__MOZG_PDF_EXPORT_BEGIN__'
tar -czf - \
  src/lib/canvas/canvas-document.ts \
  src/lib/canvas/react-flow-canvas-adapter.ts \
  src/lib/canvas/canvas-node-clipboard.ts \
  src/prototype/canvases/canvas-project-file-picker.tsx \
  src/prototype/canvases/canvas-desktop-composition.tsx \
  src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx \
  src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css \
  supabase/migrations/20260826160000_canvas_pdf_nodes.sql \
  tests/canvas-document-v2.test.ts \
  tests/canvas-node-frame.test.ts \
  | base64 -w 2400 | awk '{printf "__MOZG_PDF_EXPORT_%04d__%s\n", NR, $0}'
echo '__MOZG_PDF_EXPORT_END__'
