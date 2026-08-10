begin;

select no_plan();

select lives_ok(
  $$ select public.validate_canvas_document_v2(
    2,
    $json$
    {
      "schemaVersion": 2,
      "nodes": [
        {
          "id": "text-1",
          "kind": "text",
          "position": {"x": 10, "y": 20},
          "size": {"width": 240, "height": 120},
          "zIndex": 0,
          "markdown": "Styled text",
          "style": {
            "fontFamily": "georgia",
            "fontSize": 36,
            "bold": true,
            "italic": false,
            "underline": true,
            "strikethrough": false,
            "color": "#123ABC",
            "backgroundColor": "transparent",
            "textAlign": "right"
          }
        }
      ],
      "edges": []
    }
    $json$::jsonb
  ) $$,
  'Canvas V2 accepts canonical styled text nodes'
);

select lives_ok(
  $$ select public.validate_canvas_document_v2(
    2,
    $json$
    {
      "schemaVersion": 2,
      "nodes": [
        {
          "id": "text-legacy-style",
          "kind": "text",
          "position": {"x": 0, "y": 0},
          "size": {"width": 100, "height": 100},
          "zIndex": 0,
          "markdown": "Legacy style",
          "style": {
            "fontFamily": "system",
            "fontSize": 18,
            "bold": false,
            "italic": false,
            "underline": false,
            "strikethrough": false,
            "color": "#292524",
            "backgroundColor": "transparent"
          }
        }
      ],
      "edges": []
    }
    $json$::jsonb
  ) $$,
  'Canvas V2 accepts legacy styles without textAlign'
);

select throws_ok(
  $$ select public.validate_canvas_document_v2(
    2,
    $json$
    {
      "schemaVersion": 2,
      "nodes": [
        {
          "id": "text-extra-style-key",
          "kind": "text",
          "position": {"x": 0, "y": 0},
          "size": {"width": 100, "height": 100},
          "zIndex": 0,
          "markdown": "Invalid",
          "style": {
            "fontFamily": "system",
            "fontSize": 18,
            "bold": false,
            "italic": false,
            "underline": false,
            "strikethrough": false,
            "color": "#292524",
            "backgroundColor": "transparent",
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
  'invalid Canvas text style',
  'Canvas V2 rejects unknown text style properties'
);

select throws_ok(
  $$ select public.validate_canvas_document_v2(
    2,
    $json$
    {
      "schemaVersion": 2,
      "nodes": [
        {
          "id": "text-font",
          "kind": "text",
          "position": {"x": 0, "y": 0},
          "size": {"width": 100, "height": 100},
          "zIndex": 0,
          "markdown": "Invalid",
          "style": {
            "fontFamily": "comic-sans",
            "fontSize": 18,
            "bold": false,
            "italic": false,
            "underline": false,
            "strikethrough": false,
            "color": "#292524",
            "backgroundColor": "transparent",
            "textAlign": "center"
          }
        }
      ],
      "edges": []
    }
    $json$::jsonb
  ) $$,
  '22023',
  'invalid Canvas text font family',
  'Canvas V2 rejects unsupported text font families'
);

select throws_ok(
  $$ select public.validate_canvas_document_v2(
    2,
    $json$
    {
      "schemaVersion": 2,
      "nodes": [
        {
          "id": "text-size",
          "kind": "text",
          "position": {"x": 0, "y": 0},
          "size": {"width": 100, "height": 100},
          "zIndex": 0,
          "markdown": "Invalid",
          "style": {
            "fontFamily": "system",
            "fontSize": 17,
            "bold": false,
            "italic": false,
            "underline": false,
            "strikethrough": false,
            "color": "#292524",
            "backgroundColor": "transparent",
            "textAlign": "center"
          }
        }
      ],
      "edges": []
    }
    $json$::jsonb
  ) $$,
  '22023',
  'invalid Canvas text font size',
  'Canvas V2 rejects unsupported text font sizes'
);

select throws_ok(
  $$ select public.validate_canvas_document_v2(
    2,
    $json$
    {
      "schemaVersion": 2,
      "nodes": [
        {
          "id": "text-color",
          "kind": "text",
          "position": {"x": 0, "y": 0},
          "size": {"width": 100, "height": 100},
          "zIndex": 0,
          "markdown": "Invalid",
          "style": {
            "fontFamily": "system",
            "fontSize": 18,
            "bold": false,
            "italic": false,
            "underline": false,
            "strikethrough": false,
            "color": "red",
            "backgroundColor": "transparent",
            "textAlign": "center"
          }
        }
      ],
      "edges": []
    }
    $json$::jsonb
  ) $$,
  '22023',
  'invalid Canvas text color',
  'Canvas V2 rejects non-canonical text colors'
);

select throws_ok(
  $$ select public.validate_canvas_document_v2(
    2,
    $json$
    {
      "schemaVersion": 2,
      "nodes": [
        {
          "id": "text-align",
          "kind": "text",
          "position": {"x": 0, "y": 0},
          "size": {"width": 100, "height": 100},
          "zIndex": 0,
          "markdown": "Invalid",
          "style": {
            "fontFamily": "system",
            "fontSize": 18,
            "bold": false,
            "italic": false,
            "underline": false,
            "strikethrough": false,
            "color": "#292524",
            "backgroundColor": "transparent",
            "textAlign": "justify"
          }
        }
      ],
      "edges": []
    }
    $json$::jsonb
  ) $$,
  '22023',
  'invalid Canvas text alignment',
  'Canvas V2 rejects unsupported text alignment'
);

select throws_ok(
  $$ select public.validate_canvas_document_v2(
    2,
    $json$
    {
      "schemaVersion": 2,
      "nodes": [
        {
          "id": "text-flags",
          "kind": "text",
          "position": {"x": 0, "y": 0},
          "size": {"width": 100, "height": 100},
          "zIndex": 0,
          "markdown": "Invalid",
          "style": {
            "fontFamily": "system",
            "fontSize": 18,
            "bold": "yes",
            "italic": false,
            "underline": false,
            "strikethrough": false,
            "color": "#292524",
            "backgroundColor": "transparent",
            "textAlign": "center"
          }
        }
      ],
      "edges": []
    }
    $json$::jsonb
  ) $$,
  '22023',
  'invalid Canvas text style flags',
  'Canvas V2 rejects non-boolean text style flags'
);

select * from finish();
rollback;
