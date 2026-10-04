-- Portfolio order: the cards can be dragged into any order, kept in `position`.
-- Run once in Supabase → SQL Editor, after 0006. Existing portfolios keep their creation order
-- until first dragged. The "Edit own portfolios" policy already covers updating it.

alter table public.portfolios add column position integer;
