import { canvasSummaryEntries } from "@/lib/canvas/canvas-summary";
import type {
  CanvasDocumentV2,
  CanvasNode,
} from "@/lib/canvas/canvas-document";
import type { ProjectFileRecord } from "@/lib/files/project-file-repository";

export type CanvasPortableBackupFile = Pick<
  ProjectFileRecord,
  "byteSize" | "checksum" | "id" | "mimeType" | "name" | "originalName"
>;

export type CanvasPortableBackupSource = {
  canvasId: string;
  document: CanvasDocumentV2;
  files?: readonly CanvasPortableBackupFile[];
  revision: number;
  title: string;
};

export type CanvasPortableBackupManifest = {
  canvas: {
    id: string;
    nodeCount: number;
    revision: number;
    title: string;
  };
  files: Array<{
    byteSize: number | null;
    checksum: string | null;
    fileId: string;
    mimeType: string | null;
    name: string;
    nodeIds: string[];
    status: "metadata-only" | "unresolved";
  }>;
  format: "mozg-canvas-portable-backup";
  generatedAt: string;
  note: string;
  version: 1;
};

export type CanvasPortableBackupEntry = {
  content: string;
  path: string;
};

export type CanvasPortableBackupArchive = {
  bytes: Uint8Array;
  entries: CanvasPortableBackupEntry[];
  fileName: string;
  manifest: CanvasPortableBackupManifest;
};

const textEncoder = new TextEncoder();

/**
 * Makes a small, self-contained read-only archive.  The canonical Canvas
 * document is retained verbatim for a future importer; binary files are
 * deliberately represented by metadata only.
 */
export function createCanvasPortableBackup(
  source: CanvasPortableBackupSource,
  generatedAt = new Date(),
): CanvasPortableBackupArchive {
  const manifest = createCanvasPortableManifest(source, generatedAt);
  const entries: CanvasPortableBackupEntry[] = [
    {
      content: createPortableCanvasViewer({
        document: source.document,
        manifest,
        title: source.title,
      }),
      path: "index.html",
    },
    {
      content: `${JSON.stringify(source.document, null, 2)}\n`,
      path: "canvas.json",
    },
    {
      content: `${JSON.stringify(manifest, null, 2)}\n`,
      path: "manifest.json",
    },
  ];
  return {
    bytes: createStoreZip(entries, generatedAt),
    entries,
    fileName: canvasPortableBackupFileName(source.title, generatedAt),
    manifest,
  };
}

