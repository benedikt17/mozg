import { readFileSync, writeFileSync } from "node:fs";

const path = "tests/rls/canvas-persistence.test.sql";
let sql = readFileSync(path, "utf8");

sql = sql.replace(
  "  'create_canvas',\n  array['uuid', 'text'],\n  'Canvas create function exists'",
  "  'create_canvas_for_project',\n  array['uuid', 'text', 'text', 'uuid'],\n  'Project-scoped Canvas create function exists'",
);

const projectByWorkspace = new Map([
  ["22000000-0000-0000-0000-000000000001", "project-a"],
  ["22000000-0000-0000-0000-000000000002", "project-b"],
  ["22000000-0000-0000-0000-000000000099", "project-denied"],
]);

for (const [workspaceId, projectId] of projectByWorkspace) {
  const pattern = new RegExp(
    `public\\.create_canvas\\(\\s*'${workspaceId}'::uuid,\\s*('(?:''|[^'])*')\\s*\\)`,
    "g",
  );
  sql = sql.replace(
    pattern,
    `public.create_canvas_for_project('${workspaceId}'::uuid, '${projectId}', $1, null)`,
  );
}

sql = sql.replace(
  "insert into public.canvases (id, workspace_id, title, schema_version, document, revision, created_by)\n     values ('62000000-0000-0000-0000-000000000099'::uuid, '22000000-0000-0000-0000-000000000001'::uuid, 'V1 row', 1,",
  "insert into public.canvases (id, workspace_id, project_id, title, schema_version, document, revision, created_by)\n     values ('62000000-0000-0000-0000-000000000099'::uuid, '22000000-0000-0000-0000-000000000001'::uuid, 'project-a', 'V1 row', 1,",
);

if (sql.includes("public.create_canvas(")) {
  throw new Error("Legacy public.create_canvas call remains in canvas-persistence.test.sql");
}
if (!sql.includes("create_canvas_for_project")) {
  throw new Error("Project-scoped Canvas create was not introduced");
}
if (!sql.includes("workspace_id, project_id, title")) {
  throw new Error("Direct Canvas insert was not updated with project_id");
}

writeFileSync(path, sql);
