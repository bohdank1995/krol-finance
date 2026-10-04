-- Monobank: a portfolio can be linked to a Monobank card. Its entries are the card's
-- transactions, imported and kept up to date by the `monobank` Edge Function.
-- Run once in Supabase → SQL Editor, after 0005. Existing data is kept.

-- Where a portfolio's entries come from: typed in by hand, or synced from a Monobank card.
alter table public.portfolios
  add column source text not null default 'manual' check (source in ('manual', 'monobank')),
  add column external_account_id text,
  add column synced_at timestamptz;

-- The Monobank transaction id, so syncing the same transaction twice never duplicates it.
alter table public.entries add column external_id text;
create unique index entries_portfolio_external_idx on public.entries (portfolio_id, external_id);

-- Synced entries are read-only: the app may only add, edit or delete entries of manual portfolios.
-- (Deleting a Monobank portfolio still removes its entries; the cascade isn't subject to these rules.)
drop policy "Add own entries" on public.entries;
drop policy "Edit own entries" on public.entries;
drop policy "Delete own entries" on public.entries;

create policy "Add own entries" on public.entries
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.portfolios p where p.id = portfolio_id and p.source = 'manual')
  );
create policy "Edit own entries" on public.entries
  for update to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.portfolios p where p.id = portfolio_id and p.source = 'manual')
  )
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.portfolios p where p.id = portfolio_id and p.source = 'manual')
  );
create policy "Delete own entries" on public.entries
  for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.portfolios p where p.id = portfolio_id and p.source = 'manual')
  );

-- Monobank tokens (read-only access to the user's statements). RLS is on with NO policies,
-- so the app can never read them back: only the Edge Function (service role) can.
-- `accounts` caches the card list from the last check, so connecting needs no extra Monobank call.
create table public.monobank_tokens (
  user_id uuid primary key references auth.users on delete cascade,
  token text not null,
  accounts jsonb not null default '[]',
  created_at timestamptz not null default now()
);
alter table public.monobank_tokens enable row level security;
revoke all on public.monobank_tokens from anon, authenticated;

-- Daily sync: every hour, ask the function to refresh the one card that has gone longest
-- without a sync (if over 20 hours). Monobank allows one request per minute, so one card per run.
-- Needs two Vault secrets, added separately (see supabase/README.md): project_url, monobank_cron_secret.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'monobank-sync',
  '7 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/monobank',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'monobank_cron_secret')
    ),
    body := '{"action":"sync"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
