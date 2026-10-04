-- Hide from net worth: a card can be left out of the Net worth total (its own card still shows it).
-- Run once in Supabase → SQL Editor, after 0008. Every existing portfolio stays counted.
-- The "Edit own portfolios" policy already covers updating it.

alter table public.portfolios add column in_net_worth boolean not null default true;
