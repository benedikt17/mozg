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
          "id": "article-1",
          "kind": "article",
          "articleId": "knowledge-1",
          "position": {"x": 0, "y": 0},
          "size": {"width": 300, "height": 120},
          "zIndex": 0,
          "style": {
            "badgeColor": "#9A3412",
            "titleColor": "#24241F",
            "backgroundColor": "#FBFBFA",
            "titleFontSize": 24
          }
        }
      ],
      "edges": []
    }
    $json$::jsonb
  ) $$,
  'Canvas V2 accepts canonical article presentation'
);

select throws_ok(
  $$ select public.validate_canvas_document_v2(
    2::smallint,
    '{
      "schemaVersion": 2,
      "nodes": [
        {
          "id": "article-1",
          "kind": "article",
          "articleId": "knowledge-1",
          "position": {"x": 0, "y": 0},
          "size": {"width": 300, "height": 120},
          "zIndex": 0,
          "style": {
            "badgeColor": "#9A3412",
            "titleColor": "#24241F",
            "backgroundColor": "#FBFBFA",
            "titleFontSize": 13
          }
        }
      ],
      "edges": []
    }'::jsonb
  ) $$,
  '22023',
  'invalid Canvas article title font size',
  'Canvas V2 rejects unsupported article title sizes'
);

select throws_ok(
  $$ select public.validate_canvas_document_v2(
    2::smallint,
    '{
      "schemaVersion": 2,
      "nodes": [
        {
          "id": "article-1",
          "kind": "article",
          "articleId": "knowledge-1",
          "position": {"x": 0, "y": 0},
          "size": {"width": 300, "height": 120},
          "zIndex": 0,
          "style": {
            "badgeColor": "orange",
            "titleColor": "#24241F",
            "backgroundColor": "#FBFBFA",
            "titleFontSize": 24
          }
        }
      ],
      "edges": []
    }'::jsonb
  ) $$,
  '22023',
  'invalid Canvas article color',
  'Canvas V2 rejects non-canonical article colors'
);

select * from finish();
rollback;
