#!/usr/bin/env bash
set -euo pipefail
sed '/supabase\/migrations\/20260826160000_canvas_pdf_nodes\.sql/d' scripts/vercel-canvas-pdf-bootstrap.sh > /tmp/canvas-pdf-bootstrap.sh
bash /tmp/canvas-pdf-bootstrap.sh
