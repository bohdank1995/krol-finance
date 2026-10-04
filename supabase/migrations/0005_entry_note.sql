-- Entry notes: an optional free-text note on each entry.
-- Run once in Supabase → SQL Editor, after 0004. Existing rows get no note; RLS policies already cover it.

alter table public.entries add column note text;
