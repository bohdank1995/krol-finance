-- Interactive Brokers: a portfolio can mirror stocks held at IBKR. Its entries are the share
-- counts, read from an IBKR Flex Query and kept up to date by the `ibkr` Edge Function.
-- Run once in Supabase → SQL Editor, after 0007. Existing data is kept.

-- A third source. The entry policies from 0006 only allow edits to 'manual' portfolios,
-- so IBKR entries are read-only in the app too.
alter table public.portfolios drop constraint portfolios_source_check;
alter table public.portfolios
  add constraint portfolios_source_check check (source in ('manual', 'monobank', 'ibkr'));

-- Which stocks an IBKR portfolio follows (e.g. {stock:AAPL,stock:VWCE.DE}).
-- null = every stock in the account, including ones bought later ("Select all").
alter table public.portfolios add column tracked_assets text[];

-- IBKR Flex Web Service token + Query ID (read-only reports). RLS is on with NO policies,
-- so the app can never read them back: only the Edge Function (service role) can.
-- `positions` caches the stock list from the last check, so connecting needs no extra IBKR call.
create table public.ibkr_tokens (
  user_id uuid primary key references auth.users on delete cascade,
  token text not null,
  query_id text not null,
  positions jsonb not null default '[]',
  created_at timestamptz not null default now()
);
alter table public.ibkr_tokens enable row level security;
revoke all on public.ibkr_tokens from anon, authenticated;

-- Daily sync: every hour, refresh the IBKR portfolio that has gone longest without a sync
-- (if over 20 hours), together with that user's other IBKR portfolios. Reuses the Vault
-- secrets from 0006: project_url, monobank_cron_secret (the same value as CRON_SECRET).
select cron.schedule(
  'ibkr-sync',
  '37 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ibkr',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'monobank_cron_secret')
    ),
    body := '{"action":"sync"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
