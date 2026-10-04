-- Percentages: how much of a portfolio's real balance its card shows (1–100) and how much
-- Net worth counts (0–100), e.g. half of a shared account. Entries keep their real amounts.
-- Run once in Supabase → SQL Editor, after 0009. Existing portfolios stay at 100%.
-- The "Edit own portfolios" policy already covers updating them.

alter table public.portfolios
  add column card_percent numeric not null default 100 check (card_percent > 0 and card_percent <= 100),
  add column net_worth_percent numeric not null default 100 check (net_worth_percent >= 0 and net_worth_percent <= 100);
