begin;

select no_plan();

select lives_ok(
  $$ select public.validate_canvas_document_v2(
    2::smallint,
    $json$
    {
      "schemaVersion": 2,
      "nodes": [
        {"id":"image-1","kind":"image","assetId":"asset-1","aspectRatioLocked":true,"pins":[{"id":"pin-1","x":0.25,"y":0.75,"color":"green","radius":18}],"position":{"x":0,"y":0},"size":{"width":400,"height":300},"zIndex":1},
        {"id":"text-1","kind":"text","markdown":"Текст","position":{"x":600,"y":0},"size":{"width":200,"height":100},"zIndex":2}
      ],
      "edges": [
        {"id":"image-text","sourceNodeId":"image-1","sourceHandle":"right","targetNodeId":"text-1","targetHandle":"left","routing":"curved","arrows":"end","bend":{"x":420,"y":260}}
      ]
    }
    $json$::jsonb
  ) $$,
  'Canvas V2 accepts a manually bent edge and styled image pin'
);

select throws_ok(
  $$ select public.validate_canvas_document_v2(
    2::smallint,
    '{"schemaVersion":2,"nodes":[{"id":"image-1","kind":"image","assetId":"asset-1","aspectRatioLocked":true,"pins":[{"id":"pin-1","x":2,"y":0}],"position":{"x":0,"y":0},"size":{"width":400,"height":300},"zIndex":1}],"edges":[]}'::jsonb
  ) $$,
  '22023',
  'invalid Canvas image pin',
  'Canvas V2 rejects an image pin outside normalized image bounds'
);

select throws_ok(
  $$ select public.validate_canvas_document_v2(
    2::smallint,
    '{"schemaVersion":2,"nodes":[{"id":"image-1","kind":"image","assetId":"asset-1","aspectRatioLocked":true,"pins":[{"id":"pin-1","x":0.5,"y":0.5,"color":"purple","radius":13}],"position":{"x":0,"y":0},"size":{"width":400,"height":300},"zIndex":1}],"edges":[]}'::jsonb
  ) $$,
  '22023',
  'invalid Canvas image pin',
  'Canvas V2 rejects an unsupported image pin color'
);

select throws_ok(
  $$ select public.validate_canvas_document_v2(
    2::smallint,
    '{"schemaVersion":2,"nodes":[{"id":"text-1","kind":"text","markdown":"Текст","pins":[],"position":{"x":0,"y":0},"size":{"width":200,"height":100},"zIndex":1}],"edges":[]}'::jsonb
  ) $$,
  '22023',
  'Canvas pins require an image node',
  'Canvas V2 does not permit pins on non-image nodes'
);

select * from finish();

rollback;
