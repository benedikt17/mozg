import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

function update(path, transform) {
  const before = readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) return;
  writeFileSync(path, after);
}

update("tests/rls/canvas-persistence.test.sql", (input) => {
  let sql = input;
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
  sql = sql.replace(
    "'permission denied for function create_canvas',\n  'anonymous cannot create a Canvas'",
    "'permission denied for function create_canvas_for_project',\n  'anonymous cannot create a Canvas'",
  );

  if (sql.includes("public.create_canvas(")) {
    throw new Error("Legacy public.create_canvas call remains in canvas-persistence.test.sql");
  }
  return sql;
});

update("tests/rls/canvas-groups.test.sql", (input) => {
  let sql = input;
  sql = sql.replace(
    "  'create_canvas_group',\n  array['uuid', 'text', 'uuid'],\n  'Canvas group create function exists'",
    "  'create_canvas_group_for_project',\n  array['uuid', 'text', 'text', 'uuid'],\n  'Project-scoped Canvas group create function exists'",
  );
  sql = sql.replaceAll(
    "public.create_canvas_group(uuid,text,uuid)",
    "public.create_canvas_group_for_project(uuid,text,text,uuid)",
  );
  sql = sql.replace(
    "  true,\n  'authenticated clients can create groups through the RPC'",
    "  true,\n  'authenticated clients can create groups through the project-scoped RPC'",
  );
  sql = sql.replaceAll(
    "public.create_canvas_group(\n    '82000000-0000-0000-0000-000000000001'::uuid,\n",
    "public.create_canvas_group_for_project(\n    '82000000-0000-0000-0000-000000000001'::uuid,\n    'project-a',\n",
  );
  sql = sql.replace(
    "public.create_canvas(\n    '82000000-0000-0000-0000-000000000001'::uuid,\n    'Grouped canvas',",
    "public.create_canvas_for_project(\n    '82000000-0000-0000-0000-000000000001'::uuid,\n    'project-a',\n    'Grouped canvas',",
  );
  if (sql.includes("public.create_canvas_group(\n") || sql.includes("public.create_canvas(\n")) {
    throw new Error("Legacy Canvas create RPC remains in canvas-groups.test.sql");
  }
  return sql;
});

update("tests/rls/canvas-asset-variants-security.test.sql", (input) => {
  let sql = input;
  sql = sql.replace(
    "  id, workspace_id, title, schema_version, document, revision, created_by\n)",
    "  id, workspace_id, project_id, title, schema_version, document, revision, created_by\n)",
  );
  sql = sql.replace(
    "('82000000-0000-0000-0000-000000000011', '82000000-0000-0000-0000-000000000001', 'Variant canvas'",
    "('82000000-0000-0000-0000-000000000011', '82000000-0000-0000-0000-000000000001', 'project-a', 'Variant canvas'",
  );
  sql = sql.replace(
    "('82000000-0000-0000-0000-000000000012', '82000000-0000-0000-0000-000000000002', 'Other canvas'",
    "('82000000-0000-0000-0000-000000000012', '82000000-0000-0000-0000-000000000002', 'project-b', 'Other canvas'",
  );
  if (!sql.includes("id, workspace_id, project_id, title")) {
    throw new Error("Canvas asset variant fixture did not receive project_id");
  }
  return sql;
});

update("tests/rls/canvas-project-hardening.test.sql", (input) =>
  input.replaceAll("select is_nullable from information_schema.columns", "select is_nullable::text from information_schema.columns"),
);

const obsoletePhase1 = "tests/rls/canvas-project-scope-phase1.test.sql";
if (existsSync(obsoletePhase1)) unlinkSync(obsoletePhase1);
