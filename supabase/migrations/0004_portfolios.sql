-- Portfolios: "holdings" are renamed to "portfolios", and a portfolio no longer has a type
-- (each entry's type comes from its asset, so one portfolio can mix money and crypto).
-- Run once in Supabase → SQL Editor, after 0003. Existing data is kept.

alter table public.holdings rename to portfolios;
alter table public.entries rename column holding_id to portfolio_id;
alter index public.entries_holding_created_idx rename to entries_portfolio_created_idx;

alter table public.portfolios drop column type;

alter policy "Read own holdings" on public.portfolios rename to "Read own portfolios";
alter policy "Add own holdings" on public.portfolios rename to "Add own portfolios";
alter policy "Edit own holdings" on public.portfolios rename to "Edit own portfolios";
alter policy "Delete own holdings" on public.portfolios rename to "Delete own portfolios";
