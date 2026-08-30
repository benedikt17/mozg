begin;

select no_plan();

select lives_ok(
  $$ select public.validate_canvas_document_v2(
    2::smallint,
    $json$
    {
      "schemaVersion": 2,
      "nodes": [
        {"id":"text-1","kind":"text","markdown":"Первый","position":{"x":0,"y":0},"size":{"width":240,"height":80},"zIndex":1},
        {"id":"summary-1","kind":"summary","title":"Сумма","position":{"x":300,"y":0},"size":{"width":156,"height":96},"zIndex":2}
      ],
      "edges": [
        {"id":"text-summary","sourceNodeId":"text-1","sourceHandle":"right","targetNodeId":"summary-1","targetHandle":"left","routing":"curved","arrows":"none","summaryOrder":1}
      ]
    }
    $json$::jsonb
  ) $$,
  'Canvas V2 accepts a live summary with an ordered text input'
);

select throws_ok(
  $$ select public.validate_canvas_document_v2(
    2::smallint,
    $json$
    {
      "schemaVersion": 2,
      "nodes": [
        {"id":"task-1","kind":"task","taskId":"task-1","position":{"x":0,"y":0},"size":{"width":240,"height":80},"zIndex":1},
        {"id":"summary-1","kind":"summary","title":"Сумма","position":{"x":300,"y":0},"size":{"width":156,"height":96},"zIndex":2}
      ],
      "edges": [
        {"id":"task-summary","sourceNodeId":"task-1","sourceHandle":"right","targetNodeId":"summary-1","targetHandle":"left","routing":"curved","arrows":"none","summaryOrder":1}
      ]
    }
    $json$::jsonb
  ) $$,
  '22023',
  'invalid Canvas summary connection',
  'Canvas V2 rejects non-text/non-shape summary inputs'
);

select throws_ok(
  $$ select public.validate_canvas_document_v2(
    2::smallint,
    $json$
    {
      "schemaVersion": 2,
      "nodes": [
        {"id":"text-1","kind":"text","markdown":"Первый","position":{"x":0,"y":0},"size":{"width":240,"height":80},"zIndex":1},
        {"id":"summary-1","kind":"summary","title":"Сумма","position":{"x":300,"y":0},"size":{"width":156,"height":96},"zIndex":2}
      ],
      "edges": [
        {"id":"text-summary","sourceNodeId":"text-1","sourceHandle":"right","targetNodeId":"summary-1","targetHandle":"left","routing":"curved","arrows":"none"}
      ]
    }
    $json$::jsonb
  ) $$,
  '22023',
  'invalid Canvas summary connection',
  'Canvas V2 requires a persisted summary order for every summary input'
);

select * from finish();

rollback;
