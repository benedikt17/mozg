begin;

select no_plan();

select lives_ok(
  $$ select public.validate_canvas_document_v2(
    2::smallint,
    '{
      "schemaVersion": 2,
      "nodes": [
        {
          "id": "branch-root",
          "kind": "text",
          "markdown": "Root",
          "position": {"x": 0, "y": 0},
          "size": {"width": 240, "height": 56},
          "zIndex": 0,
          "branchCollapsed": true
        },
        {
          "id": "branch-child",
          "kind": "text",
          "markdown": "Child",
          "position": {"x": 320, "y": 0},
          "size": {"width": 240, "height": 56},
          "zIndex": 1,
          "branchCollapsed": false
        }
      ],
      "edges": [
        {
          "id": "branch-edge",
          "sourceNodeId": "branch-root",
          "sourceHandle": "right",
          "targetNodeId": "branch-child",
          "targetHandle": "left",
          "routing": "curved",
          "arrows": "none"
        }
      ]
    }'::jsonb
  ) $$,
  'Canvas V2 accepts persisted boolean branch-collapse state'
);

select throws_ok(
  $$ select public.validate_canvas_document_v2(
    2::smallint,
    '{
      "schemaVersion": 2,
      "nodes": [
        {
          "id": "branch-root",
          "kind": "text",
          "markdown": "Root",
          "position": {"x": 0, "y": 0},
          "size": {"width": 240, "height": 56},
          "zIndex": 0,
          "branchCollapsed": "true"
        }
      ],
      "edges": []
    }'::jsonb
  ) $$,
  '22023',
  'invalid Canvas branch collapsed state',
  'Canvas V2 rejects non-boolean branch-collapse state'
);

select * from finish();
rollback;
