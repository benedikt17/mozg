-- A reader belongs to a user's view of a Canvas, not to the Canvas graph itself.
-- The article id intentionally stays a soft reference: Knowledge documents can be
-- archived, and the client then presents a recoverable "choose another article"
-- state instead of invalidating the Canvas.
alter table public.canvas_view_states
  add column open_article_id text;

alter table public.canvas_view_states
  add constraint canvas_view_states_open_article_id_check
  check (
    open_article_id is null
    or (
      btrim(open_article_id) <> ''
      and char_length(open_article_id) <= 256
      and open_article_id !~ E'[\\x00-\\x1F\\x7F]'
    )
  );