export function canvasPortableBackupFileName(
  title: string,
  generatedAt: Date,
): string {
  const date = [
    generatedAt.getUTCFullYear().toString().padStart(4, "0"),
    (generatedAt.getUTCMonth() + 1).toString().padStart(2, "0"),
    generatedAt.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
  return `MOZG-Canvas-${safeFileSegment(title)}-${date}.zip`;
}

export function createCanvasPortableManifest(
  source: CanvasPortableBackupSource,
  generatedAt = new Date(),
): CanvasPortableBackupManifest {
  const filesById = new Map(
    (source.files ?? []).map((file) => [file.id, file]),
  );
  const references = new Map<string, string[]>();
  for (const node of source.document.nodes) {
    const fileId = nodeFileId(node);
    if (!fileId) continue;
    const nodeIds = references.get(fileId) ?? [];
    nodeIds.push(node.id);
    references.set(fileId, nodeIds);
  }

  return {
    canvas: {
      id: source.canvasId,
      nodeCount: source.document.nodes.length,
      revision: source.revision,
      title: source.title,
    },
    files: [...references.entries()]
      .map(([fileId, nodeIds]) => {
        const file = filesById.get(fileId);
        return {
          byteSize: file?.byteSize ?? null,
          checksum: file?.checksum ?? null,
          fileId,
          mimeType: file?.mimeType ?? null,
          name: file?.name ?? fallbackFileName(source.document.nodes, fileId),
          nodeIds,
          status: file ? ("metadata-only" as const) : ("unresolved" as const),
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name, "ru")),
    format: "mozg-canvas-portable-backup",
    generatedAt: generatedAt.toISOString(),
    note: "This portable copy contains the Canvas structure and file metadata only. Binary files are not included.",
    version: 1,
  };
}

function createPortableCanvasViewer({
  document,
  manifest,
  title,
}: {
  document: CanvasDocumentV2;
  manifest: CanvasPortableBackupManifest;
  title: string;
}): string {
  const summaries = document.nodes
    .filter((node) => node.kind === "summary")
    .map((node) => ({
      entries: canvasSummaryEntries(document, node.id),
      nodeId: node.id,
      title: node.title,
    }));
  const data = JSON.stringify({
    document,
    manifest,
    summaries,
    title,
  }).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — автономная копия MOZG</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:#f7f6f3; color:#24211c; }
    * { box-sizing:border-box; }
    body { margin:0; }
    header { padding:24px clamp(18px,4vw,56px); background:#fffdf9; border-bottom:1px solid #e2ded5; }
    h1 { margin:0; font-size:clamp(22px,3vw,34px); letter-spacing:-.03em; }
    .meta { margin:8px 0 0; color:#6c675f; font-size:14px; }
    main { max-width:1500px; margin:0 auto; padding:24px clamp(18px,4vw,56px) 56px; }
    .notice { margin:0 0 18px; padding:12px 14px; border:1px solid #ead7a7; background:#fff8e5; border-radius:10px; color:#5d4813; font-size:14px; }
    .canvas-shell { overflow:auto; border:1px solid #ded9d0; border-radius:14px; background-color:#fffefb; background-image:radial-gradient(#e5e0d6 .8px, transparent .8px); background-size:18px 18px; box-shadow:0 12px 40px rgba(52,43,28,.07); }
    .scene { position:relative; min-width:960px; min-height:640px; }
    svg { position:absolute; inset:0; overflow:visible; pointer-events:none; }
    .edge { stroke:#706c63; stroke-width:2; fill:none; opacity:.8; }
    .node { position:absolute; overflow:hidden; padding:12px; border:1px solid #b6b0a7; border-radius:8px; background:#fff; box-shadow:0 3px 10px rgba(35,29,18,.12); white-space:pre-wrap; font-size:13px; line-height:1.38; cursor:default; }
    .node.text { background:#c8ffa5; border-color:#a6df83; }
    .node.shape { background:#ffea75; border-color:#dcc65e; }
    .node.summary { display:grid; place-content:center; text-align:center; background:#fff0a0; border:2px solid #e3b932; font-weight:700; }
    .node.file { background:#f1edff; border-color:#c8bdf0; }
    .node.article,.node.task { background:#e5f0ff; border-color:#a8c5e9; }
    .node-kind { display:block; margin-bottom:7px; color:#625f56; font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
    .node-title { font-weight:650; }
    .file-note { color:#635c76; font-size:12px; }
    section { margin-top:28px; }
    h2 { margin:0 0 12px; font-size:19px; }
    .summary-card { margin:12px 0; padding:16px 18px; background:#fffdf9; border:1px solid #ded9d0; border-radius:12px; }
    ol { margin:10px 0 0; padding-left:26px; }
    li { margin:9px 0; white-space:pre-wrap; line-height:1.5; }
    .empty { color:#6c675f; }
    details { margin-top:28px; padding:12px 14px; background:#eeece7; border-radius:10px; color:#514e47; }
    code { overflow-wrap:anywhere; }
  </style>
</head>
<body>
  <header><h1 id="title"></h1><p class="meta" id="meta"></p></header>
  <main>
    <p class="notice">Автономная копия для просмотра. Вложенные файлы не скачиваются и не включены: вместо них показана их карточка с известными метаданными.</p>
    <div class="canvas-shell"><div class="scene" id="scene"><svg id="edges" aria-hidden="true"></svg></div></div>
    <section id="summaries"></section>
    <details><summary>Состав архива</summary><p><code>canvas.json</code> — исходный CanvasDocument для будущего импорта; <code>manifest.json</code> — версия, ревизия и метаданные файлов; <code>index.html</code> — этот автономный просмотрщик.</p></details>
  </main>
  <script>
    const data = ${data};
    const fileById = new Map(data.manifest.files.map((file) => [file.fileId, file]));
    const scene = document.getElementById('scene');
    const edgeLayer = document.getElementById('edges');
    document.getElementById('title').textContent = data.title;
    document.getElementById('meta').textContent = 'Canvas · ревизия ' + data.manifest.canvas.revision + ' · экспорт ' + new Date(data.manifest.generatedAt).toLocaleString('ru-RU');
    const nodes = data.document.nodes;
    const bounds = nodes.reduce((result, node) => ({ minX:Math.min(result.minX,node.position.x), minY:Math.min(result.minY,node.position.y), maxX:Math.max(result.maxX,node.position.x+node.size.width), maxY:Math.max(result.maxY,node.position.y+node.size.height) }), {minX:0,minY:0,maxX:800,maxY:520});
    const pad = 72;
    const offsetX = pad - bounds.minX;
    const offsetY = pad - bounds.minY;
    const width = Math.max(960, bounds.maxX - bounds.minX + pad * 2);
    const height = Math.max(640, bounds.maxY - bounds.minY + pad * 2);
    scene.style.width = width + 'px'; scene.style.height = height + 'px'; edgeLayer.setAttribute('viewBox', '0 0 ' + width + ' ' + height); edgeLayer.setAttribute('width', width); edgeLayer.setAttribute('height', height);
    const byId = new Map(nodes.map((node) => [node.id,node]));
    const label = (node) => {
      if (node.kind === 'text' || node.kind === 'shape') return node.markdown || 'Пустая заметка';
      if (node.kind === 'summary') return 'Σ\\n' + node.title;
      if (node.kind === 'pdf' || node.kind === 'image') { const file = fileById.get(node.fileId); return (node.kind === 'pdf' ? 'Файл PDF' : 'Изображение') + '\\n' + (file ? file.name : node.lastKnownName || 'Файл не найден') + '\\n' + (file ? formatBytes(file.byteSize) + ' · файл не вложен' : 'метаданные недоступны'); }
      return node.lastKnownTitle || (node.kind === 'article' ? 'Статья' : 'Задача');
    };
    const kindLabel = (node) => ({text:'Текст',shape:'Геометрия',summary:'Сумма',pdf:'Файл',image:'Изображение',article:'Статья',task:'Задача'})[node.kind] || 'Нода';
    const formatBytes = (bytes) => bytes === null || bytes === undefined ? 'размер неизвестен' : bytes < 1024 ? bytes + ' Б' : bytes < 1024*1024 ? (bytes/1024).toFixed(1) + ' КБ' : (bytes/1024/1024).toFixed(1) + ' МБ';
    for (const edge of data.document.edges) { const source=byId.get(edge.sourceNodeId), target=byId.get(edge.targetNodeId); if (!source || !target) continue; const line=document.createElementNS('http://www.w3.org/2000/svg','line'); line.setAttribute('class','edge'); line.setAttribute('x1',source.position.x+source.size.width/2+offsetX); line.setAttribute('y1',source.position.y+source.size.height/2+offsetY); line.setAttribute('x2',target.position.x+target.size.width/2+offsetX); line.setAttribute('y2',target.position.y+target.size.height/2+offsetY); edgeLayer.append(line); }
    for (const node of nodes) { const el=document.createElement('div'); const visualKind=node.kind === 'pdf' || node.kind === 'image' ? 'file' : node.kind; el.className='node '+visualKind; el.style.left=(node.position.x+offsetX)+'px'; el.style.top=(node.position.y+offsetY)+'px'; el.style.width=node.size.width+'px'; el.style.height=node.size.height+'px'; const kind=document.createElement('span'); kind.className='node-kind'; kind.textContent=kindLabel(node); const content=document.createElement('span'); content.className=node.kind === 'pdf' || node.kind === 'image' ? 'file-note' : 'node-title'; content.textContent=label(node); el.append(kind,content); scene.append(el); }
    const summaryRoot = document.getElementById('summaries');
    if (data.summaries.length) { const heading=document.createElement('h2'); heading.textContent='Суммы'; summaryRoot.append(heading); for (const summary of data.summaries) { const card=document.createElement('article'); card.className='summary-card'; const title=document.createElement('strong'); title.textContent='Σ ' + summary.title; card.append(title); if (!summary.entries.length) { const empty=document.createElement('p'); empty.className='empty'; empty.textContent='К «Сумме» не подключены текстовые или геометрические ноды.'; card.append(empty); } else { const list=document.createElement('ol'); for (const entry of summary.entries) { const item=document.createElement('li'); item.textContent=entry.markdown; list.append(item); } card.append(list); } summaryRoot.append(card); } }
  </script>
</body>
</html>\n`;
}

function nodeFileId(node: CanvasNode): string | null {
  if (node.kind === "pdf") return node.fileId;
  if (node.kind === "image" && "fileId" in node) return node.fileId;
  if (node.kind === "image" && "assetId" in node)
    return `legacy:${node.assetId}`;
  return null;
}

function fallbackFileName(nodes: CanvasNode[], fileId: string): string {
  const node = nodes.find((candidate) => nodeFileId(candidate) === fileId);
  if (node?.kind === "pdf") return node.lastKnownName ?? "PDF-файл";
  return fileId.startsWith("legacy:")
    ? "Устаревший ресурс изображения"
    : "Файл";
}

function safeFileSegment(input: string): string {
  const value = input
    .normalize("NFC")
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return value || "Canvas";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function createStoreZip(
  entries: CanvasPortableBackupEntry[],
  modifiedAt: Date,
): Uint8Array {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  const { dosDate, dosTime } = toDosDateTime(modifiedAt);
  let localOffset = 0;
  let centralSize = 0;
  for (const entry of entries) {
    const name = textEncoder.encode(entry.path);
    const content = textEncoder.encode(entry.content);
    const checksum = crc32(content);
    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, content.byteLength, true);
    localView.setUint32(22, content.byteLength, true);
    localView.setUint16(26, name.byteLength, true);
    localChunks.push(localHeader, name, content);
    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, content.byteLength, true);
    centralView.setUint32(24, content.byteLength, true);
    centralView.setUint16(28, name.byteLength, true);
    centralView.setUint32(42, localOffset, true);
    centralChunks.push(centralHeader, name);
    localOffset +=
      localHeader.byteLength + name.byteLength + content.byteLength;
    centralSize += centralHeader.byteLength + name.byteLength;
  }
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, localOffset, true);
  return concatBytes([...localChunks, ...centralChunks, end]);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(
    chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function toDosDateTime(date: Date): { dosDate: number; dosTime: number } {
  const year = Math.min(Math.max(date.getUTCFullYear(), 1980), 2107);
  return {
    dosDate:
      ((year - 1980) << 9) |
      ((date.getUTCMonth() + 1) << 5) |
      date.getUTCDate(),
    dosTime:
      (date.getUTCHours() << 11) |
      (date.getUTCMinutes() << 5) |
      Math.floor(date.getUTCSeconds() / 2),
  };
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
