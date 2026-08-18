begin;

select no_plan();

select lives_ok(
  $$ select public.validate_canvas_document_v2(
    2::smallint,
    $json$
    {
      "schemaVersion": 2,
      "nodes": [
        {
          "id": "shape-rectangle",
          "kind": "shape",
          "position": {"x": 10, "y": 20},
          "size": {"width": 240, "height": 120},
          "zIndex": 0,
          "shape": "rectangle",
          "markdown": "Rectangle",
          "style": {
            "fontFamily": "system",
            "fontSize": 18,
            "bold": false,
            "italic": false,
            "underline": false,
            "strikethrough": false,
            "color": "#292524",
            "fillColor": "#F5DE47",
            "textAlign": "center"
          }
        },
        {
          "id": "shape-circle",
          "kind": "shape",
          "position": {"x": 320, "y": 20},
          "size": {"width": 160, "height": 160},
          "zIndex": 1,
          "shape": "circle",
          "markdown": "Circle",
          "style": {
            "fontFamily": "georgia",
            "fontSize": 24,
            "bold": true,
            "italic": false,
            "underline": false,
            "strikethrough": false,
            "color": "#123ABC",
            "fillColor": "transparent",
            "textAlign": "right"
          }
        }
      ],
      "edges": [
        {
          "id": "shape-edge",
          "sourceNodeId": "shape-rectangle",
          "sourceHandle": "right",
          "targetNodeId": "shape-circle",
          "targetHandle": "left",
          "routing": "curved",
          "arrows": "end"
        }
      ]
    }
    $json$::jsonb
  ) $$,
  'Canvas V2 accepts canonical rectangle/circle nodes and their edges'
);

select throws_ok(
  $$ select public.validate_canvas_document_v2(
    2::smallint,
    $json$
    {
      "schemaVersion": 2,
      "nodes": [
        {
          "id": "shape-invalid-variant",
          "kind": "shape",
          "position": {"x": 0, "y": 0},
          "size": {"width": 100, "height": 100},
          "zIndex": 0,
          "shape": "triangle",
          "markdown": "Invalid",
          "style": {
            "fontFamily": "system",
            "fontSize": 18,
            "bold": false,
            "italic": false,
            "underline": false,
            "strikethrough": false,
            "color": "#292524",
            "fillColor": "#F5DE47",
            "textAlign": "center"
          }
        }
      ],
      "edges": []
    }
    $json$::jsonb
  ) $$,
  '22023',
  'invalid Canvas shape variant',
  'Canvas V2 rejects unsupported shape variants'
);

select throws_ok(
  $$ select public.validate_canvas_document_v2(
    2::smallint,
    $json$
    {
      "schemaVersion": 2,
      "nodes": [
        {
          "id": "shape-extra-key",
          "kind": "shape",
          "position": {"x": 0, "y": 0},
          "size": {"width": 100, "height": 100},
          "zIndex": 0,
          "shape": "rectangle",
          "markdown": "Invalid",
          "style": {
            "fontFamily": "system",
            "fontSize": 18,
            "bold": false,
            "italic": false,
            "underline": false,
            "strikethrough": false,
            "color": "#292524",
            "fillColor": "#F5DE47",
            "textAlign": "center"
          },
          "future": true
        }
      ],
      "edges": []
    }
    $json$::jsonb
  ) $$,
  '22023',
  'invalid Canvas shape node',
  'Canvas V2 rejects unknown shape-node properties'
);

select throws_ok(
  $$ select public.validate_canvas_document_v2(
    2::smallint,
    $json$
    {
      "schemaVersion": 2,
      "nodes": [
        {
          "id": "shape-extra-style-key",
          "kind": "shape",
          "position": {"x": 0, "y": 0},
          "size": {"width": 100, "height": 100},
          "zIndex": 0,
          "shape": "circle",
          "markdown": "Invalid",
          "style": {
            "fontFamily": "system",
            "fontSize": 18,
            "bold": false,
            "italic": false,
            "underline": false,
            "strikethrough": false,
            "color": "#292524",
            "fillColor": "#F5DE47",
            "textAlign": "center",
            "future": true
          }
        }
      ],
      "edges": []
    }
    $json$::jsonb
  ) $$,
  '22023',
  'invalid Canvas shape style',
  'Canvas V2 rejects unknown shape-style properties'
);

select throws_ok(
  $$ select public.validate_canvas_document_v2(
    2::smallint,
    $json$
    {
      "schemaVersion": 2,
      "nodes": [
        {
          "id": "shape-invalid-fill",
          "kind": "shape",
          "position": {"x": 0, "y": 0},
          "size": {"width": 100, "height": 100},
          "zIndex": 0,
          "shape": "rectangle",
          "markdown": "Invalid",
          "style": {
            "fontFamily": "system",
            "fontSize": 18,
            "bold": false,
            "italic": false,
            "underline": false,
            "strikethrough": false,
            "color": "#292524",
            "fillColor": "orange",
            "textAlign": "center"
          }
        }
      ],
      "edges": []
    }
    $json$::jsonb
  ) $$,
  '22023',
  'invalid Canvas text background color',
  'Canvas V2 rejects non-canonical shape fill colors'
);

select throws_ok(
  $$ select public.validate_canvas_document_v2(
    2::smallint,
    $json$
    {
      "schemaVersion": 2,
      "nodes": [
        {
          "id": "shape-missing-style",
          "kind": "shape",
          "position": {"x": 0, "y": 0},
          "size": {"width": 100, "height": 100},
          "zIndex": 0,
          "shape": "rectangle",
          "markdown": "Invalid"
        }
      ],
      "edges": []
    }
    $json$::jsonb
  ) $$,
  '22023',
  'invalid Canvas shape node',
  'Canvas V2 requires canonical shape style'
);

select * from finish();

rollback;
